import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Map owner language → reusable digital-employee archetypes.
 * Prefer matching known archetypes; never invent unsupported product claims.
 */
export const OWNER_REQUESTED_EMPLOYEE_PATTERNS = Object.freeze([
  {
    archetypeId: "ai_caller",
    label: "AI Caller",
    purpose: "Prepare call scripts and follow-up queues for owner approval. Live outbound calling is not available yet — drafts and work stay email/approval-gated until voice ships.",
    patterns: [/\bai\s*caller\b/i, /\bcall(?:ing)?\s+agent\b/i, /\bphone\s+caller\b/i, /\boutbound\s+call/i],
  },
  {
    archetypeId: "facebook_lead_specialist",
    label: "Facebook Lead Generator",
    purpose: "Qualify and route inbound leads into intake work for owner review. Meta/Facebook ads sync is not live yet — use email/web form intake until it ships.",
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
    purpose: "Coordinate scheduling and availability for owner review (in-app schedule — calendar sync not live yet).",
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
  const corpus = [
    ...answers.map((entry) => String(entry?.answer ?? "")),
    ...conversation.map((entry) => String(entry?.text ?? "")),
    String(businessSummary?.description ?? ""),
    String(businessSummary?.desiredWorkforce ?? ""),
    ...(Array.isArray(businessSummary?.requestedEmployees) ? businessSummary.requestedEmployees : []),
    ...(Array.isArray(businessSummary?.goals) ? businessSummary.goals : []),
    ...(Array.isArray(businessSummary?.painPoints) ? businessSummary.painPoints : []),
  ].join("\n");

  const matched = [];
  for (const entry of OWNER_REQUESTED_EMPLOYEE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(corpus))) {
      matched.push({
        archetypeId: entry.archetypeId,
        label: entry.label,
        purpose: entry.purpose,
      });
    }
  }
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
