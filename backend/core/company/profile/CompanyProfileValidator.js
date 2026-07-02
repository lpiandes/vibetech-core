function normalizeStr(v) {
  return String(v ?? "").trim();
}

function isValidEmail(email) {
  const e = normalizeStr(email);
  if (!e) return false;
  // Simple deterministic email regex (no DNS validation).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isValidWebsite(website) {
  const w = normalizeStr(website);
  if (!w) return false;
  // Accept http/https or raw domain.
  const s = w.toLowerCase();
  if (!s.includes(".")) return false;
  if (s.startsWith("http://") || s.startsWith("https://")) return /^[a-z0-9.-]+\.[a-z]{2,}.*$/i.test(s.replace(/^https?:\/\//, ""));
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s);
}

function isValidTimeZone(tz) {
  const s = normalizeStr(tz);
  // Validate IANA-like pattern without requiring an exhaustive list.
  return /^[A-Za-z_]+\/[A-Za-z_]+$/.test(s);
}

function isValidTimeHHMM(value) {
  const s = normalizeStr(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function validateBusinessHours(businessHours) {
  const bh = businessHours && typeof businessHours === "object" ? businessHours : null;
  if (!bh) return { ok: false, issues: ["businessHours required"] };
  if (!Array.isArray(bh.daysOfWeek) || bh.daysOfWeek.length === 0) return { ok: false, issues: ["businessHours.daysOfWeek required"] };
  if (!isValidTimeHHMM(bh.start)) return { ok: false, issues: ["businessHours.start invalid"] };
  if (!isValidTimeHHMM(bh.end)) return { ok: false, issues: ["businessHours.end invalid"] };
  if (!String(bh.timeZone ?? "").trim()) return { ok: false, issues: ["businessHours.timeZone required"] };
  if (!isValidTimeZone(bh.timeZone)) return { ok: false, issues: ["businessHours.timeZone invalid"] };
  return { ok: true, issues: [] };
}

function computeCompletionAndValidation({ profile } = {}) {
  const issues = [];
  const requiredChecks = [];
  const optionalCompletionChecks = [];

  // Required checks: these determine validation “ok”.
  requiredChecks.push({
    key: "companyName",
    valid: normalizeStr(profile?.general?.companyName).length > 0,
    issue: "companyName required",
  });
  requiredChecks.push({
    key: "industry",
    valid: normalizeStr(profile?.general?.industry).length > 0,
    issue: "industry required",
  });
  requiredChecks.push({
    key: "operations.timeZone",
    valid: isValidTimeZone(profile?.operations?.timeZone),
    issue: "operations.timeZone invalid",
  });
  requiredChecks.push({
    key: "operations.businessHours",
    valid: validateBusinessHours(profile?.operations?.businessHours).ok,
    issue: "operations.businessHours invalid",
  });
  requiredChecks.push({
    key: "preferences.currency",
    valid: normalizeStr(profile?.preferences?.currency).length > 0,
    issue: "preferences.currency required",
  });
  requiredChecks.push({
    key: "communications.senderName",
    valid: normalizeStr(profile?.communications?.senderName).length > 0,
    issue: "communications.senderName required",
  });

  // Optional fields contribute to completion percentage.
  // If provided, they must be valid; if missing, they count as incomplete.
  optionalCompletionChecks.push({
    key: "website",
    present: normalizeStr(profile?.general?.website).length > 0,
    valid: isValidWebsite(profile?.general?.website),
    issue: "website must be valid",
  });
  optionalCompletionChecks.push({
    key: "primaryContact.email",
    present: normalizeStr(profile?.general?.primaryContact?.email).length > 0,
    valid: isValidEmail(profile?.general?.primaryContact?.email),
    issue: "primaryContact.email must be valid",
  });
  optionalCompletionChecks.push({
    key: "primaryContact.phone",
    present: normalizeStr(profile?.general?.primaryContact?.phone).length > 0,
    valid: normalizeStr(profile?.general?.primaryContact?.phone).length >= 7,
    issue: "primaryContact.phone invalid",
  });
  optionalCompletionChecks.push({
    key: "address.line1/city/state",
    present:
      normalizeStr(profile?.general?.address?.line1).length > 0 ||
      normalizeStr(profile?.general?.address?.city).length > 0 ||
      normalizeStr(profile?.general?.address?.state).length > 0,
    valid:
      normalizeStr(profile?.general?.address?.line1).length > 0 &&
      normalizeStr(profile?.general?.address?.city).length > 0 &&
      normalizeStr(profile?.general?.address?.state).length > 0,
    issue: "address must include line1, city, and state",
  });

  // Run required validations.
  for (const check of requiredChecks) {
    if (!check.valid) issues.push(check.issue);
  }

  // Run optional format validations only when present.
  for (const opt of optionalCompletionChecks) {
    if (opt.present && !opt.valid) issues.push(opt.issue);
  }

  const total = requiredChecks.length + optionalCompletionChecks.length;
  const completedRequired = requiredChecks.filter((c) => c.valid).length;
  const completedOptional = optionalCompletionChecks.filter((c) => c.present && c.valid).length;
  const completionPercent = total ? Math.round(((completedRequired + completedOptional) / total) * 100) : 0;

  const validationOk = issues.length === 0;
  const completionStatus =
    completionPercent >= 100 ? "COMPLETE" : completionPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED";

  return {
    validation: {
      ok: validationOk,
      issues: issues,
    },
    completionPercent,
    completionStatus,
  };
}

export class CompanyProfileValidator {
  static validate({ profile } = {}) {
    const normalized = computeCompletionAndValidation({ profile });
    return Object.freeze(normalized);
  }
}

