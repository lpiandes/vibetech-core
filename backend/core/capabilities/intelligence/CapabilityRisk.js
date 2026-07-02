import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityRisk({ id, type, capabilityId, providerType, severity, message, metadata } = {}) {
  const risk = {
    id: String(id ?? `risk_${String(capabilityId ?? "")}_${String(type ?? "unknown")}`),
    type: String(type ?? ""),
    capabilityId: capabilityId === undefined ? null : String(capabilityId),
    providerType: providerType === undefined || providerType === null ? null : String(providerType),
    severity: Number(severity ?? 0),
    message: String(message ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(risk);
}

