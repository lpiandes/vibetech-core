import crypto from "node:crypto";
import path from "node:path";

import { platformStore } from "../persistence/PostgresPlatformStore.js";
import { KNOWLEDGE_SOURCE_TYPES, toPublicKnowledgeDocument } from "./BusinessKnowledgeDocument.js";
import { createKnowledgeStorageProvider } from "./createKnowledgeStorageProvider.js";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_OPERATIONAL_CONTENT_BYTES = 32 * 1024;
const DEFAULT_OPERATIONAL_CONTENT_CHARS = 4000;

const EXTENSION_SOURCE_TYPE = {
  ".pdf": KNOWLEDGE_SOURCE_TYPES.PDF,
  ".docx": KNOWLEDGE_SOURCE_TYPES.DOCX,
  ".txt": KNOWLEDGE_SOURCE_TYPES.TXT,
  ".md": KNOWLEDGE_SOURCE_TYPES.MARKDOWN,
};

const MIME_SOURCE_TYPE = {
  "application/pdf": KNOWLEDGE_SOURCE_TYPES.PDF,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": KNOWLEDGE_SOURCE_TYPES.DOCX,
  "text/plain": KNOWLEDGE_SOURCE_TYPES.TXT,
  "text/markdown": KNOWLEDGE_SOURCE_TYPES.MARKDOWN,
  "text/x-markdown": KNOWLEDGE_SOURCE_TYPES.MARKDOWN,
};

export function getMaxUploadBytes() {
  const raw = process.env.KNOWLEDGE_MAX_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BYTES;
  return Math.floor(parsed);
}

export function sanitizeFilename(filename) {
  const base = path.basename(String(filename ?? "").replace(/\0/g, ""));
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("Invalid filename.");
  }
  return cleaned.slice(0, 255);
}

export function detectSourceType(filename, mimeType) {
  const ext = path.extname(String(filename ?? "")).toLowerCase();
  const byExt = EXTENSION_SOURCE_TYPE[ext];
  const byMime = MIME_SOURCE_TYPE[String(mimeType ?? "").toLowerCase()];
  if (byExt && byMime && byExt !== byMime) {
    return null;
  }
  return byExt ?? byMime ?? null;
}

export function validateKnowledgeUpload({ buffer, filename, mimeType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: "File is empty." };
  }

  const maxBytes = getMaxUploadBytes();
  if (buffer.length > maxBytes) {
    return { ok: false, error: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
  }

  let safeFilename;
  try {
    safeFilename = sanitizeFilename(filename);
  } catch {
    return { ok: false, error: "Invalid filename." };
  }

  const sourceType = detectSourceType(safeFilename, mimeType);
  if (!sourceType) {
    return { ok: false, error: "Unsupported file type. Use PDF, DOCX, TXT, or MD." };
  }

  const titleStem = safeFilename.replace(/\.[^.]+$/, "") || safeFilename;
  return {
    ok: true,
    safeFilename,
    sourceType,
    mimeType: String(mimeType ?? "application/octet-stream"),
    sizeBytes: buffer.length,
    title: titleStem,
  };
}

function defaultTitle(titleOverride, fallbackTitle) {
  const custom = String(titleOverride ?? "").trim();
  return custom || fallbackTitle;
}

function supportsOperationalText(sourceType) {
  const type = String(sourceType ?? "").toUpperCase();
  return type === KNOWLEDGE_SOURCE_TYPES.TXT || type === KNOWLEDGE_SOURCE_TYPES.MARKDOWN;
}

function boundedText(buffer, maxChars = DEFAULT_OPERATIONAL_CONTENT_CHARS) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer ?? "");
  return text.replace(/\s+/g, " ").trim().slice(0, Number(maxChars ?? DEFAULT_OPERATIONAL_CONTENT_CHARS));
}

export class BusinessKnowledgeService {
  constructor({ storage = createKnowledgeStorageProvider(), store = platformStore } = {}) {
    this.storage = storage;
    this.store = store;
  }

  async listDocuments(businessId) {
    const rows = await this.store.listKnowledgeDocumentsForBusiness(businessId);
    return rows.map((doc) => toPublicKnowledgeDocument(doc));
  }

  async listOperationalDocuments(
    businessId,
    {
      maxBytes = DEFAULT_OPERATIONAL_CONTENT_BYTES,
      maxContentChars = DEFAULT_OPERATIONAL_CONTENT_CHARS,
      storage = this.storage,
    } = {},
  ) {
    const rows = await this.store.listKnowledgeDocumentsForBusiness(businessId);
    const documents = [];
    for (const doc of rows) {
      let contentText = "";
      if (supportsOperationalText(doc.sourceType) && storage?.getObject) {
        try {
          const buffer = await storage.getObject({ businessId, storageKey: doc.storageKey });
          const bounded = buffer.length > Number(maxBytes) ? buffer.subarray(0, Number(maxBytes)) : buffer;
          contentText = boundedText(bounded, maxContentChars);
        } catch {
          contentText = "";
        }
      }
      documents.push({
        id: doc.id,
        businessId: doc.businessId,
        title: doc.title,
        originalFilename: doc.originalFilename,
        sourceType: doc.sourceType,
        status: doc.status,
        textExtractionStatus: doc.textExtractionStatus,
        deletedAt: doc.deletedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        contentText,
      });
    }
    return documents;
  }

  async getDocument(businessId, documentId) {
    const doc = await this.store.getKnowledgeDocumentById(documentId, businessId);
    return toPublicKnowledgeDocument(doc);
  }

  async uploadDocument({ businessId, userId, buffer, filename, mimeType, title, storage = this.storage }) {
    const validation = validateKnowledgeUpload({ buffer, filename, mimeType });
    if (!validation.ok) {
      const err = new Error(validation.error);
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const storageKey = crypto.randomUUID();
    const displayTitle = defaultTitle(title, validation.title);

    await storage.putObject({
      businessId,
      storageKey,
      buffer,
      mimeType: validation.mimeType,
    });

    try {
      const doc = await this.store.createKnowledgeDocument({
        businessId,
        title: displayTitle,
        originalFilename: validation.safeFilename,
        storageKey,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
        sourceType: validation.sourceType,
        uploadedByUserId: userId,
      });

      void this.store
        .recordAuditEvent({
          actorUserId: userId,
          businessId,
          action: "knowledge.document_uploaded",
          targetType: "knowledge_document",
          targetId: doc.id,
          metadata: {
            originalFilename: doc.originalFilename,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
            sourceType: doc.sourceType,
          },
        })
        .catch((err) => console.error("[knowledge-upload] audit failed", err));

      return toPublicKnowledgeDocument(doc);
    } catch (err) {
      try {
        await storage.deleteObject({ businessId, storageKey });
      } catch (cleanupErr) {
        console.error("[knowledge-upload] storage cleanup failed", cleanupErr);
      }
      throw err;
    }
  }

  async deleteDocument({ businessId, documentId, userId, storage = this.storage }) {
    const doc = await this.store.getKnowledgeDocumentById(documentId, businessId);
    if (!doc || doc.status === "deleted") {
      const err = new Error("Knowledge document not found.");
      err.code = "NOT_FOUND";
      throw err;
    }

    const deleted = await this.store.softDeleteKnowledgeDocument({
      documentId,
      businessId,
      deletedByUserId: userId,
    });

    try {
      await storage.deleteObject({ businessId, storageKey: doc.storageKey });
    } catch (storageErr) {
      console.error("[knowledge-delete] storage delete failed", storageErr);
    }

    void this.store
      .recordAuditEvent({
        actorUserId: userId,
        businessId,
        action: "knowledge.document_deleted",
        targetType: "knowledge_document",
        targetId: doc.id,
        metadata: { originalFilename: doc.originalFilename },
      })
      .catch((err) => console.error("[knowledge-delete] audit failed", err));

    return toPublicKnowledgeDocument(deleted);
  }

  async countActiveDocuments(businessId) {
    return this.store.countActiveKnowledgeDocuments(businessId);
  }
}

export const businessKnowledgeService = new BusinessKnowledgeService();
