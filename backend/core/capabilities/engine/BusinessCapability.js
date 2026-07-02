import { deepFreeze } from "./_utils/deepFreeze.js";

/**
 * Canonical BusinessCapability model (derived; never stored).
 */
export function createBusinessCapability(input = {}) {
  const {
    id,
    name,
    description,
    category,
    status,
    health,
    requirements,
    dependencies,
    providedFeatures,
    blockedBy,
    recommendations,
    completionPercent,
    industrySupport,
    metadata,
    lastEvaluatedAt,
  } = input ?? {};

  if (typeof id !== "string" || !id.trim()) throw new Error("BusinessCapability: id required.");
  if (typeof name !== "string" || !name.trim()) throw new Error("BusinessCapability: name required.");
  if (typeof description !== "string") throw new Error("BusinessCapability: description required.");

  const allowedStatuses = new Set([
    "NOT_STARTED",
    "IN_PROGRESS",
    "READY",
    "BLOCKED",
    "DEGRADED",
    "DISABLED",
  ]);
  if (typeof status !== "string" || !allowedStatuses.has(status)) {
    throw new Error(`BusinessCapability: invalid status: ${String(status)}`);
  }

  const completion = typeof completionPercent === "number" && Number.isFinite(completionPercent)
    ? completionPercent
    : 0;
  const completionClamped = Math.max(0, Math.min(100, completion));

  const cap = {
    id: String(id),
    name: String(name),
    description: String(description),
    category: category ? String(category) : "",
    status: String(status),
    health: health ? String(health) : "",
    requirements: Array.isArray(requirements) ? requirements : [],
    dependencies: Array.isArray(dependencies) ? dependencies : [],
    providedFeatures: Array.isArray(providedFeatures) ? providedFeatures : [],
    blockedBy: Array.isArray(blockedBy) ? blockedBy : [],
    recommendations: Array.isArray(recommendations) ? recommendations : [],
    completionPercent: completionClamped,
    industrySupport: industrySupport && typeof industrySupport === "object" ? industrySupport : {},
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    lastEvaluatedAt: lastEvaluatedAt ? String(lastEvaluatedAt) : "",
  };

  return deepFreeze(cap);
}

