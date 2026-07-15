import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeKnowledgeCategoryIds,
  UNIVERSAL_KNOWLEDGE_CATEGORIES,
} from "./universalKnowledgeCategories.js";
import { createKnowledgeStorageProvider } from "./createKnowledgeStorageProvider.js";
import { LocalFilesystemKnowledgeStorage } from "./LocalFilesystemKnowledgeStorage.js";

test("universal Knowledge categories include Contracts, Curriculum, Playbooks", () => {
  const ids = UNIVERSAL_KNOWLEDGE_CATEGORIES.map((c) => c.id);
  assert.ok(ids.includes("CONTRACTS"));
  assert.ok(ids.includes("CURRICULUM"));
  assert.ok(ids.includes("PLAYBOOKS"));
  assert.ok(ids.includes("POLICIES"));
});

test("normalizeKnowledgeCategoryIds drops unknowns and duplicates", () => {
  assert.deepEqual(normalizeKnowledgeCategoryIds(["policies", "CURRICULUM", "bogus", "policies"]), [
    "POLICIES",
    "CURRICULUM",
  ]);
});

test("createKnowledgeStorageProvider defaults to local filesystem", () => {
  const prev = process.env.KNOWLEDGE_STORAGE_DRIVER;
  delete process.env.KNOWLEDGE_STORAGE_DRIVER;
  delete process.env.OBJECT_STORAGE_DRIVER;
  const storage = createKnowledgeStorageProvider();
  assert.ok(storage instanceof LocalFilesystemKnowledgeStorage);
  if (prev != null) process.env.KNOWLEDGE_STORAGE_DRIVER = prev;
});
