import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isUsableBusinessName, resolveIndustryLabel } from "./businessIdentity.js";
import { deriveRequiredSetupSteps } from "./requiredSetupSteps.js";

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
        if (!isUsableBusinessName(text)) {
          return deepFreeze({
            ok: true,
            unknown: true,
            fields: {},
            unresolved: [questionId],
            assumption: null,
            message: "That does not look like a company name. What is the business called?",
          });
        }
        fields.businessName = text;
        break;
      case "q_industry":
        fields.industry = normalizeIndustry(text);
        fields.industryLabel = text;
        break;
      case "q_services":
        fields.services = splitList(text);
        break;
      case "q_customers":
        fields.customerTypes = splitList(text);
        break;
      case "q_value_promise":
        fields.valuePromise = text;
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
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_repetitive_work":
        fields.repetitiveWork = splitList(text);
        break;
      case "q_desired_workflows":
        fields.desiredWorkflows = splitList(text);
        fields.primaryWorkflow = text;
        break;
      case "q_bottlenecks":
        fields.bottlenecks = splitList(text);
        break;
      case "q_approvals":
        fields.approvalNeeds = splitList(text);
        break;
      case "q_communications":
        fields.channels = splitList(text);
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_scheduling":
        fields.scheduling = text;
        if (/\b(yes|appoint|schedule|calendar|visit|showing|practice|game|chair)\b/i.test(text)) {
          fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, ["calendar"]);
        }
        break;
      case "q_sales":
        fields.salesProcess = text;
        break;
      case "q_documents":
        fields.documentNeeds = splitList(text);
        break;
      case "q_website":
        fields.websiteUrl = text;
        break;
      case "q_reporting":
        fields.reportingNeeds = splitList(text);
        break;
      case "q_compliance":
        fields.complianceConcerns = splitList(text);
        break;
      case "q_integrations":
        fields.integrationNeeds = normalizeIntegrationNeeds(text);
        fields.ownerWillConnectAccounts = !/\bnone\b/i.test(text);
        fields.connectionSetupNote =
          "Owner must sign into each selected account in Integrations after approving the plan.";
        fields.requiredSetupSteps = deriveRequiredSetupSteps(fields.integrationNeeds);
        break;
      case "q_pain_points":
        fields.painPoints = splitList(text);
        break;
      case "q_desired_outcomes":
        fields.goals = splitList(text);
        break;
      case "q_digital_workforce":
        fields.desiredWorkforce = text;
        fields.requestedEmployees = splitList(text);
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
      case "q_business_understanding":
        fields.description = text;
        Object.assign(fields, inferFromDescription(text));
        Object.assign(fields, inferNeedsFromDescription(text));
        break;
      case "q_vibetech_responsibilities":
        fields.requestedResponsibilities = text;
        Object.assign(fields, inferNeedsFromDescription(text));
        break;
      case "q_property_inquiries":
        fields.propertyInquirySources = splitList(text);
        fields.firstReplyRequirements = text;
        break;
      case "q_property_newsletter":
        fields.recurringUpdates = text;
        break;
      case "q_property_units":
        fields.portfolioShape = text;
        break;
      case "q_property_pms":
        fields.propertyManagementSoftware = text;
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_property_priorities":
        fields.audiencePriorities = splitList(text);
        break;
      case "q_dental_pms":
        fields.practiceManagementSoftware = text;
        break;
      case "q_dental_billing":
        fields.billingModel = text;
        break;
      case "q_dental_recall":
        fields.recallCadence = text;
        break;
      case "q_dental_appointment_model":
        fields.appointmentModel = text;
        if (/\b(online|book|schedule|calendar)\b/i.test(text)) {
          fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, ["calendar"]);
        }
        break;
      case "q_dental_first_reply":
        fields.firstPatientReplyRequirements = text;
        break;
      case "q_sports_teams":
        fields.teamsAndPrograms = splitList(text);
        break;
      case "q_sports_schedule":
        fields.scheduleCoordination = text;
        break;
      case "q_sports_fundraising":
        fields.fundraisingNeeds = splitList(text);
        break;
      case "q_sports_opponents":
        fields.opponentsAndFacilities = text;
        break;
      case "q_sports_parent_comms":
        fields.parentPlayerCommunications = splitList(text);
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_proservices_engagement":
        fields.engagementModel = text;
        break;
      case "q_proservices_billing":
        fields.billingModel = text;
        break;
      case "q_proservices_intake":
        fields.clientIntakeProcess = text;
        break;
      case "q_proservices_client_comms":
        fields.clientCommunicationNorms = text;
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_proservices_deliverables":
        fields.deliverableApprovals = splitList(text);
        break;
      case "q_campaign_race_type":
        fields.campaignRaceType = text;
        break;
      case "q_campaign_geography":
        fields.campaignGeography = splitList(text);
        break;
      case "q_campaign_audiences":
        fields.campaignAudiences = splitList(text);
        break;
      case "q_campaign_compliance":
        fields.campaignCompliance = splitList(text);
        break;
      case "q_campaign_channels":
        fields.campaignChannels = splitList(text);
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_campaign_ai_restrictions":
        fields.aiRestrictions = splitList(text);
        break;
      case "q_other_vertical_shape":
        fields.verticalShape = text;
        break;
      case "q_other_primary_workflow":
        fields.primaryWorkflow = text;
        break;
      case "q_other_communication_priority":
        fields.communicationPriority = text;
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_other_campaign_race":
        fields.campaignRaceType = text;
        break;
      case "q_other_campaign_audiences":
        fields.campaignAudiences = splitList(text);
        break;
      case "q_other_campaign_restrictions":
        fields.aiRestrictions = splitList(text);
        break;
      case "q_other_clinic_scheduling":
        fields.appointmentModel = text;
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, ["calendar"]);
        break;
      case "q_other_clinic_intake":
        fields.clientIntakeProcess = text;
        break;
      case "q_other_clinic_billing":
        fields.billingModel = text;
        break;
      case "q_other_club_programs":
        fields.teamsAndPrograms = splitList(text);
        break;
      case "q_other_club_schedule":
        fields.scheduleCoordination = text;
        break;
      case "q_other_club_families":
        fields.parentPlayerCommunications = splitList(text);
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      case "q_other_agency_clients":
        fields.clientTypes = splitList(text);
        break;
      case "q_other_agency_deliverables":
        fields.deliverableApprovals = splitList(text);
        break;
      case "q_other_agency_billing":
        fields.billingModel = text;
        break;
      case "q_other_faith_community":
        fields.communityShape = text;
        break;
      case "q_other_faith_events":
        fields.recurringEvents = splitList(text);
        break;
      case "q_other_faith_outreach":
        fields.outreachChannels = splitList(text);
        fields.integrationNeeds = mergeIntegrationNeeds(fields.integrationNeeds, normalizeIntegrationNeeds(text));
        break;
      default:
        fields[`answer_${questionId}`] = text;
    }

    if (fields.integrationNeeds?.length) {
      fields.requiredSetupSteps = deriveRequiredSetupSteps(fields.integrationNeeds);
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

    const nameMatch = raw.match(/(?:we are|we're|company(?: name)? is|called)\s+([A-Z][\w\s&.'-]{1,60})/i);
    if (nameMatch?.[1]) {
      const extractedName = nameMatch[1]
        .trim()
        .replace(/\s+in\s+.+$/i, "")
        .replace(/[.,].*$/, "")
        .trim();
      if (isUsableBusinessName(extractedName)) {
        fields.businessName = extractedName;
        answeredQuestionIds.push("q_company_name");
      }
    }

    if (/\b(office|location|city|region|online)\b/i.test(raw)) {
      fields.locations = fields.locations ?? splitList(raw.match(/in ([^.]+)/i)?.[1] ?? raw);
    }
    if (/\b(hire|hiring|team|staff|employee|agent|hygienist|coach)\b/i.test(lower)) {
      fields.roles = fields.roles ?? splitList(raw);
    }
    if (/\b(appfolio|gmail|outlook|quickbooks|salesforce|crm|calendar|twilio|facebook|meta)\b/i.test(lower)) {
      fields.currentSystems = fields.currentSystems ?? splitList(raw);
      fields.integrationNeeds = mergeIntegrationNeeds(
        fields.integrationNeeds,
        normalizeIntegrationNeeds(raw),
      );
      answeredQuestionIds.push("q_software");
    }
    if (/\b(approv|sign[- ]off|must review)\b/i.test(lower)) {
      fields.approvalNeeds = fields.approvalNeeds ?? splitList(raw);
    }
    if (/\b(stuck|bottleneck|backlog|waiting on)\b/i.test(lower)) {
      fields.bottlenecks = fields.bottlenecks ?? splitList(raw);
    }
    if (/\b(pain|slow|manual|overwhelm)\b/i.test(lower)) {
      fields.painPoints = fields.painPoints ?? splitList(raw);
    }
    if (/\b(hire us for|customers hire|outcome|promise)\b/i.test(lower)) {
      fields.valuePromise = fields.valuePromise ?? raw;
    }
    if (/\b(department|leasing team|maintenance team|front desk)\b/i.test(lower)) {
      fields.departments = fields.departments ?? splitList(raw);
    }
    if (/\b(lead|referral|website|zillow|ads)\b/i.test(lower)) {
      fields.leadSources = fields.leadSources ?? splitList(raw);
    }
    if (/\b(email|phone|portal|walk[- ]?in|chat)\b/i.test(lower) && /\b(request|ticket|inquiry)\b/i.test(lower)) {
      fields.requestSources = fields.requestSources ?? splitList(raw);
    }
    if (/\b(automat|ai handle|digital employee|comfort)\b/i.test(lower)) {
      fields.automationComfort = fields.automationComfort ?? raw;
    }
    if (/\b(expand|another office|new location|grow|hiring more)\b/i.test(lower)) {
      fields.expansionPlans = fields.expansionPlans ?? splitList(raw);
    }

    fields.description = fields.description ?? raw;
    answeredQuestionIds.push("q_tell_us");

    if (fields.integrationNeeds?.length) {
      fields.requiredSetupSteps = deriveRequiredSetupSteps(fields.integrationNeeds);
    }

    return deepFreeze({
      ok: true,
      fields,
      answeredQuestionIds: [...new Set(answeredQuestionIds)],
      note: null,
    });
  }
}

function mergeIntegrationNeeds(existing = [], next = []) {
  return [...new Set([...(existing ?? []), ...(next ?? [])])];
}

function splitList(text) {
  return String(text)
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Map free-text / choice answers onto connection-center ids.
 * Owners still must sign in — this only records what they intend to connect.
 */
export function normalizeIntegrationNeeds(text) {
  const lower = String(text ?? "").toLowerCase();
  if (!lower.trim() || /\bnone(?:\s+yet)?\b/.test(lower)) return [];

  const out = new Set();
  if (/\b(gmail|google\s*mail|business\s*email|email)\b/.test(lower)) out.add("business_email");
  if (/\b(google\s*calendar|calendar|calendly|outlook\s*calendar)\b/.test(lower)) out.add("calendar");
  if (/\b(sms|text(?:ing| message)?|twilio(?:\s*sms)?)\b/.test(lower)) out.add("sms_channel");
  if (/\b(phone|voice|call(?:ing)?|twilio(?:\s*voice)?)\b/.test(lower)) out.add("voice_channel");
  if (/\b(facebook\s*lead\s*ads?|meta\s*lead\s*ads?|lead\s*ads?|fb\s*leads?)\b/.test(lower)) out.add("meta_lead_ads");
  if (/\bmeta\s*ads?|facebook\s*ads?|instagram\s*ads?\b/.test(lower)) out.add("meta_ads");
  if (/\bgoogle\s*ads?|adwords\b/.test(lower)) out.add("google_ads");
  if (/\b(search\s*console|seo)\b/.test(lower)) out.add("google_search_console");
  if (/\b(pms|appfolio|property\s*management)\b/.test(lower)) out.add("property_management_system");

  for (const token of lower.split(/[^a-z0-9_]+/)) {
    if (token === "gmail" || token === "business_email") out.add("business_email");
    if (token === "google_calendar" || token === "calendar") out.add("calendar");
    if (token === "twilio_sms" || token === "sms_channel") out.add("sms_channel");
    if (token === "twilio_voice" || token === "voice_channel") out.add("voice_channel");
    if (token === "meta_platform") {
      out.add("meta_ads");
      out.add("meta_lead_ads");
    }
    if (token === "facebook_lead_ads" || token === "meta_lead_ads") out.add("meta_lead_ads");
    if (token === "google_ads") out.add("google_ads");
    if (token === "google_search_console" || token === "seo") out.add("google_search_console");
    if (token === "meta_ads" || token === "facebook_ads") out.add("meta_ads");
  }

  return [...out];
}

function normalizeIndustry(text) {
  const lower = String(text ?? "").toLowerCase().trim();
  if (!lower) return "other";

  const hasWord = (pattern) => new RegExp(`(?:^|[^a-z0-9])(?:${pattern})(?:$|[^a-z0-9])`, "i").test(lower);

  if (
    hasWord("propert(?:y|ies)?|leasing|broker(?:age)?")
    || lower.includes("real estate")
  ) {
    return "property_management";
  }
  if (hasWord("dental|dentist|orthodont(?:ic|ics|ist)?")) {
    return "dental";
  }
  // Word-bounded sports — never match transport / passport / support / export.
  if (
    hasWord("hockey|soccer|lacrosse|baseball|softball|basketball|football|volleyball|swim(?:ming)?")
    || hasWord("sports?(?:\\s+club|\\s+league|\\s+team)?")
    || lower.includes("travel club")
    || lower === "sports"
  ) {
    return "sports";
  }
  if (
    hasWord("legal|lawyer|attorney|law\\s*firm|accounting|accountant|consult(?:ing|ant)?")
    || lower.includes("professional_services")
  ) {
    return "professional_services";
  }
  if (hasWord("political|campaign|election|\\bpac\\b")) {
    return "political_campaigns";
  }
  if (hasWord("marketing|advertising") || hasWord("agency")) {
    return "marketing_agency";
  }
  // Known chips that are not dedicated packs stay labeled; packs still route via resolvePackIndustry → other.
  const chip = lower.replace(/\s+/g, "_");
  const knownChips = new Set([
    "home_services",
    "retail",
    "restaurant_hospitality",
    "healthcare",
    "education",
    "nonprofit",
    "construction",
    "manufacturing",
    "ecommerce",
    "real_estate_brokerage",
    "marketing_agency",
    "other",
  ]);
  if (knownChips.has(chip)) return chip === "real_estate_brokerage" ? "property_management" : chip;
  // Free-typed industries still work — pack routing treats unknowns as "other".
  return resolveIndustryLabel(chip, "other");
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
  if (industry === "professional_services") {
    fields.services = fields.services ?? ["client_advisory", "deliverables", "intake"];
    fields.customerTypes = fields.customerTypes ?? ["client"];
  }
  if (industry === "political_campaigns") {
    fields.services = fields.services ?? ["voter_outreach", "fundraising", "volunteer_coordination"];
    fields.customerTypes = fields.customerTypes ?? ["voter", "volunteer", "donor"];
  }
  return fields;
}

/** Pull goals / needs / pain from the opening "describe business + what you need" answer. */
function inferNeedsFromDescription(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  const fields = {};
  const needMatch = raw.match(
    /\b(?:want|need|looking for|hoping to|help (?:us|me)(?: with)?|from (?:you|vibetech))\b[:\s]+(.+)/i,
  );
  if (needMatch?.[1]) {
    fields.desiredOutcomes = splitList(needMatch[1].slice(0, 400));
    fields.goals = fields.desiredOutcomes;
  } else if (/\b(automat|ai|follow[- ]?up|leads?|intake|scheduling|reminders?)\b/i.test(raw)) {
    fields.goals = splitList(raw).slice(0, 5);
    fields.desiredOutcomes = fields.goals;
  }
  if (/\b(pain|struggl|overwhelm|manual|too slow|forget|drop(?:ping)?)\b/i.test(raw)) {
    fields.painPoints = splitList(raw).slice(0, 5);
  }
  return fields;
}

export { deriveRequiredSetupSteps };
