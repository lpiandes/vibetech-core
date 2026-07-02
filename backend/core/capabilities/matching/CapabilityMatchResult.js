import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityMatchResult: ${message}`);
}

export function createCapabilityMatchResult({
  matchResultId,
  workItemId,
  generatedAt,
  requiredCapabilities,
  matches,
  bestMatch,
  unmatchedRequirements,
  summary,
  metadata,
} = {}) {
  if (!matchResultId) fail("matchResultId required.");
  if (!workItemId) fail("workItemId required.");
  if (!generatedAt) fail("generatedAt required.");
  if (!Array.isArray(requiredCapabilities)) fail("requiredCapabilities required array.");
  if (!Array.isArray(matches)) fail("matches required array.");
  if (bestMatch !== null && bestMatch !== undefined && typeof bestMatch !== "object") fail("bestMatch must be object or null.");

  const res = {
    matchResultId: String(matchResultId),
    workItemId: String(workItemId),
    generatedAt: String(generatedAt),
    requiredCapabilities: deepFreeze(requiredCapabilities.map(String)),
    matches: deepFreeze(matches),
    bestMatch: bestMatch ? deepFreeze(bestMatch) : null,
    unmatchedRequirements: deepFreeze(Array.isArray(unmatchedRequirements) ? unmatchedRequirements.map(String) : []),
    summary: String(summary ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(res);
}

