import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Operating packs = separate vertical configurations on one universal platform.
 * Sports and dental are never mixed: each pack owns its own roles, workflows,
 * pipelines, and terminology. Shared runtime ≠ shared pack content.
 */
const SHARED_CAPABILITIES = deepFreeze([
  { capabilityId: "crm_pipelines", label: "CRM pipelines", required: true },
  { capabilityId: "workflows", label: "Approval-gated workflows", required: true },
  { capabilityId: "automations", label: "Automations", required: true },
  { capabilityId: "email", label: "Email drafting and sending", required: false, connection: "business_email" },
  { capabilityId: "sms", label: "SMS drafting and sending", required: false, connection: "sms_channel" },
  { capabilityId: "voice", label: "AI calling", required: false, connection: "voice_channel" },
  { capabilityId: "calendar", label: "Calendar and scheduling", required: false, connection: "calendar" },
  { capabilityId: "website_forms", label: "Website and form intake", required: false, connection: "website_forms" },
  { capabilityId: "google_ads", label: "Google Ads", required: false, connection: "google_ads" },
  { capabilityId: "seo", label: "Google Search Console and SEO operations", required: false, connection: "google_search_console" },
  { capabilityId: "meta_ads", label: "Meta Ads", required: false, connection: "meta_ads" },
  { capabilityId: "operating_dashboard", label: "Live operating dashboard", required: true },
]);

const DENTAL_DEFAULT_ROLES = deepFreeze([
  {
    roleId: "dental_intake",
    archetypeId: "intake_specialist",
    label: "Dental Intake Coordinator",
    purpose: "Qualify new patient inquiries and route them into intake work for owner review.",
    connectionDependencies: ["business_email"],
  },
  {
    roleId: "dental_recall",
    archetypeId: "follow_up_specialist",
    label: "Recall Coordinator",
    purpose: "Prepare recall and reactivation outreach drafts for approval before any patient send.",
    connectionDependencies: ["business_email"],
  },
]);

const SPORTS_DEFAULT_ROLES = deepFreeze([
  {
    roleId: "club_intake",
    archetypeId: "intake_specialist",
    label: "Club Intake Coordinator",
    purpose: "Qualify new player and family inquiries and route them into registration work for owner review.",
    connectionDependencies: ["business_email"],
  },
  {
    roleId: "practice_plan",
    archetypeId: "document_specialist",
    label: "Practice Plan Assistant",
    purpose: "Draft practice plans and drill notes from club knowledge for coach review before sharing.",
    connectionDependencies: ["business_email"],
  },
  {
    roleId: "family_comms",
    archetypeId: "communications_specialist",
    label: "Family Communications Coordinator",
    purpose: "Prepare family messages and schedule updates for approval — nothing sends without you.",
    connectionDependencies: ["business_email"],
  },
  {
    roleId: "calendar_reminder",
    archetypeId: "communications_specialist",
    label: "Calendar Reminder",
    purpose:
      "Notify everyone with calendar access 24 hours, 1 hour, and 10 minutes before club events — drafts first, approval before send.",
    connectionDependencies: ["business_email"],
  },
]);

const PACKS = deepFreeze({
  dental: {
    packId: "dental_v1",
    industry: "dental",
    label: "Dental practice",
    version: 1,
    lifecycle: "building",
    marketingReady: false,
    questionIds: [
      "q_dental_pms",
      "q_dental_billing",
      "q_dental_recall",
      "q_dental_appointment_model",
      "q_dental_first_reply",
    ],
    recordTypes: ["patient", "appointment", "treatment_plan", "recall"],
    pipelines: [
      { pipelineId: "new_patient_intake", label: "New patient intake", subjectType: "patient", stages: ["New inquiry", "Contacted", "Scheduled", "Arrived", "Completed"] },
      { pipelineId: "appointment_readiness", label: "Appointment readiness", subjectType: "appointment", stages: ["Booked", "Confirmed", "Ready", "Needs follow-up", "Complete"] },
      { pipelineId: "recall_follow_up", label: "Recall follow-up", subjectType: "recall", stages: ["Due", "Draft ready", "Awaiting approval", "Sent", "Booked"] },
    ],
    workflowIds: ["patient_intake", "patient_message_triage", "recall_follow_up", "appointment_complete"],
    defaultRoles: DENTAL_DEFAULT_ROLES,
    aiRoles: DENTAL_DEFAULT_ROLES.map((role) => role.label),
    dashboardSignals: ["new_patients", "appointments_today", "recalls_due", "communications_waiting", "workflow_health"],
    compliance: ["approval_for_patient_communications", "privacy_review_required"],
    subjectModule: "people",
  },
  sports: {
    packId: "youth_sports_v1",
    industry: "sports",
    label: "Youth, high-school, and college sports club",
    version: 1,
    lifecycle: "beachhead",
    marketingReady: true,
    questionIds: [
      "q_sports_teams",
      "q_sports_schedule",
      "q_sports_fundraising",
      "q_sports_opponents",
      "q_sports_parent_comms",
    ],
    recordTypes: ["player", "family", "team", "season", "event", "facility"],
    pipelines: [
      { pipelineId: "player_registration", label: "Player registration", subjectType: "player", stages: ["New", "Documents needed", "Ready for review", "Confirmed", "Complete"] },
      { pipelineId: "family_onboarding", label: "Family onboarding", subjectType: "family", stages: ["New", "Information needed", "Ready", "Welcomed"] },
      { pipelineId: "event_readiness", label: "Event readiness", subjectType: "event", stages: ["Planned", "Coordination", "Awaiting approval", "Ready", "Complete"] },
    ],
    workflowIds: ["player_registration", "parent_inbox", "practice_plan_report", "travel_approval"],
    defaultRoles: SPORTS_DEFAULT_ROLES,
    aiRoles: SPORTS_DEFAULT_ROLES.map((role) => role.label),
    dashboardSignals: ["registrations", "events_today", "parent_messages_waiting", "practice_plans_ready", "workflow_health"],
    compliance: ["approval_for_family_communications", "minor_data_review_required"],
    subjectModule: "players",
  },
});

const INDUSTRY_ALIASES = Object.freeze({
  sports: "sports",
  sport: "sports",
  hockey: "sports",
  soccer: "sports",
  youth_sports: "sports",
  sports_club: "sports",
  dental: "dental",
  dentistry: "dental",
  dentist: "dental",
  dental_practice: "dental",
});

/**
 * Resolve exactly one pack industry, or null. Never returns a blended vertical.
 */
export function resolveOperatingIndustry({
  industry = null,
  businessName = null,
  operatingPackId = null,
  specification = null,
  configuration = null,
  allowNameHeuristics = true,
} = {}) {
  const candidates = [
    industry,
    specification?.businessProfile?.industry,
    configuration?.businessProfile?.industry,
    specification?.industry,
    configuration?.industry,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (INDUSTRY_ALIASES[candidate]) return INDUSTRY_ALIASES[candidate];
    if (PACKS[candidate]) return candidate;
  }

  // Pack id wins over name heuristics — packs are exclusive, never blended.
  const pack = String(
    operatingPackId
    ?? specification?.operatingPackId
    ?? configuration?.operatingPackId
    ?? specification?.metadata?.operatingPackId
    ?? "",
  ).toLowerCase();
  if (pack.includes("dental")) return "dental";
  if (pack.includes("youth_sports") || pack === "sports" || pack.startsWith("sports_")) return "sports";

  if (!allowNameHeuristics) return null;

  const name = String(
    businessName
    ?? specification?.businessProfile?.businessName
    ?? configuration?.businessProfile?.businessName
    ?? "",
  ).toLowerCase();
  if (/dental|dentist|orthodont|oral\s*surg|hygien/.test(name)) return "dental";
  if (/hockey|soccer|lacrosse|baseball|softball|basketball|football|swim|volleyball|sports?\s*club|youth\s*sport/.test(name)) {
    return "sports";
  }

  return null;
}

/** Roles for exactly one pack. */
export function getPackDefaultRoles(industry) {
  const pack = getOperatingPack(industry);
  if (!pack) return deepFreeze([]);
  return deepFreeze((pack.defaultRoles ?? []).map((role) => ({
    ...role,
    industry: pack.industry,
    packId: pack.packId,
    packDefault: true,
    required: true,
  })));
}

export function getOperatingPack(industry) {
  const key = String(industry ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!key) return null;
  if (INDUSTRY_ALIASES[key]) return PACKS[INDUSTRY_ALIASES[key]] ?? null;
  if (PACKS[key]) return PACKS[key];
  const fuzzy = resolveOperatingIndustry({ industry: key });
  return fuzzy ? PACKS[fuzzy] ?? null : null;
}

export function listOperatingPacks() {
  return deepFreeze(Object.values(PACKS));
}

export function operatingPackContract(industry) {
  const pack = getOperatingPack(industry);
  if (!pack) return deepFreeze({ pack: null, sharedCapabilities: SHARED_CAPABILITIES });
  return deepFreeze({
    pack: {
      ...pack,
      defaultRoles: getPackDefaultRoles(pack.industry),
    },
    sharedCapabilities: SHARED_CAPABILITIES,
  });
}
