import { LocalFilesystemKnowledgeStorage } from "./LocalFilesystemKnowledgeStorage.js";
import { S3CompatibleKnowledgeStorage } from "./S3CompatibleKnowledgeStorage.js";

/**
 * Knowledge blob provider.
 * - local (default): durable filesystem volume (dev / single-node)
 * - s3 / gcs: S3-compatible API (GCS via interoperability endpoint)
 */
export function createKnowledgeStorageProvider() {
  const driver = String(
    process.env.KNOWLEDGE_STORAGE_DRIVER ?? process.env.OBJECT_STORAGE_DRIVER ?? "local",
  ).toLowerCase();

  if (process.env.OBJECT_STORAGE_ROOT && !process.env.KNOWLEDGE_STORAGE_ROOT) {
    process.env.KNOWLEDGE_STORAGE_ROOT = process.env.OBJECT_STORAGE_ROOT;
  }

  if (driver === "local" || driver === "filesystem" || driver === "fs") {
    return new LocalFilesystemKnowledgeStorage();
  }

  if (driver === "s3" || driver === "gcs" || driver === "minio" || driver === "r2") {
    if (driver === "gcs" && !process.env.KNOWLEDGE_S3_ENDPOINT && !process.env.OBJECT_STORAGE_ENDPOINT) {
      process.env.KNOWLEDGE_S3_ENDPOINT =
        process.env.GCS_S3_ENDPOINT || "https://storage.googleapis.com";
      process.env.KNOWLEDGE_S3_FORCE_PATH_STYLE =
        process.env.KNOWLEDGE_S3_FORCE_PATH_STYLE || "true";
    }
    return new S3CompatibleKnowledgeStorage();
  }

  throw new Error(
    `Unsupported KNOWLEDGE_STORAGE_DRIVER: ${driver}. Use local, s3, gcs, minio, or r2.`,
  );
}
