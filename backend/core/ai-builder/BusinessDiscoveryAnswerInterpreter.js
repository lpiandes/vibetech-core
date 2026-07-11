import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Interprets answers into structured business summary fields.
 * Deterministic first — AI provider may refine behind an adapter.
 */
export class BusinessDiscoveryAnswerInterpreter {
  interpret({ questionId, answer, unknown = false, skipped = false } = {}) {
    if (skipped) {
      return deepFreeze({ ok: true, skipped: true, fields: {}, unresolved: [questionId] });
    }
    if (unknown || String(answer).trim().toLowerCase() === "i don't know") {
      return deepFreeze({
        ok: true,
        unknown: true,
        fields: {},
        unresolved: [questionId],
        assumption: null,
      });
    }

    const text = String(answer ?? "").trim();
    const fields = {};

    switch (questionId) {
      case "q_company_name":
        fields.businessName = text;
        break;
      case "q_industry":
        fields.industry = normalizeIndustry(text);
        break;
      case "q_services":
        fields.services = splitList(text);
        break;
      case "q_customers":
        fields.customerTypes = splitList(text);
        break;
      case "q_locations":
        fields.locations = splitList(text);
        break;
      case "q_team_size":
        fields.teamSize = text;
        break;
      case "q_roles":
        fields.roles = splitList(text);
        break;
      case "q_software":
        fields.currentSystems = splitList(text);
        break;
      case "q_repetitive_work":
        fields.repetitiveWork = splitList(text);
        break;
      case "q_approvals":
        fields.approvalNeeds = splitList(text);
        break;
      case "q_communications":
        fields.channels = splitList(text);
        break;
      case "q_scheduling":
        fields.scheduling = text;
        break;
      case "q_sales":
        fields.salesProcess = text;
        break;
      case "q_documents":
        fields.documentNeeds = splitList(text);
        break;
      case "q_reporting":
        fields.reportingNeeds = splitList(text);
        break;
      case "q_compliance":
        fields.complianceConcerns = splitList(text);
        break;
      case "q_integrations":
        fields.integrationNeeds = splitList(text);
        break;
      case "q_pain_points":
        fields.painPoints = splitList(text);
        break;
      case "q_desired_outcomes":
        fields.goals = splitList(text);
        break;
      case "q_owner_oversight":
        fields.ownerOversight = text;
        break;
      case "q_tell_us":
        fields.description = text;
        Object.assign(fields, inferFromDescription(text));
        break;
      default:
        fields[`answer_${questionId}`] = text;
    }

    return deepFreeze({
      ok: true,
      skipped: false,
      unknown: false,
      fields,
      unresolved: [],
    });
  }
}

function splitList(text) {
  return String(text)
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeIndustry(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes("propert") || lower.includes("real estate") || lower.includes("leasing")) {
    return "property_management";
  }
  if (lower.includes("dental") || lower.includes("dentist") || lower.includes("orthodont")) {
    return "dental";
  }
  if (lower.includes("hockey") || lower.includes("sport") || lower.includes("travel club")) {
    return "sports";
  }
  if (lower.includes("legal") || lower.includes("law")) return "professional_services";
  return lower.replace(/\s+/g, "_");
}

function inferFromDescription(text) {
  const industry = normalizeIndustry(text);
  const fields = { industry };
  if (industry === "property_management") {
    fields.services = fields.services ?? ["leasing", "maintenance", "owner_communication"];
    fields.customerTypes = fields.customerTypes ?? ["prospect", "resident", "owner"];
  }
  if (industry === "dental") {
    fields.services = fields.services ?? ["exams", "cleanings", "treatment_plans"];
    fields.customerTypes = fields.customerTypes ?? ["patient"];
  }
  if (industry === "sports") {
    fields.services = fields.services ?? ["team_management", "practices", "travel"];
    fields.customerTypes = fields.customerTypes ?? ["player", "parent", "coach"];
  }
  return fields;
}
