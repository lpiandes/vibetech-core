import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityCategory: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

export function createCapabilityCategory({ id, name, metadata } = {}) {
  requireString(id, "id");
  requireString(name, "name");
  const md = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({});
  return deepFreeze({ id: String(id), name: String(name), metadata: md });
}

