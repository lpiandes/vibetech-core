import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityRiskView({ id, type, capabilityId, providerType, severity, message, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    type: String(type ?? ""),
    capabilityId: capabilityId === null || capabilityId === undefined ? null : String(capabilityId),
    providerType: providerType === null || providerType === undefined ? null : String(providerType),
    severity: Number(severity ?? 0),
    message: String(message ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

