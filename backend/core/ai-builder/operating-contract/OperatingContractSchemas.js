import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Universal scope keys — every teammate must answer these (or mark N/A with reason).
 * Vertical schemas map them to concrete labels and input types.
 */
export const UNIVERSAL_SCOPE_KEYS = Object.freeze([
  "audience",
  "when",
  "where",
  "howMany",
  "constraints",
]);

export const TRIGGER_MODES = Object.freeze([
  { id: "manual", label: "Manual — owner runs a job" },
  { id: "events", label: "When events happen" },
  { id: "manual_or_events", label: "Manual or when events happen" },
  { id: "schedule", label: "On a schedule" },
]);

/**
 * Role/industry schemas: concrete Scope fields mapped onto universal keys.
 * input: text | textarea | number | tags
 */
const FIELD = (key, label, opts = {}) => deepFreeze({
  key,
  universalKey: opts.universalKey ?? key,
  label,
  input: opts.input ?? "text",
  required: opts.required !== false,
  placeholder: opts.placeholder ?? "",
  help: opts.help ?? "",
});

const SCHEMA_SPORTS_CLUB_INTAKE = deepFreeze({
  schemaId: "sports_club_intake",
  industry: "sports",
  roleIds: ["club_intake"],
  archetypeIds: ["intake_specialist"],
  labelMatchers: [/club\s*intake|intake\s*coord/i],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: ["NEW_INQUIRY", "FORM_SUBMIT", "META_LEAD"],
    schedule: null,
    summary: "When a new player or family inquiry arrives, or you run a job.",
  },
  executesDefaults: {
    workTypes: ["intake_qualification", "registration_routing"],
    summary: "Drafts intake notes and routes registration work for your review.",
  },
  scopeFields: [
    FIELD("audience", "Who do they intake?", {
      universalKey: "audience",
      input: "textarea",
      placeholder: "e.g. New players and families for U10–U18 travel hockey",
      help: "Programs, age groups, or tryout tracks this teammate handles.",
    }),
    FIELD("when", "When should intake run?", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. Within 1 business day of a new inquiry or form fill",
    }),
    FIELD("where", "Where do inquiries come from?", {
      universalKey: "where",
      input: "tags",
      placeholder: "Website form, email, Facebook leads",
    }),
    FIELD("howMany", "Typical volume / batch size", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. Up to 20 new inquiries per day",
      required: false,
    }),
    FIELD("constraints", "Hard rules for intake", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "e.g. Never promise roster spots; always require birth year",
    }),
  ],
});

const SCHEMA_SPORTS_PRACTICE_PLAN = deepFreeze({
  schemaId: "sports_practice_plan",
  industry: "sports",
  roleIds: ["practice_plan"],
  archetypeIds: ["document_specialist"],
  labelMatchers: [/practice\s*plan/i],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: ["PRACTICE_SCHEDULED", "COACH_REQUEST"],
    schedule: null,
    summary: "Before practice (or when you request a plan).",
  },
  executesDefaults: {
    workTypes: ["practice_plan_draft"],
    summary: "Drafts practice plans and drill notes from club knowledge for coach review.",
  },
  scopeFields: [
    FIELD("audience", "Which teams / age groups?", {
      universalKey: "audience",
      input: "tags",
      placeholder: "U12, U14 Travel, High school varsity",
    }),
    FIELD("when", "When should plans be ready?", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. 24 hours before each practice",
    }),
    FIELD("where", "Where are practices held?", {
      universalKey: "where",
      input: "tags",
      placeholder: "Main rink, satellite facility",
      required: false,
    }),
    FIELD("howMany", "Sessions per plan / week", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. 1 plan per team per practice",
    }),
    FIELD("constraints", "Planning constraints", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "e.g. Cite curriculum only; no invented drills",
    }),
  ],
});

const SCHEMA_SPORTS_FAMILY_COMMS = deepFreeze({
  schemaId: "sports_family_comms",
  industry: "sports",
  roleIds: ["family_comms"],
  archetypeIds: ["communications_specialist"],
  labelMatchers: [/family\s*comm|parent\s*comm/i],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: ["SCHEDULE_CHANGE", "ANNOUNCEMENT_REQUESTED", "EVENT_UPDATE"],
    schedule: null,
    summary: "Manual: Run now on this page. LIVE automatic: club Calendar creates/updates.",
  },
  executesDefaults: {
    workTypes: ["family_message_draft", "schedule_update_draft"],
    summary: "Drafts family messages and schedule updates for your approval before send.",
  },
  scopeFields: [
    FIELD("audience", "Who receives messages?", {
      universalKey: "audience",
      input: "tags",
      placeholder: "All families, Travel only, U12 parents",
    }),
    FIELD("when", "When should messages go out?", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. Schedule changes within 2 hours; weekly digest Sundays",
    }),
    FIELD("where", "Channels to use", {
      universalKey: "where",
      input: "tags",
      placeholder: "Email, SMS (if connected)",
    }),
    FIELD("howMany", "How many messages / cadence", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. Max 3 family emails per week unless urgent",
    }),
    FIELD("constraints", "Tone and hard rules", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "e.g. No fees in SMS; always include cancel policy link",
    }),
  ],
});

const SCHEMA_SPORTS_CALENDAR_REMINDER = deepFreeze({
  schemaId: "sports_calendar_reminder",
  industry: "sports",
  roleIds: ["calendar_reminder"],
  archetypeIds: ["communications_specialist"],
  labelMatchers: [/calendar\s*remind/i],
  triggerDefaults: {
    mode: "events",
    eventTypes: ["EVENT_REMINDER_DUE", "SCHEDULE_CHANGE", "EVENT_UPDATE"],
    schedule: null,
    summary: "24 hours, 1 hour, and 10 minutes before each club calendar event.",
  },
  executesDefaults: {
    workTypes: ["calendar_reminder_draft", "schedule_update_draft"],
    summary: "Drafts reminders for everyone who can see the event; outbound stays approval-gated.",
  },
  scopeFields: [
    FIELD("audience", "Who gets reminders?", {
      universalKey: "audience",
      input: "tags",
      placeholder: "Org members with calendar access",
    }),
    FIELD("when", "Reminder windows", {
      universalKey: "when",
      input: "textarea",
      placeholder: "24 hours, 1 hour, and 10 minutes before start",
    }),
    FIELD("where", "Channels", {
      universalKey: "where",
      input: "tags",
      placeholder: "Email, team notify",
    }),
    FIELD("howMany", "How many reminders per event?", {
      universalKey: "howMany",
      input: "text",
      placeholder: "3 (24h / 1h / 10m)",
    }),
    FIELD("constraints", "Hard rules", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "Never silent-send; owner approves customer-facing outbound",
    }),
  ],
});

const SCHEMA_SPORTS_TOURNAMENT = deepFreeze({
  schemaId: "sports_tournament",
  industry: "sports",
  roleIds: ["tournament_coordinator"],
  archetypeIds: [],
  labelMatchers: [/tournament/i],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: ["TOURNAMENT_PLANNING", "SEASON_MILESTONE"],
    schedule: null,
    summary: "When tournament planning starts, or you run a job.",
  },
  executesDefaults: {
    workTypes: ["tournament_plan_draft", "travel_coordination_draft"],
    summary: "Drafts tournament schedules, team slots, and travel notes for owner review.",
  },
  scopeFields: [
    FIELD("audience", "Which age groups / teams compete?", {
      universalKey: "audience",
      input: "tags",
      placeholder: "U12 Travel, U14 AA",
    }),
    FIELD("when", "When are tournaments scheduled?", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. Fall showcase weekends; book 6 weeks ahead",
    }),
    FIELD("where", "Where / which venues or events?", {
      universalKey: "where",
      input: "tags",
      placeholder: "Regional rink, named tournaments",
    }),
    FIELD("howMany", "How many teams per event?", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. 2–4 club teams per tournament",
    }),
    FIELD("constraints", "Booking constraints", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "e.g. Never double-book coaches; owner approves fees",
    }),
  ],
});

const SCHEMA_DENTAL_INTAKE = deepFreeze({
  schemaId: "dental_intake",
  industry: "dental",
  roleIds: ["dental_intake"],
  archetypeIds: ["intake_specialist"],
  labelMatchers: [/dental\s*intake/i],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: ["NEW_INQUIRY", "FORM_SUBMIT", "META_LEAD"],
    schedule: null,
    summary: "When a new patient inquiry arrives, or you run a job.",
  },
  executesDefaults: {
    workTypes: ["patient_intake_draft"],
    summary: "Drafts new-patient intake notes and routes them for review.",
  },
  scopeFields: [
    FIELD("audience", "Which patients / appointment types?", {
      universalKey: "audience",
      input: "textarea",
      placeholder: "New patients, emergency, hygiene transfers",
    }),
    FIELD("when", "Response window", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. Same-day for emergencies; 1 business day otherwise",
    }),
    FIELD("where", "Inquiry sources", {
      universalKey: "where",
      input: "tags",
      placeholder: "Website, phone, Facebook leads",
    }),
    FIELD("howMany", "Daily intake capacity", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. Up to 15 new inquiries/day",
      required: false,
    }),
    FIELD("constraints", "Intake rules", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "e.g. Never quote fees without front desk review",
    }),
  ],
});

const SCHEMA_DENTAL_RECALL = deepFreeze({
  schemaId: "dental_recall",
  industry: "dental",
  roleIds: ["dental_recall"],
  archetypeIds: ["follow_up_specialist"],
  labelMatchers: [/recall/i],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: ["RECALL_DUE", "REACTIVATION_LIST"],
    schedule: { cadence: "weekly", summary: "Weekly recall batch" },
    summary: "When recalls are due, on the weekly batch, or when you run a job.",
  },
  executesDefaults: {
    workTypes: ["recall_outreach_draft"],
    summary: "Drafts recall and reactivation outreach for approval before any patient send.",
  },
  scopeFields: [
    FIELD("audience", "Which recall segments?", {
      universalKey: "audience",
      input: "tags",
      placeholder: "6-month hygiene, overdue 12+ months",
    }),
    FIELD("when", "Cadence / timing", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. Weekly Tuesday batch; 2 weeks before due date",
    }),
    FIELD("where", "Channels", {
      universalKey: "where",
      input: "tags",
      placeholder: "Email first, SMS if connected",
    }),
    FIELD("howMany", "Batch size", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. Max 40 recall drafts per batch",
    }),
    FIELD("constraints", "Recall rules", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "e.g. No clinical advice; always offer booking link",
    }),
  ],
});

const SCHEMA_GENERIC = deepFreeze({
  schemaId: "generic_teammate",
  industry: "*",
  roleIds: [],
  archetypeIds: [],
  labelMatchers: [],
  triggerDefaults: {
    mode: "manual_or_events",
    eventTypes: [],
    schedule: null,
    summary: "When you run a job, or when linked automations fire.",
  },
  executesDefaults: {
    workTypes: ["specialty_draft"],
    summary: "Drafts work for your review — never sends without approval.",
  },
  scopeFields: [
    FIELD("audience", "Who is this for?", {
      universalKey: "audience",
      input: "textarea",
      placeholder: "Customers, patients, families, teams…",
    }),
    FIELD("when", "When should it act?", {
      universalKey: "when",
      input: "textarea",
      placeholder: "e.g. On new inquiry; before each event; weekly",
    }),
    FIELD("where", "Where / which context?", {
      universalKey: "where",
      input: "textarea",
      placeholder: "Channels, locations, programs",
      required: false,
    }),
    FIELD("howMany", "How many / volume limits?", {
      universalKey: "howMany",
      input: "text",
      placeholder: "e.g. Batch size or daily cap",
      required: false,
    }),
    FIELD("constraints", "Hard rules", {
      universalKey: "constraints",
      input: "textarea",
      placeholder: "What must never happen without you?",
    }),
  ],
});

const ALL_SCHEMAS = deepFreeze([
  SCHEMA_SPORTS_CLUB_INTAKE,
  SCHEMA_SPORTS_PRACTICE_PLAN,
  SCHEMA_SPORTS_FAMILY_COMMS,
  SCHEMA_SPORTS_CALENDAR_REMINDER,
  SCHEMA_SPORTS_TOURNAMENT,
  SCHEMA_DENTAL_INTAKE,
  SCHEMA_DENTAL_RECALL,
  SCHEMA_GENERIC,
]);

export function listOperatingContractSchemas() {
  return ALL_SCHEMAS;
}

/**
 * Resolve the best schema for an employee + industry.
 */
export function resolveOperatingContractSchema({
  employee = {},
  industry = null,
} = {}) {
  const roleId = String(employee.roleId ?? "").trim();
  const archetypeId = String(employee.archetypeId ?? "").trim();
  const label = String(employee.label ?? employee.name ?? "").trim();
  const industryKey = String(industry ?? employee.industry ?? "").toLowerCase();

  const scored = ALL_SCHEMAS
    .filter((schema) => schema.schemaId !== "generic_teammate")
    .map((schema) => {
      let score = 0;
      if (industryKey && schema.industry === industryKey) score += 10;
      if (roleId && schema.roleIds.includes(roleId)) score += 50;
      if (archetypeId && schema.archetypeIds.includes(archetypeId)) score += 20;
      if (label && schema.labelMatchers.some((re) => re.test(label))) score += 40;
      return { schema, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score >= 40) return scored[0].schema;
  if (scored[0] && industryKey && scored[0].schema.industry === industryKey) return scored[0].schema;
  return SCHEMA_GENERIC;
}

export { SCHEMA_GENERIC };
