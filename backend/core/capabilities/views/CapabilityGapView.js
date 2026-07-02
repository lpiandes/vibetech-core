import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityGapView({ id, capabilityId, name, reason, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    capabilityId: String(capabilityId ?? ""),
    name: String(name ?? ""),
    reason: String(reason ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

