import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const EVIDENCE_OBJECT_TYPES = Object.freeze([
  "party",
  "relationship",
  "business_subject",
  "request",
  "work",
  "interaction",
  "communication",
  "approval",
  "integration",
  "employee",
  "workflow",
  "analytics_definition",
  "business_os_configuration",
]);

/**
 * Canonical evidence reference — never opaque scores.
 */
export function createEvidenceReference({
  objectType,
  objectId,
  businessId,
  field = null,
  observedValue = null,
  comparison = null,
  threshold = null,
  observedAt = new Date().toISOString(),
  explanation,
} = {}) {
  if (!EVIDENCE_OBJECT_TYPES.includes(String(objectType))) {
    throw new Error(`EvidenceReference: unsupported objectType: ${objectType}`);
  }
  if (!objectId) throw new Error("EvidenceReference: objectId required.");
  if (!businessId) throw new Error("EvidenceReference: businessId required.");
  if (!explanation) throw new Error("EvidenceReference: explanation required.");
  return deepFreeze({
    objectType: String(objectType),
    objectId: String(objectId),
    businessId: String(businessId),
    field: field == null ? null : String(field),
    observedValue: observedValue === undefined ? null : observedValue,
    comparison: comparison == null ? null : String(comparison),
    threshold: threshold === undefined ? null : threshold,
    observedAt: String(observedAt),
    explanation: String(explanation),
  });
}

export function assertEvidenceTenant(evidence, businessId) {
  for (const entry of evidence ?? []) {
    if (String(entry.businessId) !== String(businessId)) {
      throw new Error("EvidenceReference: tenant scope mismatch.");
    }
  }
  return true;
}
