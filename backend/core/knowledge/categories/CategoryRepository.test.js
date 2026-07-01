import assert from "node:assert/strict";
import { test } from "node:test";

import { createCategoryRepository, getCategory, listCategories, applyCategoryCreated, applyCategoryUpdated, applyCategoryArchived, applyCategoryReordered } from "./CategoryRepository.js";
import { createBuiltInKnowledgeCategories } from "./builtInCategories.js";

test("Category repository: built-in seeding returns expected categories", () => {
  const repo = createCategoryRepository({
    items: createBuiltInKnowledgeCategories(),
  });

  const ids = listCategories(repo, { includeArchived: false }).map((c) => c.id);
  assert.ok(ids.includes("FAQ"));
  assert.ok(ids.includes("BRAND_VOICE"));
  assert.ok(ids.includes("PROPERTY_INFORMATION"));
  assert.equal(ids.length, 14);
});

test("Category immutability (deepFreeze)", () => {
  const repo = createCategoryRepository({
    items: createBuiltInKnowledgeCategories(),
  });
  const faq = getCategory(repo, { id: "FAQ" });
  assert.ok(Object.isFrozen(faq));
  assert.throws(() => {
    faq.name = "Mutated";
  }, TypeError);
});

test("Category events: create + update + reorder + archive are deterministic", () => {
  let repo = createCategoryRepository({ items: [] });

  repo = applyCategoryCreated(repo, {
    id: "CUSTOM_KN_TEST",
    name: "Custom Test",
    description: "desc",
    icon: "",
    color: "",
    sortOrder: 5,
    parentCategory: null,
    childCategories: [],
    defaultTags: ["x"],
    searchable: true,
    editable: true,
    version: 1,
    status: "ACTIVE",
    visibility: "INTERNAL",
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    createdBy: "tester",
    updatedBy: "tester",
    metadata: { a: 1 },
  });

  const created = getCategory(repo, { id: "CUSTOM_KN_TEST", includeArchived: true });
  assert.equal(created.version, 1);

  repo = applyCategoryUpdated(repo, {
    id: "CUSTOM_KN_TEST",
    description: "desc2",
    updatedAt: "2026-06-21T00:00:00.000Z",
    updatedBy: "tester2",
  });

  const updated = getCategory(repo, { id: "CUSTOM_KN_TEST", includeArchived: true });
  assert.equal(updated.description, "desc2");
  assert.equal(updated.version, 2);

  repo = applyCategoryReordered(repo, {
    id: "CUSTOM_KN_TEST",
    sortOrder: 42,
    updatedAt: "2026-06-22T00:00:00.000Z",
    updatedBy: "tester3",
  });
  const reordered = getCategory(repo, { id: "CUSTOM_KN_TEST", includeArchived: true });
  assert.equal(reordered.sortOrder, 42);

  repo = applyCategoryArchived(repo, {
    id: "CUSTOM_KN_TEST",
    updatedAt: "2026-06-23T00:00:00.000Z",
    updatedBy: "tester4",
  });
  const archived = getCategory(repo, { id: "CUSTOM_KN_TEST", includeArchived: true });
  assert.equal(archived.status, "ARCHIVED");
});

