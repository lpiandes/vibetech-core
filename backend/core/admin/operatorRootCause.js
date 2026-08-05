/**
 * Mandatory root-cause codes for VIBETech operator interventions (Plan 8).
 * Feeds the product roadmap — never optional on resolve.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const OPERATOR_ROOT_CAUSES = Object.freeze([
  "missing_integration",
  "missing_business_rule",
  "incorrect_identity_match",
  "incorrect_classification",
  "missing_evidence",
  "insufficient_knowledge",
  "provider_failure",
  "unsupported_action",
  "customer_specific_exception",
  "customer_delay",
  "ai_quality_failure",
  "bad_source_data",
]);

export const OPERATOR_ROOT_CAUSE_LABELS = Object.freeze({
  missing_integration: "Missing integration",
  missing_business_rule: "Missing business rule",
  incorrect_identity_match: "Incorrect identity match",
  incorrect_classification: "Incorrect classification",
  missing_evidence: "Missing evidence",
  insufficient_knowledge: "Insufficient knowledge",
  provider_failure: "Provider failure",
  unsupported_action: "Unsupported integration action",
  customer_specific_exception: "Customer-specific exception",
  customer_delay: "Customer delay",
  ai_quality_failure: "AI reasoning failure",
  bad_source_data: "Bad source data",
});

export const OPERATOR_CASE_KINDS = Object.freeze([
  "rft_exception",
  "sla_risk",
  "specialty_fire_failed",
  "approval_backlog",
  "low_confidence",
]);

export function normalizeRootCause(value) {
  const code = String(value ?? "").trim().toLowerCase();
  if (!OPERATOR_ROOT_CAUSES.includes(code)) return null;
  return code;
}

export function assertRootCauseRequired(value) {
  const code = normalizeRootCause(value);
  if (!code) {
    return deepFreeze({
      ok: false,
      code: "root_cause_required",
      message: "Pick a root cause before closing the case (roadmap feed).",
      allowed: [...OPERATOR_ROOT_CAUSES],
    });
  }
  return deepFreeze({
    ok: true,
    rootCause: code,
    label: OPERATOR_ROOT_CAUSE_LABELS[code] ?? code,
  });
}

export function presentRootCauseOptions() {
  return deepFreeze(
    OPERATOR_ROOT_CAUSES.map((code) => ({
      code,
      label: OPERATOR_ROOT_CAUSE_LABELS[code] ?? code,
    })),
  );
}
