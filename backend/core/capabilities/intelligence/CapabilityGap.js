import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityGap({ id, capabilityId, reason } = {}) {
  const gap = {
    id: String(id ?? `gap_${String(capabilityId ?? "unknown")}_${String(reason ?? "unknown")}`),
    capabilityId: capabilityId === undefined ? null : String(capabilityId),
    reason: String(reason ?? ""),
  };
  return deepFreeze(gap);
}

