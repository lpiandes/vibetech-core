import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Map owner language → reusable digital-employee archetypes.
 * Prefer matching known archetypes; never invent unsupported product claims.
 */
export const OWNER_REQUESTED_EMPLOYEE_PATTERNS = Object.freeze([
  {
    archetypeId: "ai_caller",
    label: "Voice Call Assistant",
    purpose: "Prepare approved call scripts and follow-up work. Live conversations require a configured Twilio Voice agent.",
    patterns: [/\bai\s*caller\b/i, /\bcall(?:ing)?\s+agent\b/i, /\bphone\s+caller\b/i, /\boutbound\s+call/i],
  },
  {
    archetypeId: "facebook_lead_specialist",
    label: "Meta Lead Specialist",
    purpose: "Qualify and route Meta lead-form submissions into intake work for owner review.",
    patterns: [/\bfb\s*lead/i, /\bfacebook\s+lead/i, /\bmeta\s+lead/i, /\blead\s+gen(?:eration)?\b/i],
  },
  {
    archetypeId: "intake_specialist",
    label: "Intake Specialist",
    purpose: "Qualify and route incoming requests into the right work queues.",
    patterns: [/\bintake\b/i, /\bnew\s+lead\s+intake\b/i, /\bqualify\s+(?:leads|inquiries)\b/i],
  },
  {
    archetypeId: "scheduler",
    label: "Scheduler",
    purpose: "Coordinate scheduling and availability for owner review. Connect Google Calendar before approved events sync externally.",
    patterns: [/\bschedule(?:r|ing)?\b/i, /\bappointment\b/i],
  },
  {
    archetypeId: "campaign_coordinator",
    label: "Campaign Coordinator",
    purpose: "Prepare governed campaigns and outreach drafts for approval — nothing sends without you.",
    patterns: [/\bcampaign\b/i, /\bnewsletter\b/i],
  },
]);

export function extractOwnerRequestedEmployees({
  answers = [],
  conversation = [],
  businessSummary = {},
} = {}) {
  void conversation;
  const workforceAnswer = answers.find((entry) => entry?.questionId === "q_digital_workforce");
  const raw = String(
    workforceAnswer?.answer
    ?? businessSummary?.desiredWorkforce
    ?? "",
  ).trim();
  if (!raw) return deepFreeze([]);

  const requested = raw
    .split(/[\n,;]+/)
    .map((entry) => entry.replace(/^[-•\s]+/, "").replace(/^(?:and|&|also)\s+/i, "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const matched = requested.map((label, index) => {
    const archetype = OWNER_REQUESTED_EMPLOYEE_PATTERNS.find((entry) => (
      entry.patterns.some((pattern) => pattern.test(label))
    ));
    return {
      archetypeId: archetype?.archetypeId ?? `owner_defined_${index + 1}`,
      label: archetype?.label ?? label,
      purpose: archetype?.purpose
        ?? "Owner-requested AI teammate. It prepares work for review and never sends or changes anything without approval.",
    };
  });
  return deepFreeze(matched);
}

export function toSelectedEmployeeRecommendations(requested = []) {
  return deepFreeze(requested.map((entry) => ({
    recommendationId: `rec_owner_${entry.archetypeId}`,
    kind: "employee_archetype",
    label: entry.label,
    why: entry.purpose,
    selected: true,
    evidence: [`archetype:${entry.archetypeId}`, "source:owner_request"],
    payload: {
      employee: {
        label: entry.label,
        purpose: entry.purpose,
        archetypeId: entry.archetypeId,
      },
      archetype: {
        archetypeId: entry.archetypeId,
        purpose: entry.purpose,
      },
    },
  })));
}
