import assert from "node:assert/strict";
import { test } from "node:test";

import { createKnowledgeRepository, applyKnowledgeArchived, applyKnowledgeCreated, applyKnowledgeRevisionCreated, getKnowledgeItem, getRevisionHistory, listKnowledgeItems, listKnowledgeItemsByCategory, groupKnowledgeItemsByCategory, searchKnowledgeMetadata } from "./KnowledgeRepository.js";
import { createKnowledgeItem } from "./KnowledgeItem.js";

function seedItem({
  id = "kn_test_1",
  title = "Title 1",
  description = "Desc 1",
  category = "FAQ",
  searchKeywords,
} = {}) {
  return {
    id,
    title,
    description,
    category,
    tags: ["faq"],
    relationships: [],
    version: 1,
    revisionHistory: [],
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    createdBy: "test",
    updatedBy: "test",
    visibility: "INTERNAL",
    status: "ACTIVE",
    source: "test",
    confidence: 0.8,
    priority: "Medium",
    industry: "Property Management",
    applicableEmployees: ["emp_prop_interest"],
    searchKeywords: Array.isArray(searchKeywords) ? searchKeywords : ["title", "desc", "faq"],
    metadata: { foo: "bar" },
  };
}

test("KnowledgeItem is immutable (deepFreeze)", () => {
  const item = createKnowledgeItem(seedItem());
  assert.ok(Object.isFrozen(item));
  assert.throws(() => {
    item.title = "Mutated";
  }, TypeError);
});

test("Repository: create + list + read + search", () => {
  const repo = createKnowledgeRepository({ items: [seedItem()] });
  const all = listKnowledgeItems(repo, { includeArchived: false });
  assert.equal(all.length, 1);

  const found = getKnowledgeItem(repo, { id: "kn_test_1" });
  assert.equal(found?.title, "Title 1");

  const search = searchKnowledgeMetadata(repo, { keywords: ["title"] });
  assert.equal(search.length, 1);
  assert.equal(search[0].item.id, "kn_test_1");
});

test("Repository: filterByCategory + groupByCategory are deterministic", () => {
  const a = seedItem({ id: "kn_cat_a", category: "FAQ", title: "A", searchKeywords: ["x"] });
  const b = seedItem({ id: "kn_cat_b", category: "POLICIES", title: "B", searchKeywords: ["x"] });
  const c = seedItem({ id: "kn_cat_c", category: "POLICIES", title: "C", searchKeywords: ["x"] });

  const repo = createKnowledgeRepository({ items: [a, b, c] });

  const faq = listKnowledgeItemsByCategory(repo, { categoryId: "FAQ" });
  assert.equal(faq.length, 1);
  assert.equal(faq[0].id, "kn_cat_a");

  const grouped = groupKnowledgeItemsByCategory(repo);
  assert.ok(grouped["FAQ"]);
  assert.ok(grouped["POLICIES"]);
  assert.equal(grouped["POLICIES"].length, 2);
  assert.equal(grouped["POLICIES"][0].id, "kn_cat_b");
});

test("Repository: update creates revisionHistory snapshot and increments version", () => {
  const repo = createKnowledgeRepository({ items: [seedItem({ title: "Old" })] });

  const nextRepo = applyKnowledgeRevisionCreated(repo, {
    id: "kn_test_1",
    title: "New",
    updatedBy: "tester",
    updatedAt: "2026-06-21T00:00:00.000Z",
  });

  const updated = getKnowledgeItem(nextRepo, { id: "kn_test_1" });
  assert.equal(updated.version, 2);
  assert.equal(updated.title, "New");
  assert.equal(updated.revisionHistory.length, 1);
  assert.equal(updated.revisionHistory[0].version, 1);
  assert.equal(updated.revisionHistory[0].title, "Old");

  // Ensure snapshot is frozen.
  assert.ok(Object.isFrozen(updated.revisionHistory[0]));
});

test("Repository: archive sets status to ARCHIVED (no permanent delete)", () => {
  const repo = createKnowledgeRepository({ items: [seedItem()] });
  const archived = applyKnowledgeArchived(repo, {
    id: "kn_test_1",
    updatedAt: "2026-06-22T00:00:00.000Z",
    updatedBy: "tester",
  });

  const active = getKnowledgeItem(archived, { id: "kn_test_1", includeArchived: false });
  assert.equal(active, null);

  const include = getKnowledgeItem(archived, { id: "kn_test_1", includeArchived: true });
  assert.equal(include.status, "ARCHIVED");

  const all = listKnowledgeItems(archived, { includeArchived: true });
  assert.equal(all.length, 1);
});

test("Repository: deterministic search ordering (tie-breaker by id)", () => {
  const a = seedItem({ id: "kn_a", title: "Same", description: "A", searchKeywords: ["x"] });
  const b = seedItem({ id: "kn_b", title: "Same", description: "B", searchKeywords: ["x"] });
  const repo = createKnowledgeRepository({ items: [a, b] });

  const results = searchKnowledgeMetadata(repo, { keywords: ["x"] });
  assert.equal(results.length, 2);
  // Same score => id locale ordering.
  assert.equal(results[0].item.id, "kn_a");
  assert.equal(results[1].item.id, "kn_b");
});

