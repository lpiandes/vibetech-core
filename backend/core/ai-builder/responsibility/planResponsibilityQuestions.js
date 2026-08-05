import { createBuilderQuestion } from "../BuilderQuestion.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Unresolved-contract-field-first questions for one responsibility.
 * Kept short — owners should not sit through a contract interview.
 */

/** Hard session budget after inventory confirm. */
export const MAX_CLARIFY_QUESTIONS = 3;

/** Only these fields may become clarify questions (everything else uses defaults). */
export const CLARIFY_FIELD_PRIORITY = Object.freeze([
  "trigger",
  "observe_where",
  "actions",
  "approvals",
]);

export const RESPONSIBILITY_FIELD_QUESTIONS = Object.freeze({
  trigger: {
    questionIdSuffix: "trigger",
    prompt: "What starts this?",
    why: "Need a clear trigger.",
    examples: [
      "A form is submitted",
      "A call is missed",
      "No reply for 24 hours",
    ],
  },
  observe_where: {
    questionIdSuffix: "observe_where",
    prompt: "Where should VIBETech see that?",
    why: "Need a real system — not a guess.",
    examples: [
      "CRM / Work",
      "Business phone or SMS",
      "Gmail or Calendar",
    ],
  },
  actions: {
    questionIdSuffix: "actions",
    prompt: "What should happen when it fires?",
    why: "Keep it concrete.",
    examples: ["Call, then text", "Log and assign", "Send a reminder"],
  },
  approvals: {
    questionIdSuffix: "approvals",
    prompt: "What needs your OK before it goes out?",
    why: "Sets safe autonomy.",
    examples: [
      "First external message",
      "Nothing for reminders",
      "Everything until shadow mode ends",
    ],
  },
  subjects: {
    questionIdSuffix: "subjects",
    prompt: "Who is this for?",
    why: "Eligibility must be explicit.",
    examples: [],
  },
  required_information: {
    questionIdSuffix: "required_information",
    prompt: "What info is required?",
    why: "Missing facts become constraints.",
    examples: [],
  },
  success_proof: {
    questionIdSuffix: "success_proof",
    prompt: "What proves it worked?",
    why: "No proof, no live claim.",
    examples: ["CRM updated", "Message sent", "Meeting booked"],
  },
  failure_behavior: {
    questionIdSuffix: "failure_behavior",
    prompt: "If it cannot proceed, what next?",
    why: "Avoid silent drops.",
    examples: ["Ask the owner", "Retry once", "Stop and note it"],
  },
});

export function planResponsibilityClarificationQuestions(request, { limit = 2 } = {}) {
  const unresolved = (Array.isArray(request?.unresolvedFields) ? request.unresolvedFields : [])
    .filter((field) => CLARIFY_FIELD_PRIORITY.includes(String(field)));
  const title = String(request?.title ?? "This responsibility");
  const questions = [];

  for (const field of CLARIFY_FIELD_PRIORITY) {
    if (!unresolved.includes(field)) continue;
    const meta = RESPONSIBILITY_FIELD_QUESTIONS[field];
    if (!meta) continue;
    const examples = (Array.isArray(meta.examples) ? meta.examples : []).slice(0, 3);
    const examplesBlock = examples.length
      ? `\n\nExamples:\n${examples.map((e) => `• ${e}`).join("\n")}`
      : "";
    questions.push(createBuilderQuestion({
      questionId: `q_resp_${request.responsibilityId}_${meta.questionIdSuffix}`,
      // Short question only — title rides in `why` as a quiet label.
      prompt: `${meta.prompt}${examplesBlock}`,
      why: title,
      required: true,
      topic: "responsibility_contract",
      metadata: {
        responsibilityId: request.responsibilityId,
        field,
      },
    }));
    if (questions.length >= limit) break;
  }

  return deepFreeze(questions);
}

/**
 * Pick missing fields across responsibilities — hard-capped session budget.
 */
export function planNextResponsibilityQuestions({
  responsibilityRequests = [],
  answers = [],
  limit = MAX_CLARIFY_QUESTIONS,
} = {}) {
  const answeredIds = new Set(
    (Array.isArray(answers) ? answers : []).map((a) => String(a.questionId)),
  );
  const budget = Math.min(
    MAX_CLARIFY_QUESTIONS,
    Math.max(0, Number(limit) || MAX_CLARIFY_QUESTIONS),
  );
  const active = (Array.isArray(responsibilityRequests) ? responsibilityRequests : [])
    .filter((r) => ["confirmed", "clarifying"].includes(String(r.status)));

  // Prefer needs-rules / needs-access over already-ready.
  const ranked = [...active].sort((a, b) => rankMode(a.implementationMode) - rankMode(b.implementationMode));

  const out = [];
  for (const request of ranked) {
    const planned = planResponsibilityClarificationQuestions(request, { limit: budget })
      .filter((q) => !answeredIds.has(String(q.questionId)));
    for (const question of planned) {
      out.push(question);
      if (out.length >= budget) return deepFreeze(out);
    }
  }
  return deepFreeze(out);
}

function rankMode(mode) {
  switch (String(mode)) {
    case "unsupported_or_unsafe":
      return 0;
    case "ready_after_customer_access":
      return 1;
    case "ready_after_business_rules":
      return 2;
    case "requires_reusable_capability":
      return 3;
    case "operator_assisted":
      return 4;
    case "ready_existing_capabilities":
      return 5;
    default:
      return 6;
  }
}
