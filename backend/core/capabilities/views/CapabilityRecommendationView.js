import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityRecommendationView({ id, type, description, priority, relatedCapabilityIds, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    type: String(type ?? ""),
    description: String(description ?? ""),
    priority: Number(priority ?? 0),
    relatedCapabilityIds: Array.isArray(relatedCapabilityIds) ? deepFreeze(relatedCapabilityIds.map(String)) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

