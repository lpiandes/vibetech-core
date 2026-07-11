import { LocalFilesystemKnowledgeStorage } from "./LocalFilesystemKnowledgeStorage.js";

export function createKnowledgeStorageProvider() {
  const driver = String(process.env.KNOWLEDGE_STORAGE_DRIVER ?? process.env.OBJECT_STORAGE_DRIVER ?? "local").toLowerCase();
  if (process.env.OBJECT_STORAGE_ROOT && !process.env.KNOWLEDGE_STORAGE_ROOT) {
    process.env.KNOWLEDGE_STORAGE_ROOT = process.env.OBJECT_STORAGE_ROOT;
  }
  if (driver === "local" || driver === "filesystem" || driver === "fs") {
    return new LocalFilesystemKnowledgeStorage();
  }
  throw new Error(`Unsupported KNOWLEDGE_STORAGE_DRIVER: ${driver}. Use local with a durable volume for V1.`);
}
