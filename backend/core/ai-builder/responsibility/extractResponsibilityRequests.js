import { createResponsibilityRequest } from "./ResponsibilityRequest.js";

/**
 * Deterministic-plus-heuristic extractor: split multi-request answers into
 * reviewable ResponsibilityRequest candidates. Never silently drops items.
 *
 * Acceptance: one answer with five requests → five candidates.
 *
 * Clarify stays lean: only leave unresolved fields we cannot infer.
 * Defer approvals / proof / failure / subjects to sensible defaults.
 */

const SYSTEM_HINTS = [
  { re: /\bmls\b/i, id: "mls" },
  { re: /\bgmail|outlook|email\b/i, id: "email" },
  { re: /\bcalendar|appointment\b/i, id: "calendar" },
  { re: /\bhubspot|highlevel|crm\b|\bin work\b|pipeline\b/i, id: "crm" },
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

export function guessTrigger(text) {
  if (/missed\s+call|when\s+someone\s+misses/i.test(text)) return "A call is missed";
  if (/form\s+(is\s+)?submit|lead\s+submits/i.test(text)) return "A form is submitted";
  if (/new\s+(inbound\s+)?lead|lead\s+arrives|lead\s+intake/i.test(text)) return "A new inbound lead arrives";
  if (/no\s+reply|inactive|five\s+business\s+days|24\s+hours/i.test(text)) {
    return "No reply within the follow-up window";
  }
  if (/lead\s+responds|when\s+a\s+lead\s+responds/i.test(text)) return "A lead responds";
  if (/every\s+wednesday|weekly|every\s+week/i.test(text)) {
    return String(text.match(/every\s+\w+|weekly/i)?.[0] ?? "On a weekly schedule");
  }
  if (/appointment|before\s+scheduled/i.test(text)) return "Before a scheduled appointment";
  if (/twice\s+a\s+year|six\s+months|past\s+client/i.test(text)) return "On a recurring schedule for past clients";
  if (/alert|about\s+to\s+miss|deadline|sla/i.test(text)) {
    return "An active lead is about to miss an SLA";
  }
  if (/when\s+/i.test(text)) {
    const m = text.match(/when\s+[^.,;]+/i);
    if (m) return m[0];
  }
  return "";
}

export function guessActions(text) {
  const actions = [];
  if (/text|sms/i.test(text)) actions.push("Send");
  if (/email|newsletter|send/i.test(text)) actions.push("Send");
  if (/find|pull|research/i.test(text)) actions.push("Research");
  if (/prepare|draft|write/i.test(text)) actions.push("Draft");
  if (/qualify|assign/i.test(text)) actions.push("Classify", "Assign");
  if (/schedule|book/i.test(text)) actions.push("Schedule");
  if (/remind|alert/i.test(text)) actions.push("Send");
  if (/log|confirm\s+contact|intake/i.test(text)) actions.push("Create work");
  if (/collect|document|handoff/i.test(text)) actions.push("Request documents", "Create work");
  if (/call\s+first|call\b/i.test(text)) actions.push("Call");
  if (!actions.length && /follow\s*up|contact/i.test(text)) actions.push("Send");
  return [...new Set(actions)].join(", ");
}

/**
 * Only ask what we cannot infer. Everything else uses defaults at confirm/compile.
 */
export function leanUnresolvedFields({ trigger, actions, systems }) {
  const unresolved = [];
  if (!trigger) unresolved.push("trigger");
  if (!actions) unresolved.push("actions");
  if (!systems.length) unresolved.push("observe_where");
  return unresolved;
}

/**
 * Fill empty contract fields so we do not interview for them.
 */
export function applyLeanClarifyDefaults(request) {
  const patch = {};
  if (!String(request?.affectedSubjects ?? "").trim()) {
    patch.affectedSubjects = "Eligible leads and contacts as described in the request";
  }
  if (!String(request?.approvalExpectations ?? "").trim()) {
    patch.approvalExpectations = "First external message until shadow mode is complete";
  }
  if (!String(request?.successDescription ?? "").trim()) {
    patch.successDescription = "Action logged and delivery or CRM update confirmed";
  }
  if (!String(request?.failureBehavior ?? "").trim()) {
    patch.failureBehavior = "Ask the owner and leave a reason note — do not invent a send";
  }
  if (!String(request?.requiredInformation ?? "").trim()) {
    patch.requiredInformation = "Contact details and connected systems required for the action";
  }
  return Object.keys(patch).length ? { ...request, ...patch } : request;
}

/**
 * Across the inventory, keep at most `maxQuestions` unresolved fields (priority order).
 * Clears the rest and applies defaults so setup can finish.
 */
export function pruneUnresolvedForLeanClarify(requests = [], { maxQuestions = 3 } = {}) {
  const priority = ["trigger", "observe_where", "actions", "approvals"];
  const slots = [];
  for (const req of requests) {
    if (["removed", "draft"].includes(String(req?.status))) continue;
    const unresolved = Array.isArray(req?.unresolvedFields) ? req.unresolvedFields : [];
    for (const field of priority) {
      if (unresolved.includes(field)) {
        slots.push({ responsibilityId: req.responsibilityId, field });
      }
    }
  }
  const keep = new Set(
    slots.slice(0, Math.max(0, Number(maxQuestions) || 0)).map((s) => `${s.responsibilityId}:${s.field}`),
  );

  return requests.map((req) => {
    if (String(req?.status) === "removed") return req;
    const unresolved = (Array.isArray(req?.unresolvedFields) ? req.unresolvedFields : [])
      .filter((field) => keep.has(`${req.responsibilityId}:${field}`));
    return applyLeanClarifyDefaults({
      ...req,
      unresolvedFields: unresolved,
    });
  });
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
  const requests = fragments.map((fragment) => {
    const systems = detectSystems(fragment);
    const triggerDescription = guessTrigger(fragment);
    const actionDescription = guessActions(fragment);
    return applyLeanClarifyDefaults(createResponsibilityRequest({
      businessId,
      title: titleFromFragment(fragment),
      rawRequest: fragment,
      originalText: fragment,
      requestedOutcome: fragment,
      triggerDescription,
      actionDescription,
      systemsMentioned: systems,
      status: "pending_review",
      sourceAnswerIds: sourceAnswerId ? [sourceAnswerId] : [],
      confidence: fragments.length === 1 ? 0.7 : 0.55,
      createdAt: now,
      updatedAt: now,
      unresolvedFields: leanUnresolvedFields({
        trigger: triggerDescription,
        actions: actionDescription,
        systems,
      }),
    }));
  });

  return {
    requests,
    count: requests.length,
    sourceText: String(text ?? ""),
  };
}
