function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function createOnboardingMetrics({ session, steps, nowISO } = {}) {
  const total = Array.isArray(steps) ? steps.length : 0;
  const completed = (steps ?? []).filter((s) => s.status === "COMPLETED").length;
  const skipped = (steps ?? []).filter((s) => s.status === "SKIPPED").length;

  const completedAtISO = (steps ?? [])
    .map((s) => s.completedAt)
    .filter(Boolean)
    .sort()
    .pop();

  const elapsedMs = (() => {
    const startedAtISO = session?.startedAtISO;
    if (!startedAtISO) return 0;
    const end = session?.completedAtISO || nowISO || startedAtISO;
    const startTs = new Date(startedAtISO).getTime();
    const endTs = new Date(end).getTime();
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return 0;
    return Math.max(0, endTs - startTs);
  })();

  const metrics = {
    totalSteps: total,
    completedSteps: completed,
    skippedSteps: skipped,
    completionPercent: total ? ((completed + skipped) / total) * 100 : 0,
    elapsedMs,
    startedAtISO: session?.startedAtISO ?? "",
    completedAtISO: session?.completedAtISO ?? completedAtISO ?? "",
    pendingSteps: (steps ?? []).filter((s) => s.status === "PENDING").map((s) => s.id),
  };

  return deepFreeze(metrics);
}

export { createOnboardingMetrics };

