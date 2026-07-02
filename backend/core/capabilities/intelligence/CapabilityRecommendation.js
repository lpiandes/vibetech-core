import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityRecommendation({
  id,
  type,
  description,
  relatedCapabilityIds,
  priority,
  metadata,
} = {}) {
  const rec = {
    id: String(id ?? `rec_${String(type ?? "unknown")}_${String(relatedCapabilityIds?.[0] ?? "")}`),
    type: String(type ?? ""),
    description: String(description ?? ""),
    relatedCapabilityIds: deepFreeze(Array.isArray(relatedCapabilityIds) ? relatedCapabilityIds.map(String) : []),
    priority: Number(priority ?? 0),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(rec);
}

