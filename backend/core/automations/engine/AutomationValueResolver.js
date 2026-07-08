import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AutomationValueResolver: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

const SOURCE_TYPES = {
  LITERAL: "LITERAL",
  EVENT_FIELD: "EVENT_FIELD",
  INTERACTION_FIELD: "INTERACTION_FIELD",
  CONCAT: "CONCAT",
  ARRAY_CONCAT: "ARRAY_CONCAT",
};

function validateFieldPath(fieldPath) {
  requireString(fieldPath, "fieldPath");
  // Deterministic safe path traversal.
  const ok = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(String(fieldPath));
  if (!ok) fail(`Invalid fieldPath: ${String(fieldPath)}`);
  return String(fieldPath);
}

function getByFieldPath(root, fieldPath) {
  const fp = validateFieldPath(fieldPath);
  const parts = fp.split(".");
  let cur = root;
  for (const p of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function toArray(v) {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

function resolveValueSpec(spec, { event, interaction } = {}) {
  // Value spec: either a tagged object {sourceType,...} or a nested structure.
  if (isPlainObject(spec) && typeof spec.sourceType === "string") {
    const sourceType = String(spec.sourceType);
    if (!Object.values(SOURCE_TYPES).includes(sourceType)) fail(`Unsupported sourceType: ${sourceType}`);

    switch (sourceType) {
      case SOURCE_TYPES.LITERAL: {
        // Resolve recursively inside the literal, so nested specs are allowed deterministically.
        const v = spec.value;
        return resolveValueSpec(v, { event, interaction });
      }

      case SOURCE_TYPES.EVENT_FIELD: {
        const fieldPath = String(spec.fieldPath ?? "");
        if (!fieldPath) fail("EVENT_FIELD requires fieldPath.");
        return getByFieldPath(event, fieldPath);
      }

      case SOURCE_TYPES.INTERACTION_FIELD: {
        const fieldPath = String(spec.fieldPath ?? "");
        if (!fieldPath) fail("INTERACTION_FIELD requires fieldPath.");
        return getByFieldPath(interaction, fieldPath);
      }

      case SOURCE_TYPES.CONCAT: {
        const parts = Array.isArray(spec.parts) ? spec.parts : [];
        const resolved = parts.map((p) => resolveValueSpec(p, { event, interaction }));
        return resolved.map((x) => (x === undefined || x === null ? "" : String(x))).join("");
      }

      case SOURCE_TYPES.ARRAY_CONCAT: {
        const parts = Array.isArray(spec.parts) ? spec.parts : [];
        const arrays = parts.map((p) => resolveValueSpec(p, { event, interaction }));
        const flat = [];
        for (const a of arrays) {
          const arr = toArray(a);
          for (const item of arr) flat.push(item);
        }
        return flat;
      }

      default:
        fail(`Unhandled sourceType: ${sourceType}`);
    }
  }

  if (Array.isArray(spec)) {
    return spec.map((x) => resolveValueSpec(x, { event, interaction }));
  }

  if (isPlainObject(spec)) {
    const out = {};
    for (const [k, v] of Object.entries(spec)) out[k] = resolveValueSpec(v, { event, interaction });
    return out;
  }

  // primitives and null/undefined
  return spec;
}

export function resolveAutomationParameters({ parameters, event, interaction } = {}) {
  if (!isPlainObject(parameters)) fail("parameters must be plain object.");
  const resolved = resolveValueSpec(parameters, { event, interaction });
  // Freeze to preserve immutability of resolved action plans.
  return deepFreeze(resolved);
}

export function getSupportedAutomationValueResolverSourceTypes() {
  return deepFreeze(Object.values(SOURCE_TYPES));
}
