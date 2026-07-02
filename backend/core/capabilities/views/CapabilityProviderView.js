import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilityProviderView({ providerType, status, capabilityCountRequired, capabilityCountCovered, metadata } = {}) {
  return deepFreeze({
    providerType: String(providerType ?? ""),
    status: String(status ?? "available"),
    capabilityCountRequired: Number(capabilityCountRequired ?? 0),
    capabilityCountCovered: Number(capabilityCountCovered ?? 0),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

