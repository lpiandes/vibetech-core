import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityMatch: ${message}`);
}

export function createCapabilityMatch({
  id,
  providerId,
  providerType,
  providerName,
  capabilityIds,
  score,
  confidence,
  matchReasons,
  limitations,
  recommendedAction,
  metadata,
} = {}) {
  if (!id) fail("id required.");
  if (!providerId) fail("providerId required.");
  if (!providerType) fail("providerType required.");
  if (!providerName) fail("providerName required.");
  if (!Array.isArray(capabilityIds)) fail("capabilityIds required array.");
  if (typeof score !== "number" || Number.isNaN(score)) fail("score must be number.");
  if (typeof confidence !== "number" || Number.isNaN(confidence)) fail("confidence must be number.");

  const match = {
    id: String(id),
    providerId: String(providerId),
    providerType: String(providerType),
    providerName: String(providerName),
    capabilityIds: deepFreeze(capabilityIds.map(String)),
    score: Math.max(0, Math.min(100, Math.round(score))),
    confidence: Math.max(0, Math.min(1, confidence)),
    matchReasons: deepFreeze(Array.isArray(matchReasons) ? matchReasons.map(String) : []),
    limitations: deepFreeze(Array.isArray(limitations) ? limitations.map(String) : []),
    recommendedAction: String(recommendedAction ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(match);
}

