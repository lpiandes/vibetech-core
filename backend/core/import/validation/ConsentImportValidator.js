import { parseBoolean } from "../normalizers/ContactFieldNormalizer.js";

const OPT_IN_VALUES = new Set(["opt_in", "opt-in", "opt in", "subscribed", "yes", "true", "1"]);
const OPT_OUT_VALUES = new Set(["opt_out", "opt-out", "opt out", "unsubscribed", "no", "false", "0"]);
const SUPPRESSED_VALUES = new Set(["suppressed", "do_not_contact", "dnc", "do not contact"]);

function mapRawConsent(value, consentMappings = {}, fieldKey) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const mapped = consentMappings?.[fieldKey]?.[raw.toLowerCase()];
  if (mapped) return mapped;

  const lower = raw.toLowerCase();
  if (OPT_IN_VALUES.has(lower)) return "opt_in";
  if (OPT_OUT_VALUES.has(lower) || SUPPRESSED_VALUES.has(lower)) {
    return SUPPRESSED_VALUES.has(lower) ? "suppressed" : "opt_out";
  }
  return null;
}

/**
 * Returns planned consent records only when explicit mapped evidence exists.
 * Contact information alone never produces consent.
 */
export function planConsentFromRow({ normalizedRow, profile, sourceSystem } = {}) {
  const consentMappings = profile?.consentMappings ?? {};
  const planned = [];
  const warnings = [];

  const dnc = normalizedRow.doNotContact === true;
  const emailOptOut = normalizedRow.emailOptOut === true || dnc;
  const smsOptOut = normalizedRow.smsOptOut === true || dnc;

  const emailStatus = emailOptOut
    ? "opt_out"
    : mapRawConsent(normalizedRow.emailOptIn, consentMappings, "emailOptIn");
  const smsStatus = smsOptOut
    ? "suppressed"
    : mapRawConsent(normalizedRow.smsOptIn, consentMappings, "smsOptIn");

  const evidenceBase = {
    source: normalizedRow.consentSource ? String(normalizedRow.consentSource) : `crm_import:${sourceSystem}`,
    recordedAt: normalizedRow.consentTimestamp ?? null,
  };

  if (emailStatus) {
    planned.push({
      channel: "email",
      scope: "all",
      status: emailStatus,
      ...evidenceBase,
      externalReference: normalizedRow.externalContactId
        ? `${sourceSystem}:${normalizedRow.externalContactId}:email_consent`
        : null,
    });
  }

  if (smsStatus) {
    planned.push({
      channel: "sms",
      scope: "all",
      status: smsStatus,
      ...evidenceBase,
      externalReference: normalizedRow.externalContactId
        ? `${sourceSystem}:${normalizedRow.externalContactId}:sms_consent`
        : null,
    });
  }

  if (
    !planned.length &&
    (normalizedRow.emailOptIn !== null ||
      normalizedRow.smsOptIn !== null ||
      String(normalizedRow.emailOptIn ?? "") !== "" ||
      String(normalizedRow.smsOptIn ?? ""))
  ) {
    const unrecognized =
      (normalizedRow.emailOptIn !== null && !emailStatus) || (normalizedRow.smsOptIn !== null && !smsStatus);
    if (unrecognized) {
      warnings.push({
        code: "unrecognized_consent_value",
        message: "Consent column present but value could not be mapped.",
      });
    }
  }

  return { planned, warnings };
}

export function hasExplicitConsentEvidence(normalizedRow) {
  return (
    normalizedRow.emailOptIn !== null ||
    normalizedRow.emailOptOut === true ||
    normalizedRow.smsOptIn !== null ||
    normalizedRow.smsOptOut === true ||
    normalizedRow.doNotContact === true ||
    Boolean(normalizedRow.consentSource) ||
    Boolean(normalizedRow.consentTimestamp)
  );
}

// re-export for tests
export { parseBoolean };
