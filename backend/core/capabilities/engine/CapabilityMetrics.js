function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function computeOverallHealth(capabilities) {
  const readyCount = capabilities.filter((c) => c.status === "READY").length;
  if (!capabilities.length) return "DEGRADED";
  if (readyCount === capabilities.length) return "HEALTHY";
  return "DEGRADED";
}

function computeOverallReadiness(capabilities) {
  const blockedCount = capabilities.filter((c) => c.status === "BLOCKED").length;
  const disabledCount = capabilities.filter((c) => c.status === "DISABLED").length;
  const readyCount = capabilities.filter((c) => c.status === "READY").length;

  const effectiveCount = capabilities.length - disabledCount;
  if (effectiveCount <= 0) return "DISABLED";
  if (readyCount === effectiveCount) return "READY";
  if (readyCount === 0 && blockedCount > 0) return "BLOCKED";
  if (readyCount > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function computeCapabilityMetrics({ capabilities } = {}) {
  const caps = Array.isArray(capabilities) ? capabilities : [];

  const ready = caps.filter((c) => c.status === "READY").length;
  const blocked = caps.filter((c) => c.status === "BLOCKED").length;
  const degraded = caps.filter((c) => c.status === "DEGRADED").length;
  const disabled = caps.filter((c) => c.status === "DISABLED").length;

  const completionPercent = caps.length
    ? caps.reduce((sum, c) => sum + (typeof c.completionPercent === "number" ? c.completionPercent : 0), 0) /
      caps.length
    : 0;

  const overallHealth = computeOverallHealth(caps);
  const overallReadiness = computeOverallReadiness(caps);

  const metrics = {
    overallReadiness,
    overallHealth,
    completedCapabilities: ready,
    blockedCapabilities: blocked,
    degradedCapabilities: degraded,
    disabledCapabilities: disabled,
    completionPercentage: completionPercent,
  };

  return deepFreeze(metrics);
}

