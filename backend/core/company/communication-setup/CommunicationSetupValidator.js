function normalizeStr(v) {
  return String(v ?? "").trim();
}

function isValidEmail(email) {
  const e = normalizeStr(email);
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isValidTimeZone(tz) {
  const s = normalizeStr(tz);
  return /^[A-Za-z_]+\/[A-Za-z_]+$/.test(s);
}

function isValidTimeHHMM(value) {
  const s = normalizeStr(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function validateBusinessHoursShape(businessHours) {
  const bh = businessHours && typeof businessHours === "object" ? businessHours : null;
  if (!bh) return { ok: false, issues: ["businessHours required"] };
  if (!Array.isArray(bh.daysOfWeek) || bh.daysOfWeek.length === 0) {
    return { ok: false, issues: ["businessHours.daysOfWeek required"] };
  }
  if (!isValidTimeHHMM(bh.start)) return { ok: false, issues: ["businessHours.start invalid"] };
  if (!isValidTimeHHMM(bh.end)) return { ok: false, issues: ["businessHours.end invalid"] };
  if (!isValidTimeZone(bh.timeZone)) return { ok: false, issues: ["businessHours.timeZone invalid"] };
  return { ok: true, issues: [] };
}

function validateQuietHours(quietHours) {
  const qh = quietHours && typeof quietHours === "object" ? quietHours : null;
  if (!qh) return { ok: false, issues: ["quietHours required"] };
  if (!isValidTimeZone(qh.timeZone)) return { ok: false, issues: ["quietHours.timeZone invalid"] };
  if (!isValidTimeHHMM(qh.start)) return { ok: false, issues: ["quietHours.start invalid"] };
  if (!isValidTimeHHMM(qh.end)) return { ok: false, issues: ["quietHours.end invalid"] };
  return { ok: true, issues: [] };
}

function computeCompletion({ checks } = {}) {
  const total = checks.length;
  const completed = checks.filter((c) => c.ok).length;
  const completionPercent = total ? Math.round((completed / total) * 100) : 0;
  const completionStatus = completionPercent >= 100 ? "COMPLETE" : completionPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED";
  const ok = checks.every((c) => c.ok);
  return { completionPercent, completionStatus, ok };
}

export function validateCommunicationSetup({ setup } = {}) {
  if (!setup || typeof setup !== "object") throw new Error("validateCommunicationSetup: setup required.");

  const senderNameOk = normalizeStr(setup.sender?.senderName).length > 0;
  const replyEmailOk = isValidEmail(setup.sender?.replyEmail);
  const emailSignatureOk = normalizeStr(setup.emailBranding?.emailSignature).length > 0;
  const emailFooterOk = normalizeStr(setup.emailBranding?.emailFooter).length > 0;
  const businessNameOk = normalizeStr(setup.smsIdentity?.businessName).length > 0;

  const timeZoneOk = isValidTimeZone(setup.communicationDefaults?.timeZone ?? setup.quietHours?.timeZone);
  const businessHoursValidation = validateBusinessHoursShape(setup.communicationDefaults?.businessHours);
  const quietHoursValidation = validateQuietHours(setup.quietHours ?? setup.smsIdentity?.quietHours ?? {});

  // Approval policy: approvalRequiredForFirstContact true implies at least one enabled approval rule exists.
  const approvalRequired = Boolean(setup.communicationDefaults?.approvalRequiredForFirstContact);
  const approvalPolicyOk = (() => {
    const policy = setup.metadata?.approvalPolicy ?? null;
    if (!approvalRequired) return true;
    if (!policy || typeof policy !== "object") return false;
    if (!policy.rulePresent) return false;
    return true;
  })();

  const brandReadyChecks = {
    logoOk: true, // logo is optional; colors/signatures are what matter for readiness.
    colorsOk:
      normalizeStr(setup.emailBranding?.primaryColor).length > 0 &&
      normalizeStr(setup.emailBranding?.secondaryColor).length > 0,
    signatureOk: senderNameOk && emailSignatureOk && emailFooterOk,
  };

  const minimumIdentityChecks = {
    senderNameOk,
    replyEmailOk,
  };

  const checks = [
    { key: "senderName", ok: minimumIdentityChecks.senderNameOk },
    { key: "replyEmail", ok: minimumIdentityChecks.replyEmailOk },
    { key: "emailSignature", ok: emailSignatureOk },
    { key: "emailFooter", ok: emailFooterOk },
    { key: "businessName", ok: businessNameOk },
    { key: "timeZone", ok: timeZoneOk },
    { key: "businessHours", ok: businessHoursValidation.ok },
    { key: "quietHours", ok: quietHoursValidation.ok },
    { key: "approvalPolicy", ok: approvalPolicyOk },
    { key: "minEmailIdentity", ok: replyEmailOk && senderNameOk },
  ];

  const completion = computeCompletion({ checks });
  const issues = checks
    .filter((c) => !c.ok)
    .map((c) => {
      switch (c.key) {
        case "senderName":
          return "senderName required";
        case "replyEmail":
          return "replyEmail required + must be valid email";
        case "emailSignature":
          return "emailSignature required";
        case "emailFooter":
          return "emailFooter required";
        case "businessName":
          return "businessName required";
        case "timeZone":
          return "timeZone invalid";
        case "businessHours":
          return businessHoursValidation.issues[0] ?? "businessHours invalid";
        case "quietHours":
          return quietHoursValidation.issues[0] ?? "quietHours invalid";
        case "approvalPolicy":
          return "approvalPolicy required";
        case "minEmailIdentity":
          return "minimum email identity invalid";
        default:
          return `${c.key} invalid`;
      }
    });

  const readiness = {
    emailReady: senderNameOk && replyEmailOk && emailSignatureOk && emailFooterOk && businessNameOk && timeZoneOk && businessHoursValidation.ok,
    smsReady:
      normalizeStr(setup.smsIdentity?.smsSignature).length > 0 &&
      normalizeStr(setup.smsIdentity?.optOutLanguage).length > 0 &&
      quietHoursValidation.ok,
    brandReady: Boolean(brandReadyChecks.colorsOk) && Boolean(brandReadyChecks.signatureOk),
    quietHoursReady: quietHoursValidation.ok,
    approvalPolicyReady: approvalPolicyOk,
  };

  const validation = {
    ok: completion.ok,
    completionPercent: completion.completionPercent,
    completionStatus: completion.completionStatus,
    issues,
  };

  return { validation, readiness, completionPercent: completion.completionPercent, completionStatus: completion.completionStatus };
}

