function normalizeStr(v) {
  return String(v ?? "").trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

function isNonEmptyArray(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

function validateTimezoneAndHours() {
  // Business Profile does not mandate time zone in this sprint; keep future-proof placeholder for validation logic.
  return { ok: true, issues: [] };
}

function validateBusinessHoursShape() {
  return { ok: true, issues: [] };
}

function isValidRemoteMode(v) {
  const s = normalizeStr(v).toUpperCase();
  return ["REMOTE", "ON_SITE", "HYBRID", "UNKNOWN"].includes(s);
}

function computeCompletionAndValidation(profile) {
  const requiredChecks = [
    { key: "primaryIndustry", ok: normalizeStr(profile?.industry?.primaryIndustry).length > 0, issue: "industry.primaryIndustry required" },
    { key: "industryTemplate.id", ok: normalizeStr(profile?.industry?.industryTemplate?.id).length > 0, issue: "industry.template required" },
    { key: "operatingModel", ok: normalizeStr(profile?.operatingModel).length > 0, issue: "operatingModel required" },
    { key: "businessSegments", ok: isNonEmptyArray(profile?.businessSegments), issue: "businessSegments required" },
    { key: "servicesOffered", ok: isNonEmptyArray(profile?.servicesOffered), issue: "servicesOffered required" },
    { key: "customerTypes", ok: isNonEmptyArray(profile?.customerTypes), issue: "customerTypes required" },
    { key: "serviceAreas", ok: isNonEmptyArray(profile?.serviceAreas), issue: "serviceAreas required" },
    { key: "companySize", ok: normalizeStr(profile?.companySize).length > 0, issue: "companySize required" },
    { key: "languagesSupported", ok: isNonEmptyArray(profile?.languagesSupported), issue: "languagesSupported required" },
    { key: "remoteOrOnsite", ok: isValidRemoteMode(profile?.remoteOrOnsite), issue: "remoteOrOnsite invalid" },
  ];

  const issues = [];
  for (const check of requiredChecks) {
    if (!check.ok) issues.push(check.issue);
  }

  const total = requiredChecks.length;
  const completed = requiredChecks.filter((c) => c.ok).length;
  const completionPercent = total ? Math.round((completed / total) * 100) : 0;
  const ok = issues.length === 0;
  const completionStatus = ok
    ? "COMPLETE"
    : completionPercent > 0
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  return {
    completionPercent,
    validation: { ok, issues },
    completionStatus,
  };
}

export class BusinessProfileValidator {
  static validate({ profile } = {}) {
    if (!profile || typeof profile !== "object") {
      throw new Error("BusinessProfileValidator: profile required.");
    }
    const { completionPercent, validation, completionStatus } = computeCompletionAndValidation(profile);
    return deepFreeze({
      completionPercent,
      completionStatus,
      validation,
    });
  }
}

