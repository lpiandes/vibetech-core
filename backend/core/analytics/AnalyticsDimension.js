import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

const SUPPORTED_DIMENSION_KEYS = null; // future extension point; currently allow arbitrary dimension ids

function fail(message) {
  throw new Error(`AnalyticsDimension: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createAnalyticsDimension({ id, name, metadata } = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");
  if (SUPPORTED_DIMENSION_KEYS && !SUPPORTED_DIMENSION_KEYS.includes(id)) {
    fail(`unsupported dimension key: ${String(id)}`);
  }
  const d = {
    id: String(id),
    name: String(name),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(d);
}

