import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityStrength({ id, capabilityId, providerCount, message, metadata } = {}) {
  const s = {
    id: String(id ?? `strength_${String(capabilityId ?? "unknown")}`),
    capabilityId: capabilityId === undefined ? null : String(capabilityId),
    providerCount: Number(providerCount ?? 0),
    message: String(message ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(s);
}

