import crypto from "node:crypto";
import path from "node:path";

import { platformStore } from "../../platform/persistence/PostgresPlatformStore.js";
import { LocalFilesystemImportStorage } from "./LocalFilesystemImportStorage.js";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export function getMaxImportUploadBytes() {
  const raw = process.env.IMPORT_MAX_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BYTES;
  return Math.floor(parsed);
}

export function sanitizeImportFilename(filename) {
  const base = path.basename(String(filename ?? "").replace(/\0/g, ""));
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("Invalid filename.");
  }
  return cleaned.slice(0, 255);
}

export function computeContentHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function validateImportUpload({ buffer, filename, mimeType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: "File is empty." };
  }

  const maxBytes = getMaxImportUploadBytes();
  if (buffer.length > maxBytes) {
    return { ok: false, error: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
  }

  let safeFilename;
  try {
    safeFilename = sanitizeImportFilename(filename);
  } catch {
    return { ok: false, error: "Invalid filename." };
  }

  const ext = path.extname(safeFilename).toLowerCase();
  const mime = String(mimeType ?? "").toLowerCase();
  const csvLike =
    ext === ".csv" ||
    ext === ".txt" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "text/plain" ||
    mime === "application/vnd.ms-excel";

  if (!csvLike) {
    return { ok: false, error: "Unsupported file type. Use CSV or plain-text export." };
  }

  return {
    ok: true,
    safeFilename,
    mimeType: mime || "text/csv",
    sizeBytes: buffer.length,
  };
}

export class ImportArtifactStore {
  constructor({ storage = new LocalFilesystemImportStorage(), store = platformStore } = {}) {
    this.storage = storage;
    this.store = store;
  }

  async uploadArtifact({ businessId, userId, buffer, filename, mimeType, sourceSystem }) {
    const validation = validateImportUpload({ buffer, filename, mimeType });
    if (!validation.ok) {
      const err = new Error(validation.error);
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const storageKey = crypto.randomUUID();
    const contentHash = computeContentHash(buffer);

    await this.storage.putObject({ businessId, storageKey, buffer });

    const artifact = await this.store.createImportArtifact({
      businessId,
      sourceSystem,
      originalFilename: validation.safeFilename,
      storageKey,
      contentHash,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
      uploadedByUserId: userId ?? null,
    });

    return { artifact, contentHash };
  }

  async readArtifactBuffer({ businessId, artifact }) {
    return this.storage.getObject({ businessId, storageKey: artifact.storageKey });
  }
}

export function createImportArtifactStore(options = {}) {
  return new ImportArtifactStore(options);
}
