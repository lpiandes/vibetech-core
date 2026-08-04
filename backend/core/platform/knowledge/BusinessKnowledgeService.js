import crypto from "node:crypto";
import path from "node:path";

import { KNOWLEDGE_SOURCE_TYPES, toPublicKnowledgeDocument } from "./BusinessKnowledgeDocument.js";
import {
  normalizeKnowledgeCategoryIds,
  UNIVERSAL_KNOWLEDGE_CATEGORIES,
} from "./universalKnowledgeCategories.js";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_OPERATIONAL_CONTENT_BYTES = 32 * 1024;
const DEFAULT_OPERATIONAL_CONTENT_CHARS = 4000;
/** Cap stored/viewable text so Postgres stays lean while SOPs remain readable. */
const DEFAULT_VIEW_CONTENT_CHARS = 120_000;
const DEFAULT_VIEW_CONTENT_BYTES = 256 * 1024;

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

import {
  extractOperationalKnowledgeText,
  supportsOperationalTextExtraction,
} from "./extractOperationalKnowledgeText.js";

export class BusinessKnowledgeService {
  constructor({ storage, store } = {}) {
    if (!store) throw new Error("BusinessKnowledgeService requires a platform store");
    if (!storage) throw new Error("BusinessKnowledgeService requires a storage provider");
    this.storage = storage;
    this.store = store;
  }

  async listDocuments(businessId) {
    const rows = await this.store.listKnowledgeDocumentsForBusiness(businessId);
    return rows.map((doc) => toPublicKnowledgeDocument(doc));
  }

  listUniversalCategories() {
    return UNIVERSAL_KNOWLEDGE_CATEGORIES;
  }

  /**
   * Owner search over titles, filenames, and category tags (no free invent).
   */
  /** @param {string} businessId @param {string} query @param {{categoryId?: string | null}} options */
  async searchDocuments(businessId, query, { categoryId = null } = {}) {
    const q = String(query ?? "").trim().toLowerCase();
    const cat = categoryId ? String(categoryId).trim().toUpperCase() : null;
    const docs = await this.listDocuments(businessId);
    return docs.filter((doc) => {
      if (cat && !(doc.categoryIds ?? []).includes(cat)) return false;
      if (!q) return true;
      const hay = [
        doc.title,
        doc.originalFilename,
        ...(doc.categoryIds ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  /**
   * Documents that power AI specialty / teammate consult (tagged + extractable).
   */
  async listPowersAiPanel(businessId) {
    const docs = await this.listDocuments(businessId);
    const categories = UNIVERSAL_KNOWLEDGE_CATEGORIES;
    const byCategory = categories.map((cat) => {
      const matching = docs.filter((d) => (d.categoryIds ?? []).includes(cat.id));
      return {
        categoryId: cat.id,
        label: cat.label,
        description: cat.description,
        documentCount: matching.length,
        documentIds: matching.map((d) => d.id),
      };
    });
    const untagged = docs.filter((d) => !(d.categoryIds ?? []).length);
    return {
      contract: "KnowledgePowersAiPanel/v1",
      totalDocuments: docs.length,
      taggedDocuments: docs.filter((d) => (d.categoryIds ?? []).length > 0).length,
      untaggedDocuments: untagged.length,
      categories: byCategory,
      winClaim:
        "Every AI output shows what it read. If Knowledge is empty, we show a gap — we don’t fake expertise.",
    };
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
      if (doc.contentText) {
        contentText = String(doc.contentText).slice(0, Number(maxContentChars));
      } else if (supportsOperationalTextExtraction(doc.sourceType) && storage?.getObject) {
        try {
          const buffer = await storage.getObject({ businessId, storageKey: doc.storageKey });
          contentText = await extractOperationalKnowledgeText({
            buffer,
            sourceType: doc.sourceType,
            filename: doc.originalFilename,
            maxBytes,
            maxContentChars,
          });
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

  /**
   * Owner View: durable content_text first, then blob storage (may be gone on Vercel /tmp).
   */
  async getDocumentContent(
    businessId,
    documentId,
    {
      maxBytes = DEFAULT_VIEW_CONTENT_BYTES,
      maxContentChars = DEFAULT_VIEW_CONTENT_CHARS,
      storage = this.storage,
    } = {},
  ) {
    const doc = await this.store.getKnowledgeDocumentById(documentId, businessId);
    if (!doc || doc.status === "deleted") {
      const err = new Error("Knowledge document not found.");
      err.code = "NOT_FOUND";
      throw err;
    }

    let contentText = doc.contentText ? String(doc.contentText) : "";
    let source = contentText ? "database" : null;

    if (!contentText && supportsOperationalTextExtraction(doc.sourceType) && storage?.getObject) {
      try {
        const buffer = await storage.getObject({ businessId, storageKey: doc.storageKey });
        contentText = await extractOperationalKnowledgeText({
          buffer,
          sourceType: doc.sourceType,
          filename: doc.originalFilename,
          maxBytes,
          maxContentChars,
        });
        if (contentText) {
          source = "storage";
          if (typeof this.store.updateKnowledgeDocumentContentText === "function") {
            void this.store
              .updateKnowledgeDocumentContentText({
                documentId: doc.id,
                businessId,
                contentText,
                textExtractionStatus: "succeeded",
              })
              .catch((err) => console.error("[knowledge-content] backfill failed", err));
          }
        }
      } catch {
        contentText = "";
      }
    }

    return {
      document: toPublicKnowledgeDocument(doc),
      contentText: contentText.slice(0, Number(maxContentChars)),
      available: Boolean(contentText.trim()),
      source,
    };
  }

  async uploadDocument({
    businessId,
    userId,
    buffer,
    filename,
    mimeType,
    title,
    categoryIds,
    storage = this.storage,
  }) {
    const validation = validateKnowledgeUpload({ buffer, filename, mimeType });
    if (!validation.ok) {
      const err = new Error(validation.error);
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const cats = normalizeKnowledgeCategoryIds(categoryIds);
    const storageKey = crypto.randomUUID();
    const displayTitle = defaultTitle(title, validation.title);

    await storage.putObject({
      businessId,
      storageKey,
      buffer,
      mimeType: validation.mimeType,
    });

    let contentText = "";
    let textExtractionStatus = "skipped";
    if (supportsOperationalTextExtraction(validation.sourceType)) {
      try {
        contentText = await extractOperationalKnowledgeText({
          buffer,
          sourceType: validation.sourceType,
          filename: validation.safeFilename,
          maxBytes: DEFAULT_VIEW_CONTENT_BYTES,
          maxContentChars: DEFAULT_VIEW_CONTENT_CHARS,
        });
        textExtractionStatus = contentText ? "succeeded" : "failed";
      } catch {
        contentText = "";
        textExtractionStatus = "failed";
      }
    }

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
        categoryIds: cats,
        contentText: contentText || null,
        textExtractionStatus,
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
            categoryIds: cats,
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

  async updateDocumentCategories({ businessId, documentId, userId, categoryIds }) {
    const cats = normalizeKnowledgeCategoryIds(categoryIds);
    if (typeof this.store.updateKnowledgeDocumentCategories !== "function") {
      const err = new Error("Knowledge category updates are not available.");
      err.code = "NOT_SUPPORTED";
      throw err;
    }
    const updated = await this.store.updateKnowledgeDocumentCategories({
      documentId,
      businessId,
      categoryIds: cats,
    });
    if (!updated) {
      const err = new Error("Knowledge document not found.");
      err.code = "NOT_FOUND";
      throw err;
    }
    void this.store
      .recordAuditEvent({
        actorUserId: userId,
        businessId,
        action: "knowledge.document_categories_updated",
        targetType: "knowledge_document",
        targetId: documentId,
        metadata: { categoryIds: cats },
      })
      .catch((err) => console.error("[knowledge-categories] audit failed", err));
    return toPublicKnowledgeDocument(updated);
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

export function createBusinessKnowledgeService(deps) {
  return new BusinessKnowledgeService(deps);
}
