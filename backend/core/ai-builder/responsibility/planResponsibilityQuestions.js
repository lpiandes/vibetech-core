import { createBuilderQuestion } from "../BuilderQuestion.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Unresolved-contract-field-first questions for one responsibility.
 * Does not walk the old topic bank.
 */

export const RESPONSIBILITY_FIELD_QUESTIONS = Object.freeze({
  trigger: {
    questionIdSuffix: "trigger",
    prompt: "What starts this work?",
    why: "VIBETech needs a reliable trigger — not a vague hope.",
    examples: [
      "A call is missed",
      "A form is submitted",
      "Wednesday at 8:00 AM",
      "A proposal has had no response for five days",
    ],
  },
  observe_where: {
    questionIdSuffix: "observe_where",
    prompt: "Where can VIBETech observe that trigger?",
    why: "We will not invent a data source. Choose how events become visible.",
    examples: [
      "Twilio / business phone",
      "Gmail or Outlook",
      "Calendar",
      "MLS feed or CRM",
      "Uploaded spreadsheet",
      "Website webhook",
    ],
  },
  actions: {
    questionIdSuffix: "actions",
    prompt: "What should VIBETech do when this fires?",
    why: "Actions must be concrete enough to test and prove.",
    examples: ["Research", "Draft", "Send", "Schedule", "Assign", "Escalate", "Generate a report"],
  },
  subjects: {
    questionIdSuffix: "subjects",
    prompt: "Who or what is affected?",
    why: "Eligibility must be explicit so the wrong people are not contacted.",
  },
  required_information: {
    questionIdSuffix: "required_information",
    prompt: "What information is required to proceed?",
    why: "Missing facts become constraints — not silent guesses.",
  },
  approvals: {
    questionIdSuffix: "approvals",
    prompt: "What requires your approval before it goes out?",
    why: "Approval boundaries define safe autonomy.",
    examples: [
      "Every first external message",
      "Nothing for appointment reminders",
      "Everything until shadow mode is complete",
    ],
  },
  success_proof: {
    questionIdSuffix: "success_proof",
    prompt: "What proves this succeeded?",
    why: "No proof, no live claim.",
    examples: [
      "SMS provider confirms send",
      "Email delivery confirmed",
      "Calendar event exists",
      "CRM record updated",
      "Meeting booked",
    ],
  },
  failure_behavior: {
    questionIdSuffix: "failure_behavior",
    prompt: "What should happen when it cannot proceed?",
    why: "Failure paths prevent silent drops.",
    examples: [
      "Ask the owner",
      "Assign an operator",
      "Retry the provider",
      "Skip the recipient",
      "Stop the workflow",
    ],
  },
});

export function planResponsibilityClarificationQuestions(request, { limit = 4 } = {}) {
  const unresolved = Array.isArray(request?.unresolvedFields) ? request.unresolvedFields : [];
  const title = String(request?.title ?? "This responsibility");
  const questions = [];

  for (const field of unresolved) {
    const meta = RESPONSIBILITY_FIELD_QUESTIONS[field];
    if (!meta) continue;
    const examples = Array.isArray(meta.examples) && meta.examples.length
      ? `\n\nExamples:\n${meta.examples.map((e) => `• ${e}`).join("\n")}`
      : "";
    questions.push(createBuilderQuestion({
      questionId: `q_resp_${request.responsibilityId}_${meta.questionIdSuffix}`,
      prompt: `${title}\n\n${meta.prompt}${examples}`,
      why: meta.why,
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
 * Pick the highest-value unresolved responsibility, then its missing fields.
 */
export function planNextResponsibilityQuestions({
  responsibilityRequests = [],
  answers = [],
  limit = 3,
} = {}) {
  const answeredIds = new Set(
    (Array.isArray(answers) ? answers : []).map((a) => String(a.questionId)),
  );
  const active = (Array.isArray(responsibilityRequests) ? responsibilityRequests : [])
    .filter((r) => ["confirmed", "clarifying"].includes(String(r.status)));

  // Prefer needs-rules / needs-access over already-ready.
  const ranked = [...active].sort((a, b) => rankMode(a.implementationMode) - rankMode(b.implementationMode));

  for (const request of ranked) {
    const planned = planResponsibilityClarificationQuestions(request, { limit: 8 })
      .filter((q) => !answeredIds.has(String(q.questionId)));
    if (planned.length) {
      return planned.slice(0, limit);
    }
  }
  return deepFreeze([]);
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
