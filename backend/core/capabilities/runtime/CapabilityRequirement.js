import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityRequirement: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

export function createCapabilityRequirement({ id, description } = {}) {
  requireString(id, "id");
  requireString(description, "description");

  return deepFreeze({ id: String(id), description: String(description) });
}

