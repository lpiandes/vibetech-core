import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AutomationTrigger: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

export function createAutomationTrigger({
  eventType,
  sourceTypes,
  filters,
  metadata,
} = {}) {
  requireString(eventType, "eventType");
  return deepFreeze({
    eventType: String(eventType),
    sourceTypes: Array.isArray(sourceTypes) ? deepFreeze(sourceTypes.map((x) => String(x))) : deepFreeze([]),
    filters: filters && typeof filters === "object" && !Array.isArray(filters) ? deepFreeze(filters) : deepFreeze({}),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  });
}
