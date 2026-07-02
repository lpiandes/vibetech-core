function fail(message) {
  throw new Error(`CapabilityRuntimeValidator: ${message}`);
}

function isDeepFrozen(v) {
  if (v === null || typeof v !== "object") return true;
  return Object.isFrozen(v);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function isRecordArray(arr) {
  return Array.isArray(arr) && arr.every((x) => Boolean(x) && typeof x === "object" && !Array.isArray(x));
}

export function validateCapabilityRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") fail("runtime required.");
  const state = runtime._state ?? runtime;
  if (!state || typeof state !== "object") fail("state required.");
  if (!Object.isFrozen(state)) fail("runtime._state must be frozen.");

  const { capabilities, categories, metrics } = state;
  if (!Array.isArray(capabilities)) fail("capabilities required array.");
  if (!Array.isArray(categories)) fail("categories required array.");

  if (!isRecordArray(capabilities)) fail("capabilities entries must be objects.");
  if (!isRecordArray(categories)) fail("categories entries must be objects.");

  // Uniqueness.
  const ids = new Set();
  for (const c of capabilities) {
    if (!isDeepFrozen(c)) fail("capability must be frozen.");
    const id = String(c?.id ?? "");
    if (!id) fail("capability.id required.");
    if (ids.has(id)) fail(`duplicate capability id: ${id}`);
    ids.add(id);
  }

  // Metrics sanity (shape checks only).
  if (!metrics || typeof metrics !== "object") fail("metrics required.");
  if (!Object.isFrozen(metrics)) fail("metrics must be frozen.");
  if (typeof metrics.totalCapabilities !== "number") fail("metrics.totalCapabilities must be number.");
  if (typeof metrics.activeCapabilities !== "number") fail("metrics.activeCapabilities must be number.");

  // Categories are frozen and must have id/name.
  for (const cat of categories) {
    if (!isDeepFrozen(cat)) fail("category must be frozen.");
    requireString(cat?.id, "category.id");
    requireString(cat?.name, "category.name");
    if (cat.metadata !== undefined && !isPlainObject(cat.metadata)) fail("category.metadata must be plain object.");
  }

  return { ok: true };
}

