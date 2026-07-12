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
      case "q_departments":
        fields.departments = splitList(text);
        break;
      case "q_lead_sources":
        fields.leadSources = splitList(text);
        break;
      case "q_request_sources":
        fields.requestSources = splitList(text);
        break;
      case "q_automation_comfort":
        fields.automationComfort = text;
        break;
      case "q_expansion_plans":
        fields.expansionPlans = splitList(text);
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

  /**
   * Extract structured discovery signals from free-form consultant chat.
   * Returns inferred field patches plus questionIds that can be marked answered.
   */
  extractFromFreeText(text) {
    const raw = String(text ?? "").trim();
    if (!raw) {
      return deepFreeze({ ok: true, fields: {}, answeredQuestionIds: [], note: null });
    }

    const fields = { ...inferFromDescription(raw) };
    const answeredQuestionIds = [];
    const lower = raw.toLowerCase();

    if (fields.industry) answeredQuestionIds.push("q_industry");
    if (fields.services?.length) answeredQuestionIds.push("q_services");
    if (fields.customerTypes?.length) answeredQuestionIds.push("q_customers");

    const nameMatch = raw.match(/(?:we are|we're|company(?: name)? is|called)\s+([A-Z][\w\s&.'-]{1,60})/i);
    if (nameMatch?.[1]) {
      fields.businessName = nameMatch[1]
        .trim()
        .replace(/\s+in\s+.+$/i, "")
        .replace(/[.,].*$/, "")
        .trim();
      answeredQuestionIds.push("q_company_name");
    }

    if (/\b(office|location|city|region|online)\b/i.test(raw)) {
      fields.locations = fields.locations ?? splitList(raw.match(/in ([^.]+)/i)?.[1] ?? raw);
      answeredQuestionIds.push("q_locations");
    }
    if (/\b(hire|hiring|team|staff|employee|agent|hygienist|coach)\b/i.test(lower)) {
      fields.roles = fields.roles ?? splitList(raw);
      answeredQuestionIds.push("q_roles");
    }
    if (/\b(appfolio|gmail|outlook|quickbooks|salesforce|crm|calendar)\b/i.test(lower)) {
      fields.currentSystems = fields.currentSystems ?? splitList(raw);
      answeredQuestionIds.push("q_software", "q_integrations");
    }
    if (/\b(approv|sign[- ]off|must review)\b/i.test(lower)) {
      fields.approvalNeeds = fields.approvalNeeds ?? splitList(raw);
      answeredQuestionIds.push("q_approvals");
    }
    if (/\b(pain|stuck|slow|manual|overwhelm)\b/i.test(lower)) {
      fields.painPoints = fields.painPoints ?? splitList(raw);
      answeredQuestionIds.push("q_pain_points");
    }
    if (/\b(department|leasing team|maintenance team|front desk)\b/i.test(lower)) {
      fields.departments = fields.departments ?? splitList(raw);
      answeredQuestionIds.push("q_departments");
    }
    if (/\b(lead|referral|website|zillow|ads)\b/i.test(lower)) {
      fields.leadSources = fields.leadSources ?? splitList(raw);
      answeredQuestionIds.push("q_lead_sources");
    }
    if (/\b(email|phone|portal|walk[- ]?in|chat)\b/i.test(lower) && /\b(request|ticket|inquiry)\b/i.test(lower)) {
      fields.requestSources = fields.requestSources ?? splitList(raw);
      answeredQuestionIds.push("q_request_sources");
    }
    if (/\b(automat|ai handle|digital employee|comfort)\b/i.test(lower)) {
      fields.automationComfort = fields.automationComfort ?? raw;
      answeredQuestionIds.push("q_automation_comfort");
    }
    if (/\b(expand|another office|new location|grow|hiring more)\b/i.test(lower)) {
      fields.expansionPlans = fields.expansionPlans ?? splitList(raw);
      answeredQuestionIds.push("q_expansion_plans");
    }

    fields.description = fields.description ?? raw;
    answeredQuestionIds.push("q_tell_us");

    return deepFreeze({
      ok: true,
      fields,
      answeredQuestionIds: [...new Set(answeredQuestionIds)],
      note: answeredQuestionIds.length > 1
        ? "I captured what I could from that. I’ll only ask what’s still unclear."
        : "Thanks — I’ll keep asking only what I still need.",
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
