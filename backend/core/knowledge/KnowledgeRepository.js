/**
 * KnowledgeRepository (deterministic operations)
 *
 * The repository is represented as:
 * {
 *   items: KnowledgeItem[]
 * }
 *
 * Repository operations are pure and deterministic:
 * - applyKnowledgeCreated
 * - applyKnowledgeRevisionCreated
 * - applyKnowledgeArchived
 * - list / read / search / revision history
 */

import { createKnowledgeItem } from "./KnowledgeItem.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`KnowledgeRepository: expected ${name} to be a non-empty string.`);
  }
}

function normalizeKeywords(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((k) => String(k).toLowerCase())
    .filter(Boolean);
}

export function createKnowledgeRepository({ items } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  return deepFreeze({
    items: safeItems.map((i) => createKnowledgeItem(i)),
  });
}

export function listKnowledgeItems(repository, { includeArchived = false } = {}) {
  if (!repository || typeof repository !== "object") return [];
  const items = Array.isArray(repository.items) ? repository.items : [];
  return items.filter((i) => (includeArchived ? true : i.status !== "ARCHIVED"));
}

export function listKnowledgeItemsByCategory(
  repository,
  { categoryId, includeArchived = false } = {},
) {
  requiredString(categoryId, "categoryId");
  const items = listKnowledgeItems(repository, { includeArchived });
  return items.filter((i) => i.category === categoryId);
}

export function groupKnowledgeItemsByCategory(
  repository,
  { includeArchived = false } = {},
) {
  const items = listKnowledgeItems(repository, { includeArchived });
  const grouped = new Map();
  for (const i of items) {
    const key = i.category;
    const prev = grouped.get(key) ?? [];
    grouped.set(key, [...prev, i]);
  }

  // Convert to stable plain object for deterministic serialization.
  const obj = {};
  for (const key of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
    obj[key] = grouped.get(key);
  }
  return deepFreeze(obj);
}

export function getKnowledgeItem(repository, { id, includeArchived = false } = {}) {
  requiredString(id, "id");
  const items = Array.isArray(repository?.items) ? repository.items : [];
  const found = items.find((i) => i.id === id);
  if (!found) return null;
  if (!includeArchived && found.status === "ARCHIVED") return null;
  return found;
}

export function getRevisionHistory(repository, { id } = {}) {
  requiredString(id, "id");
  const item = getKnowledgeItem(repository, { id, includeArchived: true });
  return item?.revisionHistory ?? [];
}

function snapshotForRevisionHistory(item) {
  // Store a frozen snapshot of the previous “current” revision.
  // We intentionally do not store revisionHistory recursively.
  return deepFreeze({
    version: item.version,
    relationships: item.relationships ?? [],
    title: item.title,
    description: item.description,
    category: item.category,
    tags: item.tags ?? [],
    visibility: item.visibility,
    status: item.status,
    source: item.source,
    confidence: item.confidence,
    priority: item.priority,
    industry: item.industry,
    applicableEmployees: item.applicableEmployees ?? [],
    searchKeywords: item.searchKeywords ?? [],
    metadata: item.metadata ?? {},
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: item.createdBy,
    updatedBy: item.updatedBy,
  });
}

export function applyKnowledgeCreated(
  repository,
  payload,
  { isValidCategory } = {},
) {
  const repo = repository ?? { items: [] };

  if (typeof isValidCategory === "function") {
    const categoryId = payload?.category;
    if (!categoryId || !isValidCategory(categoryId)) {
      throw new Error(`KnowledgeRepository: invalid category: ${categoryId}`);
    }
  }

  const existing = getKnowledgeItem(repo, { id: payload?.id, includeArchived: true });
  if (existing) {
    throw new Error(`KnowledgeRepository.applyKnowledgeCreated: knowledge id already exists: ${payload.id}`);
  }

  const item = createKnowledgeItem(payload);
  return deepFreeze({ items: [...repo.items, item] });
}

export function applyKnowledgeRevisionCreated(
  repository,
  payload,
  { isValidCategory } = {},
) {
  const repo = repository ?? { items: [] };
  requiredString(payload?.id, "payload.id");

  const existing = getKnowledgeItem(repo, { id: payload.id, includeArchived: true });
  if (!existing) {
    throw new Error(`KnowledgeRepository.applyKnowledgeRevisionCreated: knowledge not found: ${payload.id}`);
  }

  if (typeof isValidCategory === "function" && typeof payload?.category === "string") {
    if (!isValidCategory(payload.category)) {
      throw new Error(`KnowledgeRepository: invalid category in revision: ${payload.category}`);
    }
  }

  const next = {
    ...existing,
    // Allow partial updates; keep any omitted field from previous revision.
    title: typeof payload?.title === "string" ? payload.title : existing.title,
    description:
      typeof payload?.description === "string" ? payload.description : existing.description,
    category: typeof payload?.category === "string" ? payload.category : existing.category,
    tags: Array.isArray(payload?.tags) ? payload.tags : existing.tags,
    relationships: Array.isArray(payload?.relationships)
      ? payload.relationships
      : existing.relationships,
    visibility: typeof payload?.visibility === "string" ? payload.visibility : existing.visibility,
    status: typeof payload?.status === "string" ? payload.status : existing.status,
    source: typeof payload?.source === "string" ? payload.source : existing.source,
    confidence: typeof payload?.confidence === "number" ? payload.confidence : existing.confidence,
    priority: typeof payload?.priority === "string" ? payload.priority : existing.priority,
    industry: typeof payload?.industry === "string" ? payload.industry : existing.industry,
    applicableEmployees: Array.isArray(payload?.applicableEmployees)
      ? payload.applicableEmployees
      : existing.applicableEmployees,
    searchKeywords: Array.isArray(payload?.searchKeywords) ? normalizeKeywords(payload.searchKeywords) : existing.searchKeywords,
    metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : existing.metadata,
    updatedAt: payload?.updatedAt ?? existing.updatedAt,
    updatedBy: payload?.updatedBy ?? existing.updatedBy,
  };

  const nextVersion = Number(existing.version ?? 1) + 1;

  const revisionSnapshot = snapshotForRevisionHistory(existing);
  const revisionHistory = [...(existing.revisionHistory ?? []), revisionSnapshot];

  const item = createKnowledgeItem({
    ...next,
    id: payload.id,
    version: nextVersion,
    revisionHistory,
  });

  return deepFreeze({
    items: repo.items.map((i) => (i.id === payload.id ? item : i)),
  });
}

export function applyKnowledgeArchived(repository, payload) {
  const repo = repository ?? { items: [] };
  requiredString(payload?.id, "payload.id");

  const existing = getKnowledgeItem(repo, { id: payload.id, includeArchived: true });
  if (!existing) {
    throw new Error(`KnowledgeRepository.applyKnowledgeArchived: knowledge not found: ${payload.id}`);
  }

  const archived = createKnowledgeItem({
    ...existing,
    status: "ARCHIVED",
    updatedAt: payload?.updatedAt ?? new Date().toISOString(),
    updatedBy: payload?.updatedBy ?? existing.updatedBy,
    // archived does not create a revisionHistory entry; it’s a status change.
    // However, it still represents a new “current” version for auditability.
    version: Number(existing.version ?? 1),
    revisionHistory: existing.revisionHistory ?? [],
  });

  return deepFreeze({
    items: repo.items.map((i) => (i.id === payload.id ? archived : i)),
  });
}

export function searchKnowledgeMetadata(repository, { keywords = [] } = {}) {
  const repo = repository ?? { items: [] };
  const items = Array.isArray(repo.items) ? repo.items : [];
  const query = normalizeKeywords(keywords);

  if (!query.length) return [];

  const scored = items
    .filter((i) => i.status !== "ARCHIVED")
    .map((item) => {
      const haystack = new Set(normalizeKeywords(item.searchKeywords ?? []));
      let score = 0;

      for (const q of query) {
        if (haystack.has(q)) score += 3;
      }

      // Small baseline keeps ordering deterministic for equal scores.
      score += (item.confidence ?? 0.5) * 0.01;

      // Deterministic tie-breaker.
      return { item, score, id: item.id };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return scored.map((s) => ({
    item: s.item,
    relevance: s.score,
  }));
}

