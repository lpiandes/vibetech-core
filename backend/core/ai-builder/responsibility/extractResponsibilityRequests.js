import { createResponsibilityRequest } from "./ResponsibilityRequest.js";

/**
 * Deterministic-plus-heuristic extractor: split multi-request answers into
 * reviewable ResponsibilityRequest candidates. Never silently drops items.
 *
 * Acceptance: one answer with five requests → five candidates.
 */

const SYSTEM_HINTS = [
  { re: /\bmls\b/i, id: "mls" },
  { re: /\bgmail|outlook|email\b/i, id: "email" },
  { re: /\bcalendar|appointment\b/i, id: "calendar" },
  { re: /\bhubspot|highlevel|crm\b/i, id: "crm" },
  { re: /\btwilio|sms|text\b/i, id: "sms" },
  { re: /\bphone|call|missed\b/i, id: "phone" },
  { re: /\bwebhook|form\b/i, id: "form" },
  { re: /\bspreadsheet|csv|export\b/i, id: "spreadsheet" },
];

function titleFromFragment(text) {
  const cleaned = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "Untitled responsibility";
  // Prefer short noun-phrase style titles from common patterns.
  if (/missed\s+call/i.test(cleaned)) return "Missed-Call Response";
  if (/newsletter|listing/i.test(cleaned) && /week|every/i.test(cleaned)) return "Weekly Active Listing Newsletter";
  if (/appointment|remind/i.test(cleaned)) return "Appointment Reminders";
  if (/past\s+client|old\s+client|twice\s+a\s+year|six\s+months/i.test(cleaned)) return "Past-Client Follow-Up";
  if (/proposal|follow\s*up/i.test(cleaned)) return "Proposal Follow-Up";
  if (/lead|qualify|assign|schedule/i.test(cleaned)) return "Lead Intake & Scheduling";
  if (/handoff|won|document/i.test(cleaned)) return "Won-Work Handoff";
  if (/deadline|sla|alert|miss/i.test(cleaned)) return "Response Deadline Alert";
  const first = cleaned.split(/[.!?]/)[0].trim();
  if (first.length <= 56) return first.replace(/^./, (c) => c.toUpperCase());
  return `${first.slice(0, 53).trim()}…`;
}

function detectSystems(text) {
  const found = [];
  for (const hint of SYSTEM_HINTS) {
    if (hint.re.test(text)) found.push(hint.id);
  }
  return found;
}

function guessTrigger(text) {
  if (/missed\s+call|when\s+someone\s+misses/i.test(text)) return "A call is missed";
  if (/form\s+(is\s+)?submit|lead\s+submits/i.test(text)) return "A form is submitted";
  if (/every\s+wednesday|weekly|every\s+week/i.test(text)) return String(text.match(/every\s+\w+|weekly/i)?.[0] ?? "On a weekly schedule");
  if (/no\s+reply|inactive|five\s+business\s+days/i.test(text)) return "A proposal has had no response for a set period";
  if (/appointment|before\s+scheduled/i.test(text)) return "Before a scheduled appointment";
  if (/twice\s+a\s+year|six\s+months|past\s+client/i.test(text)) return "On a recurring schedule for past clients";
  if (/when\s+/i.test(text)) {
    const m = text.match(/when\s+[^.,;]+/i);
    if (m) return m[0];
  }
  return "";
}

function guessActions(text) {
  const actions = [];
  if (/text|sms/i.test(text)) actions.push("Send");
  if (/email|newsletter|send/i.test(text)) actions.push("Send");
  if (/find|pull|research/i.test(text)) actions.push("Research");
  if (/prepare|draft|write/i.test(text)) actions.push("Draft");
  if (/qualify|assign/i.test(text)) actions.push("Classify", "Assign");
  if (/schedule|book/i.test(text)) actions.push("Schedule");
  if (/remind|alert/i.test(text)) actions.push("Send");
  if (/collect|document|handoff/i.test(text)) actions.push("Request documents", "Create work");
  if (!actions.length && /follow\s*up|contact/i.test(text)) actions.push("Send");
  return [...new Set(actions)].join(", ");
}

function splitCandidates(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  // Numbered / bulleted lists
  const lineParts = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  if (lineParts.length >= 2) {
    return lineParts;
  }

  // Prefer sentence boundaries for dense paragraphs (acceptance: 5 asks → 5 cards).
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  if (sentences.length >= 2) return sentences;

  // Conjunction / soft splits when punctuation is missing
  const rough = text
    .split(/(?:\s*;\s+|\s+also\s+|\s+then\s+|\s+plus\s+)/i)
    .map((p) => p.trim().replace(/^[,.\s]+|[,.\s]+$/g, ""))
    .filter((p) => p.length >= 12);

  if (rough.length >= 2) {
    return rough;
  }

  return [text];
}

/**
 * @param {{ text: string, businessId?: string|null, sourceAnswerId?: string|null }} input
 */
export function extractResponsibilityRequests({
  text,
  businessId = null,
  sourceAnswerId = null,
} = {}) {
  const fragments = splitCandidates(text);
  const now = new Date().toISOString();
  const requests = fragments.map((fragment, index) => {
    const systems = detectSystems(fragment);
    return createResponsibilityRequest({
      businessId,
      title: titleFromFragment(fragment),
      rawRequest: fragment,
      originalText: fragment,
      requestedOutcome: fragment,
      triggerDescription: guessTrigger(fragment),
      actionDescription: guessActions(fragment),
      systemsMentioned: systems,
      status: "pending_review",
      sourceAnswerIds: sourceAnswerId ? [sourceAnswerId] : [],
      confidence: fragments.length === 1 ? 0.7 : 0.55,
      createdAt: now,
      updatedAt: now,
      unresolvedFields: [
        "trigger",
        "observe_where",
        "actions",
        "subjects",
        "required_information",
        "approvals",
        "success_proof",
        "failure_behavior",
      ].filter((field) => {
        if (field === "trigger" && guessTrigger(fragment)) return false;
        if (field === "actions" && guessActions(fragment)) return false;
        return true;
      }),
    });
  });

  return {
    requests,
    count: requests.length,
    sourceText: String(text ?? ""),
  };
}
