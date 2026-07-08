import { LocalFilesystemKnowledgeStorage } from "./LocalFilesystemKnowledgeStorage.js";

export function createKnowledgeStorageProvider() {
  const driver = String(process.env.KNOWLEDGE_STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "local") {
    return new LocalFilesystemKnowledgeStorage();
  }
  throw new Error(`Unsupported KNOWLEDGE_STORAGE_DRIVER: ${driver}`);
}
