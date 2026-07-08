import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function storageRoot() {
  return process.env.KNOWLEDGE_STORAGE_ROOT
    ? path.resolve(process.env.KNOWLEDGE_STORAGE_ROOT)
    : path.join(repoRoot, ".dev", "knowledge-storage");
}

function businessDir(businessId) {
  const root = storageRoot();
  const dir = path.resolve(root, String(businessId));
  if (!dir.startsWith(root + path.sep) && dir !== root) {
    throw new Error("Invalid business storage path.");
  }
  return dir;
}

function objectPath(businessId, storageKey) {
  const key = String(storageKey).replace(/[/\\]/g, "");
  if (!key || key.includes("..")) {
    throw new Error("Invalid storage key.");
  }
  const dir = businessDir(businessId);
  const full = path.resolve(dir, key);
  if (!full.startsWith(dir + path.sep)) {
    throw new Error("Storage path traversal blocked.");
  }
  return full;
}

export class LocalFilesystemKnowledgeStorage {
  async putObject({ businessId, storageKey, buffer }) {
    const filePath = objectPath(businessId, storageKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, buffer);
  }

  async deleteObject({ businessId, storageKey }) {
    const filePath = objectPath(businessId, storageKey);
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return;
      }
      throw err;
    }
  }

  async objectExists({ businessId, storageKey }) {
    const filePath = objectPath(businessId, storageKey);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
