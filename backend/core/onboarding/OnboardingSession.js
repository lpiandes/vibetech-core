function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredNonEmptyString(v, name) {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`OnboardingSession: expected ${name} to be a non-empty string.`);
  }
}

function createOnboardingSession(input = {}) {
  requiredNonEmptyString(input.sessionId, "sessionId");
  requiredNonEmptyString(input.companyId, "companyId");

  const createdAtISO = typeof input.createdAtISO === "string" ? input.createdAtISO : "";
  const updatedAtISO = typeof input.updatedAtISO === "string" ? input.updatedAtISO : "";

  if (!createdAtISO || !updatedAtISO) {
    throw new Error("OnboardingSession: createdAtISO and updatedAtISO are required ISO strings.");
  }

  const session = {
    sessionId: String(input.sessionId),
    companyId: String(input.companyId),
    templateId: String(input.templateId ?? ""),
    status: String(input.status ?? "IN_PROGRESS"),
    startedAtISO: String(input.startedAtISO ?? createdAtISO),
    completedAtISO: String(input.completedAtISO ?? ""),
    validationStatus: String(input.validationStatus ?? "IN_PROGRESS"),
    createdAtISO,
    updatedAtISO,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };

  return deepFreeze(session);
}

export { createOnboardingSession };

