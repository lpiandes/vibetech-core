function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredNonEmptyString(v, name) {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`OnboardingStep: expected ${name} to be a non-empty string.`);
  }
}

function optionalObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

const STEP_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
};

function createOnboardingStep(input = {}) {
  requiredNonEmptyString(input.id, "id");
  requiredNonEmptyString(input.title, "title");
  requiredNonEmptyString(input.description, "description");

  const status = String(input.status ?? STEP_STATUS.PENDING);
  if (!Object.values(STEP_STATUS).includes(status)) {
    throw new Error(`OnboardingStep: invalid status: ${status}`);
  }

  const progress = typeof input.progress === "number" && Number.isFinite(input.progress)
    ? input.progress
    : status === STEP_STATUS.COMPLETED || status === STEP_STATUS.SKIPPED
      ? 100
      : 0;

  if (progress < 0 || progress > 100) {
    throw new Error("OnboardingStep: progress must be between 0 and 100.");
  }

  const completedAt = typeof input.completedAt === "string" ? input.completedAt : "";

  const step = {
    id: String(input.id),
    title: String(input.title),
    description: String(input.description),
    status,
    progress,
    requirements: optionalObject(input.requirements),
    completedAt,
    metadata: optionalObject(input.metadata),
  };

  return deepFreeze(step);
}

export { STEP_STATUS };
export { createOnboardingStep };

