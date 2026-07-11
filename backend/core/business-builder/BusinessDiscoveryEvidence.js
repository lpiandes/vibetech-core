import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const DISCOVERY_UPLOAD_KINDS = Object.freeze([
  "business_knowledge",
  "configuration_evidence",
  "crm_import",
  "subject_import",
  "service_catalog",
  "team_roster",
  "process_sop",
  "integration_export",
  "unknown_review",
]);

/**
 * Evidence records for discovery. Never auto-mutates canonical business data.
 */
export function createDiscoveryEvidence({
  evidenceId,
  kind,
  label,
  source = "upload",
  confidence = 0.6,
  payload = {},
  retrievedAt = new Date().toISOString(),
} = {}) {
  return deepFreeze({
    evidenceId: String(evidenceId),
    kind: DISCOVERY_UPLOAD_KINDS.includes(kind) ? kind : (kind === "website_research" ? "website_research" : "unknown_review"),
    label: String(label ?? kind),
    source: String(source),
    confidence: Number(confidence),
    payload: deepFreeze(payload),
    retrievedAt: String(retrievedAt),
    mutatesCanonicalData: false,
  });
}

export function classifyDiscoveryUpload({ filename = "", mimeType = "", notes = "" } = {}) {
  const blob = `${filename} ${mimeType} ${notes}`.toLowerCase();
  if (/crm|contact|people|customer/.test(blob)) return "crm_import";
  if (/propert|listing|patient|matter|player|subject/.test(blob)) return "subject_import";
  if (/sop|process|playbook|policy/.test(blob)) return "process_sop";
  if (/roster|team|staff|employee/.test(blob)) return "team_roster";
  if (/service|menu|catalog|offering/.test(blob)) return "service_catalog";
  if (/integration|export|appfolio|quickbooks/.test(blob)) return "integration_export";
  if (/knowledge|faq|guide|manual/.test(blob)) return "business_knowledge";
  if (/config|settings/.test(blob)) return "configuration_evidence";
  return "unknown_review";
}
