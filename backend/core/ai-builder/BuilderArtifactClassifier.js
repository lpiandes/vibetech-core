import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const ARTIFACT_CLASSIFICATIONS = Object.freeze([
  "SOP",
  "policy",
  "service_catalog",
  "price_list",
  "team_roster",
  "CRM_export",
  "customer_list",
  "property_item_inventory",
  "workflow_description",
  "integration_export",
  "knowledge_document",
  "unknown",
]);

/**
 * Classify Builder uploads without mutating canonical business data.
 */
export function classifyBuilderArtifact({ filename = "", mimeType = "", notes = "" } = {}) {
  const blob = `${filename} ${mimeType} ${notes}`.toLowerCase();
  if (/sop|standard operating|playbook/.test(blob)) return "SOP";
  if (/policy|privacy|consent|compliance/.test(blob)) return "policy";
  if (/service.?catalog|services\.|menu of services/.test(blob)) return "service_catalog";
  if (/price|pricing|rate.?card|fee.?schedule/.test(blob)) return "price_list";
  if (/roster|team.?list|staff/.test(blob)) return "team_roster";
  if (/crm|hubspot|salesforce|contacts.?export/.test(blob)) return "CRM_export";
  if (/customer.?list|patient.?list|client.?list/.test(blob)) return "customer_list";
  if (/propert|inventory|listing|asset.?list/.test(blob)) return "property_item_inventory";
  if (/workflow|process.?map|intake.?flow/.test(blob)) return "workflow_description";
  if (/integration|export.?json|api.?dump/.test(blob)) return "integration_export";
  if (/knowledge|faq|handbook|\.md$|\.pdf$|\.docx$/.test(blob)) return "knowledge_document";
  return "unknown";
}

export function extractBuilderArtifactEvidence({
  artifactId,
  filename,
  mimeType = "",
  notes = "",
  textPreview = "",
  classification = null,
} = {}) {
  const classified = classification ?? classifyBuilderArtifact({ filename, mimeType, notes });
  const detected = {
    classification: classified,
    likelyColumns: inferColumns(textPreview, classified),
    rowHints: textPreview ? String(textPreview).split("\n").filter(Boolean).length : 0,
    topics: topicsFor(classified),
  };
  return deepFreeze({
    artifactId: String(artifactId),
    filename: String(filename),
    mimeType: String(mimeType ?? ""),
    classification: classified,
    detected,
    mutatesCanonicalData: false,
    requiresUserConfirmation: true,
    provenance: {
      filename: String(filename),
      classifiedAt: new Date().toISOString(),
      notes: String(notes ?? ""),
    },
  });
}

export function createBuilderArtifactMappingProposal(evidence, { confirmed = false } = {}) {
  const classification = evidence.classification;
  const mapping = {
    SOP: { destination: "business_knowledge", action: "propose_knowledge_document" },
    policy: { destination: "business_knowledge", action: "propose_knowledge_document" },
    knowledge_document: { destination: "business_knowledge", action: "propose_knowledge_document" },
    CRM_export: { destination: "import_pipeline", action: "propose_crm_import_dry_run" },
    customer_list: { destination: "import_pipeline", action: "propose_crm_import_dry_run" },
    property_item_inventory: { destination: "import_pipeline", action: "propose_subject_import_dry_run" },
    team_roster: { destination: "team_setup", action: "propose_team_review" },
    service_catalog: { destination: "specification", action: "propose_service_modules" },
    price_list: { destination: "knowledge", action: "propose_knowledge_document" },
    workflow_description: { destination: "specification", action: "propose_workflow" },
    integration_export: { destination: "integrations", action: "propose_integration_requirement" },
    unknown: { destination: "review", action: "ask_user_to_classify" },
  }[classification] ?? { destination: "review", action: "ask_user_to_classify" };

  return deepFreeze({
    artifactId: evidence.artifactId,
    classification,
    mapping,
    confirmed: Boolean(confirmed),
    mutatesCanonicalData: false,
    explanation: confirmed
      ? `Confirmed as ${classification.replace(/_/g, " ")}. Ready for dry-run or knowledge review — not installed yet.`
      : `Detected as ${classification.replace(/_/g, " ")}. Confirm before we use it.`,
  });
}

function inferColumns(preview, classification) {
  if (!preview) return [];
  const header = String(preview).split("\n")[0] ?? "";
  if (header.includes(",")) return header.split(",").map((entry) => entry.trim()).filter(Boolean).slice(0, 12);
  if (classification === "CRM_export") return ["name", "email", "phone"];
  return [];
}

function topicsFor(classification) {
  if (["CRM_export", "customer_list"].includes(classification)) return ["customers", "people"];
  if (classification === "property_item_inventory") return ["records", "operations"];
  if (["SOP", "policy", "knowledge_document"].includes(classification)) return ["knowledge"];
  if (classification === "workflow_description") return ["operations"];
  return [];
}
