import { CAPABILITY_PROVIDER_TYPES } from "./CapabilityMatchDefaults.js";

function fail(message) {
  throw new Error(`CapabilityMatchValidator: ${message}`);
}

export function validateCapabilityMatch(match) {
  if (!match || typeof match !== "object") fail("match required.");
  if (!Object.isFrozen(match)) fail("match must be frozen.");
  if (!match.id) fail("match.id required.");
  if (!match.providerId) fail("match.providerId required.");
  if (!match.providerType) fail("match.providerType required.");
  if (!CAPABILITY_PROVIDER_TYPES.includes(String(match.providerType))) fail(`unsupported providerType: ${String(match.providerType)}`);
  if (!match.providerName) fail("match.providerName required.");
  if (!Array.isArray(match.capabilityIds)) fail("match.capabilityIds required array.");
  if (typeof match.score !== "number") fail("match.score required number.");
  if (typeof match.confidence !== "number") fail("match.confidence required number.");
  if (!Array.isArray(match.matchReasons)) fail("match.matchReasons required array.");
  if (!Array.isArray(match.limitations)) fail("match.limitations required array.");
  if (typeof match.recommendedAction !== "string") fail("match.recommendedAction required string.");
  return true;
}

export function validateCapabilityMatchResult(result) {
  if (!result || typeof result !== "object") fail("result required.");
  if (!Object.isFrozen(result)) fail("result must be frozen.");
  if (!result.matchResultId) fail("matchResultId required.");
  if (!result.workItemId) fail("workItemId required.");
  if (!result.generatedAt) fail("generatedAt required.");
  if (!Array.isArray(result.requiredCapabilities)) fail("requiredCapabilities required array.");
  if (!Array.isArray(result.matches)) fail("matches required array.");
  if (result.bestMatch !== null && result.bestMatch !== undefined && typeof result.bestMatch !== "object") fail("bestMatch must be object or null.");
  if (!Array.isArray(result.unmatchedRequirements)) fail("unmatchedRequirements required array.");

  for (const m of result.matches) validateCapabilityMatch(m);
  return true;
}

