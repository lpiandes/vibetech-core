import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderQuestion } from "./BuilderQuestion.js";

/**
 * Deterministic adaptive question planner.
 * Asks only relevant unanswered questions; never pretends uncertainty is resolved.
 */
export const DISCOVERY_TOPIC_ORDER = Object.freeze([
  "identity",
  "industry",
  "services",
  "customers",
  "operations",
  "team",
  "software",
  "communications",
  "approvals",
  "integrations",
  "pain_points",
  "permissions",
  "outcomes",
  "expansion",
]);

export const DISCOVERY_QUESTION_BANK = Object.freeze([
  createBuilderQuestion({
    questionId: "q_tell_us",
    prompt: "In a few sentences, what does your business do?",
    why: "This is how Architect starts designing your operating system.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_company_name",
    prompt: "What is the company name?",
    why: "We show this across your portal and team invitations.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_industry",
    prompt: "What industry are you in?",
    why: "Industry helps Architect match a proven starting blueprint.",
    required: true,
    topic: "industry",
    answerType: "choice",
    options: ["property_management", "dental", "sports", "professional_services", "other"],
  }),
  createBuilderQuestion({
    questionId: "q_services",
    prompt: "What services or products do you offer?",
    why: "Services shape the work your team will manage day to day.",
    required: true,
    topic: "services",
  }),
  createBuilderQuestion({
    questionId: "q_customers",
    prompt: "Who are your customers or clients?",
    why: "Knowing who you serve shapes People and follow-up work.",
    required: true,
    topic: "customers",
  }),
  createBuilderQuestion({
    questionId: "q_locations",
    prompt: "Where do you operate (cities, regions, or online)?",
    why: "Locations help with scheduling, service areas, and reporting.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_team_size",
    prompt: "About how many people work in the business?",
    why: "Team size guides how much oversight the owner needs by default.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_roles",
    prompt: "What roles do people have day to day?",
    why: "Roles decide who can see and approve different kinds of work.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_software",
    prompt: "What software do you use today?",
    why: "Existing tools become connections to set up later — never silent installs.",
    required: false,
    topic: "software",
  }),
  createBuilderQuestion({
    questionId: "q_repetitive_work",
    prompt: "What work do people repeat every week?",
    why: "That is where VIBETech can take load first.",
    required: true,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_approvals",
    prompt: "Which actions should always need a human approval?",
    why: "Approval boundaries keep customer-facing and sensitive actions safe.",
    required: false,
    topic: "approvals",
  }),
  createBuilderQuestion({
    questionId: "q_communications",
    prompt: "How do you communicate with customers today?",
    why: "Channels become inbox, campaigns, and connection setup steps.",
    required: false,
    topic: "communications",
  }),
  createBuilderQuestion({
    questionId: "q_scheduling",
    prompt: "Do you schedule appointments, jobs, practices, or visits?",
    why: "Scheduling needs become calendar work and setup requirements.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_sales",
    prompt: "How do new customers usually find and buy from you?",
    why: "Sales process shapes intake and follow-up work.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_documents",
    prompt: "What documents, SOPs, or spreadsheets run the business today?",
    why: "Uploads become knowledge and import reviews — nothing changes until you confirm.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_reporting",
    prompt: "What should owners see on a daily dashboard?",
    why: "Home uses real business data only — never fabricated metrics.",
    required: false,
    topic: "outcomes",
  }),
  createBuilderQuestion({
    questionId: "q_compliance",
    prompt: "Are there compliance, consent, or sensitive-data rules we must respect?",
    why: "Sensitive rules become policies and restricted areas of the portal.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_integrations",
    prompt: "Which systems should connect later (email, CRM, calendar, PMS)?",
    why: "Connections are setup steps — we never pretend they already work.",
    required: false,
    topic: "integrations",
  }),
  createBuilderQuestion({
    questionId: "q_pain_points",
    prompt: "What is the biggest pain point right now?",
    why: "Pain points decide what Architect prioritizes in the first plan.",
    required: true,
    topic: "pain_points",
  }),
  createBuilderQuestion({
    questionId: "q_desired_outcomes",
    prompt: "What does success look like in the first 30 days?",
    why: "Early goals guide readiness checks and the first work queues.",
    required: false,
    topic: "outcomes",
  }),
  createBuilderQuestion({
    questionId: "q_owner_oversight",
    prompt: "How involved should the owner be in day-to-day approvals?",
    why: "Owner oversight shapes approval queues and manager permissions.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_departments",
    prompt: "Do you organize people into departments or teams?",
    why: "Departments shape role templates and work ownership.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_lead_sources",
    prompt: "Where do new leads or opportunities usually come from?",
    why: "Lead sources become intake work and campaign follow-ups.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_request_sources",
    prompt: "How do customers submit requests (portal, email, phone, walk-in)?",
    why: "Request sources become request types and inbox routing.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_automation_comfort",
    prompt: "How comfortable are you letting AI handle routine work with human approval?",
    why: "Comfort level sets how assertive AI teammates are by default.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_expansion_plans",
    prompt: "Are you planning new locations, services, or team growth soon?",
    why: "Expansion plans keep the operating system ready to grow without a rebuild.",
    required: false,
    topic: "expansion",
  }),
]);

export class BusinessDiscoveryQuestionPlanner {
  plan({ answers = [], evidence = [], limit = 3 } = {}) {
    const answered = new Set(
      answers
        .filter((entry) => !entry.skipped && !entry.unknown)
        .map((entry) => entry.questionId),
    );
    const knownTopics = new Set(
      evidence.flatMap((entry) => entry.payload?.topics ?? []),
    );

    const remaining = DISCOVERY_QUESTION_BANK.filter((question) => !answered.has(question.questionId))
      .filter((question) => {
        // Skip optional questions when evidence already covers the topic.
        if (!question.required && knownTopics.has(question.topic)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return DISCOVERY_TOPIC_ORDER.indexOf(a.topic) - DISCOVERY_TOPIC_ORDER.indexOf(b.topic);
      });

    return deepFreeze(remaining.slice(0, Math.max(1, Number(limit) || 3)));
  }
}
