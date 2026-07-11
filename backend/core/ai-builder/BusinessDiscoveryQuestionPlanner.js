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
]);

export const DISCOVERY_QUESTION_BANK = Object.freeze([
  createBuilderQuestion({
    questionId: "q_tell_us",
    prompt: "Tell us about your business.",
    why: "A plain description helps us choose the right starting blueprint.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_company_name",
    prompt: "What is the company name?",
    why: "We use this on your workspace and readiness checklist.",
    required: true,
    topic: "identity",
  }),
  createBuilderQuestion({
    questionId: "q_industry",
    prompt: "What industry are you in?",
    why: "Industry helps us match reusable blueprints instead of inventing custom software.",
    required: true,
    topic: "industry",
    answerType: "choice",
    options: ["property_management", "dental", "sports", "professional_services", "other"],
  }),
  createBuilderQuestion({
    questionId: "q_services",
    prompt: "What services or products do you offer?",
    why: "Services become workspaces, work types, and knowledge needs.",
    required: true,
    topic: "services",
  }),
  createBuilderQuestion({
    questionId: "q_customers",
    prompt: "Who are your customers or clients?",
    why: "Customer types shape People views and relationship workflows.",
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
    why: "Team size guides role templates and owner oversight defaults.",
    required: false,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_roles",
    prompt: "What roles do people have day to day?",
    why: "Roles control which workspaces and actions each person can see.",
    required: true,
    topic: "team",
  }),
  createBuilderQuestion({
    questionId: "q_software",
    prompt: "What software do you use today?",
    why: "Existing tools become integration requirements or deferred gaps — never silent installs.",
    required: false,
    topic: "software",
  }),
  createBuilderQuestion({
    questionId: "q_repetitive_work",
    prompt: "What repetitive work takes the most time?",
    why: "Repetitive work is where digital employees and Work queues help most.",
    required: true,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_approvals",
    prompt: "Which actions should always need a human approval?",
    why: "Approval boundaries keep customer-facing and sensitive actions safe.",
    required: true,
    topic: "approvals",
  }),
  createBuilderQuestion({
    questionId: "q_communications",
    prompt: "How do you communicate with customers today?",
    why: "Channels become Inbox, campaigns, and connection setup steps.",
    required: false,
    topic: "communications",
  }),
  createBuilderQuestion({
    questionId: "q_scheduling",
    prompt: "Do you schedule appointments, jobs, practices, or visits?",
    why: "Scheduling needs become calendar Work and setup requirements.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_sales",
    prompt: "How do new customers usually find and buy from you?",
    why: "Sales process shapes intake workflows and follow-up Work.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_documents",
    prompt: "What documents, SOPs, or spreadsheets run the business today?",
    why: "Uploads become Knowledge and import dry-runs — never automatic mutation.",
    required: false,
    topic: "operations",
  }),
  createBuilderQuestion({
    questionId: "q_reporting",
    prompt: "What should owners see on a daily dashboard?",
    why: "Dashboards use real business data only — never fabricated metrics.",
    required: false,
    topic: "outcomes",
  }),
  createBuilderQuestion({
    questionId: "q_compliance",
    prompt: "Are there compliance, consent, or sensitive-data rules we must respect?",
    why: "Sensitive rules become governance policies and restricted modules.",
    required: false,
    topic: "permissions",
  }),
  createBuilderQuestion({
    questionId: "q_integrations",
    prompt: "Which systems should connect later (email, CRM, calendar, PMS)?",
    why: "Connections are setup requirements — we never pretend they already work.",
    required: false,
    topic: "integrations",
  }),
  createBuilderQuestion({
    questionId: "q_pain_points",
    prompt: "What is the biggest pain point right now?",
    why: "Pain points prioritize which reusable capabilities to enable first.",
    required: true,
    topic: "pain_points",
  }),
  createBuilderQuestion({
    questionId: "q_desired_outcomes",
    prompt: "What does success look like in the first 30 days?",
    why: "Outcomes guide readiness checks and the first Work queues.",
    required: true,
    topic: "outcomes",
  }),
  createBuilderQuestion({
    questionId: "q_owner_oversight",
    prompt: "How involved should the owner be in day-to-day approvals?",
    why: "Owner oversight shapes approval queues and manager permissions.",
    required: false,
    topic: "permissions",
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
