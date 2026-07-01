/**
 * Deterministic Category Repository operations.
 *
 * Sprint 2 scope:
 * - create
 * - update (version bump)
 * - archive
 * - reorder (sortOrder)
 * - lookups / list
 *
 * No persistence, no UI, no search engine.
 */

import { createCategory } from "./Category.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`CategoryRepository: expected ${name} to be a non-empty string.`);
  }
}

export function createCategoryRepository({ items } = {}) {
  const list = Array.isArray(items) ? items : [];
  return deepFreeze({
    items: list.map((c) => createCategory(c)),
  });
}

export function getCategory(categoryRepository, { id, includeArchived = false } = {}) {
  requireString(id, "id");
  const items = Array.isArray(categoryRepository?.items) ? categoryRepository.items : [];
  const found = items.find((c) => c.id === id) ?? null;
  if (!found) return null;
  if (!includeArchived && found.status === "ARCHIVED") return null;
  return found;
}

export function listCategories(categoryRepository, { includeArchived = false } = {}) {
  const items = Array.isArray(categoryRepository?.items) ? categoryRepository.items : [];
  return items
    .filter((c) => (includeArchived ? true : c.status !== "ARCHIVED"))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function applyCategoryCreated(categoryRepository, payload) {
  const repo = categoryRepository ?? { items: [] };
  const existing = getCategory(repo, { id: payload?.id, includeArchived: true });
  if (existing) {
    throw new Error(`CategoryRepository: category already exists: ${payload.id}`);
  }
  const created = createCategory({
    ...payload,
    createdAt: payload?.createdAt ?? new Date().toISOString(),
    updatedAt: payload?.updatedAt ?? payload?.createdAt ?? new Date().toISOString(),
    createdBy: payload?.createdBy ?? "unknown",
    updatedBy: payload?.updatedBy ?? payload?.createdBy ?? "unknown",
  });
  return deepFreeze({
    items: [...repo.items, created],
  });
}

export function applyCategoryUpdated(categoryRepository, payload) {
  const repo = categoryRepository ?? { items: [] };
  requireString(payload?.id, "payload.id");

  const existing = getCategory(repo, { id: payload.id, includeArchived: true });
  if (!existing) {
    throw new Error(`CategoryRepository: category not found: ${payload.id}`);
  }

  const updated = createCategory({
    ...existing,
    ...payload,
    version: Number(existing.version ?? 1) + 1,
    updatedAt: payload?.updatedAt ?? new Date().toISOString(),
    updatedBy: payload?.updatedBy ?? "unknown",
  });

  return deepFreeze({
    items: repo.items.map((c) => (c.id === payload.id ? updated : c)),
  });
}

export function applyCategoryArchived(categoryRepository, payload) {
  const repo = categoryRepository ?? { items: [] };
  requireString(payload?.id, "payload.id");

  const existing = getCategory(repo, { id: payload.id, includeArchived: true });
  if (!existing) {
    throw new Error(`CategoryRepository: category not found: ${payload.id}`);
  }

  const archived = createCategory({
    ...existing,
    status: "ARCHIVED",
    updatedAt: payload?.updatedAt ?? new Date().toISOString(),
    updatedBy: payload?.updatedBy ?? payload?.updatedBy ?? existing.updatedBy ?? "unknown",
  });

  return deepFreeze({
    items: repo.items.map((c) => (c.id === payload.id ? archived : c)),
  });
}

export function applyCategoryReordered(categoryRepository, payload) {
  const repo = categoryRepository ?? { items: [] };
  requireString(payload?.id, "payload.id");
  const existing = getCategory(repo, { id: payload.id, includeArchived: true });
  if (!existing) {
    throw new Error(`CategoryRepository: category not found: ${payload.id}`);
  }

  const reordered = createCategory({
    ...existing,
    sortOrder: typeof payload?.sortOrder === "number" ? payload.sortOrder : existing.sortOrder,
    updatedAt: payload?.updatedAt ?? new Date().toISOString(),
    updatedBy: payload?.updatedBy ?? "unknown",
  });

  return deepFreeze({
    items: repo.items.map((c) => (c.id === payload.id ? reordered : c)),
  });
}

