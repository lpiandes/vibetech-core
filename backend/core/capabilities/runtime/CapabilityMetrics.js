import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityMetrics: ${message}`);
}

function safeRecord(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) fail("expected record object.");
  return obj;
}

export function createCapabilityMetrics({
  totalCapabilities,
  activeCapabilities,
  capabilitiesByCategory,
  capabilitiesByProvider,
} = {}) {
  if (typeof totalCapabilities !== "number") fail("totalCapabilities must be number.");
  if (typeof activeCapabilities !== "number") fail("activeCapabilities must be number.");
  const byCategory = safeRecord(capabilitiesByCategory ?? {});
  const byProvider = safeRecord(capabilitiesByProvider ?? {});

  const metrics = {
    totalCapabilities,
    activeCapabilities,
    capabilitiesByCategory: deepFreeze(
      Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [String(k), Number(v)])),
    ),
    capabilitiesByProvider: deepFreeze(
      Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [String(k), Number(v)])),
    ),
  };

  return deepFreeze(metrics);
}

