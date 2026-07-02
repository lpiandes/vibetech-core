function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function createOnboardingProgress({ steps } = {}) {
  const total = Array.isArray(steps) ? steps.length : 0;
  const completed = (steps ?? []).filter((s) => s.status === "COMPLETED").length;
  const skipped = (steps ?? []).filter((s) => s.status === "SKIPPED").length;
  const pending = (steps ?? []).filter((s) => s.status === "PENDING").length;

  const completedOrSkipped = completed + skipped;
  const completionPercent = total ? (completedOrSkipped / total) * 100 : 0;

  const currentStep = (steps ?? []).find((s) => s.status === "PENDING") ?? null;

  const progress = {
    totalSteps: total,
    completedSteps: completed,
    skippedSteps: skipped,
    pendingSteps: pending,
    completedOrSkippedSteps: completedOrSkipped,
    completionPercent,
    currentStepId: currentStep?.id ?? null,
  };

  return deepFreeze(progress);
}

export { createOnboardingProgress };

