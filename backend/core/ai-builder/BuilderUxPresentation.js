import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { scrubOwnerFacingPurpose } from "./businessIdentity.js";

export const BUILDER_JOURNEY_STAGES = Object.freeze([
  {
    id: "about",
    label: "About your business",
    topics: ["identity", "industry"],
  },
  {
    id: "work",
    label: "How work gets done",
    topics: ["operations", "approvals", "pain_points", "outcomes"],
  },
  {
    id: "team",
    label: "Your team",
    topics: ["team", "permissions"],
  },
  {
    id: "customers",
    label: "Customers and services",
    topics: ["customers", "services"],
  },
  {
    id: "systems",
    label: "Systems and communication",
    topics: ["software", "communications", "integrations"],
  },
  {
    id: "os",
    label: "Recommended operating system",
    topics: [],
  },
]);

const TECHNICAL_FIELD_PATTERN = /(Runtime|schemaVersion|contentHash|planHash|operationType|capabilityId|moduleId|roleId|employeeId|specificationId|__)/i;

/**
 * Plain-language Architect UX helpers — never expose raw schema to clients.
 * Owner language: conversation → recommendation → approve → live (not Builder/Launch).
 */
export function discoveryStageProgress({ answers = [], questions = [], progress = {}, businessSummary = {} } = {}) {
  const answeredTopics = new Set();
  for (const answer of answers) {
    if (answer.skipped || answer.unknown) continue;
    const question = questions.find((entry) => entry.questionId === answer.questionId)
      ?? null;
    if (question?.topic) answeredTopics.add(question.topic);
  }
  if (businessSummary.businessName || businessSummary.description) answeredTopics.add("identity");
  if (businessSummary.industry) answeredTopics.add("industry");

  const stages = BUILDER_JOURNEY_STAGES.map((stage) => {
    if (stage.id === "os") {
      return {
        ...stage,
        status: progress.readyForProposal ? "complete" : "upcoming",
      };
    }
    const covered = stage.topics.filter((topic) => answeredTopics.has(topic));
    const status = covered.length === 0
      ? "upcoming"
      : covered.length >= Math.ceil(stage.topics.length / 2)
        ? "complete"
        : "active";
    return { ...stage, status, coveredTopics: covered };
  });

  const active = stages.find((stage) => stage.status === "active")
    ?? stages.find((stage) => stage.status === "upcoming")
    ?? stages[stages.length - 1];

  return deepFreeze({
    stages,
    activeStageId: active.id,
    activeStageLabel: active.label,
    percent: progress.percent ?? 0,
    label: progress.label ?? active.label,
    readyForProposal: Boolean(progress.readyForProposal),
  });
}

export function sessionListCard(session) {
  const name = session.businessSummary?.businessName
    ?? session.appearance?.businessName
    ?? "Untitled business";
  const stage = String(session.currentStage ?? "created").replace(/_/g, " ");
  const nextAction = nextActionForSession(session);
  const conversation = Array.isArray(session.conversation) ? session.conversation : [];
  const firstUser = conversation.find((entry) => entry?.role === "user" && String(entry.text ?? "").trim());
  const lastMessage = [...conversation].reverse().find((entry) => String(entry?.text ?? "").trim());
  const continuousImprovement = Boolean(
    session.metadata?.continuousImprovement
    || /improve|continuous|expand_existing/i.test(String(session.mode ?? "")),
  );
  const askTitle = String(
    session.metadata?.askTitle
    ?? firstUser?.text
    ?? (continuousImprovement ? "New conversation" : name),
  ).trim().slice(0, 80);
  const messageCount = conversation.filter((entry) => String(entry?.text ?? "").trim()).length;
  const hasUserMessage = Boolean(firstUser);
  const answerCount = Array.isArray(session.answers) ? session.answers.length : 0;
  const emptyAsk = continuousImprovement && !hasUserMessage;
  const preview = emptyAsk
    ? ""
    : String(lastMessage?.text ?? "").trim().slice(0, 120);
  return deepFreeze({
    sessionId: session.sessionId,
    businessId: session.businessId,
    businessName: name,
    mode: session.mode,
    stage,
    stageKey: session.currentStage,
    progressPercent: session.progress?.percent ?? 0,
    progressLabel: session.progress?.label ?? stage,
    updatedAt: session.updatedAt,
    createdAt: session.createdAt,
    nextAction,
    canContinue: !["archived", "failed"].includes(String(session.currentStage)),
    isInstalled: session.currentStage === "installed",
    continuousImprovement,
    title: askTitle || "New conversation",
    preview,
    messageCount,
    hasUserMessage,
    answerCount,
    emptyAsk,
  });
}

export function nextActionForSession(session) {
  switch (session.currentStage) {
    case "proposal_ready":
    case "awaiting_review":
      return "Review how VIBETech recommends running your business";
    case "dry_run_ready":
      return "Review readiness, then approve to go live";
    case "awaiting_approval":
      return "Approve and go live";
    case "installing":
      return "Going live — you can resume if interrupted";
    case "installed":
      return "Open your business or ask VIBETech to improve it";
    case "blocked":
    case "failed":
      return "Resolve the issue and retry";
    default:
      return session.questions?.[0]?.prompt
        ? "Answer the next question"
        : "Tell us about your business";
  }
}

export function stripTechnicalFields(value, { depth = 0 } = {}) {
  if (depth > 8) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => stripTechnicalFields(entry, { depth: depth + 1 }));
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (TECHNICAL_FIELD_PATTERN.test(key)) continue;
    if (typeof entry === "string" && /Runtime$/.test(entry)) continue;
    out[key] = stripTechnicalFields(entry, { depth: depth + 1 });
  }
  return out;
}

export function clientSafeProposalView(proposal) {
  if (!proposal) return null;
  const safe = stripTechnicalFields(proposal);
  return deepFreeze({
    ...safe,
    views: Object.fromEntries(
      Object.entries(proposal.views ?? {}).map(([key, view]) => [
        key,
        {
          title: view.title,
          headline: view.headline,
          note: view.note,
          items: (view.items ?? []).map(clientSafeItem),
          cards: (view.cards ?? []).map(clientSafeItem),
          bullets: view.bullets ?? [],
          overflow: view.overflow ?? [],
        },
      ]),
    ),
  });
}

function clientSafeItem(item) {
  if (item == null || typeof item !== "object") return item;
  const label = item.label ?? item.title;
  return {
    id: item.id,
    label,
    title: item.title ?? item.label,
    purpose: item.purpose == null
      ? item.purpose
      : scrubOwnerFacingPurpose(item.purpose, { roleLabel: label }),
    emptyState: item.emptyState,
    status: humanizeStatus(item.status),
    kind: humanizeStatus(item.kind),
    modules: item.modules,
    denied: item.denied,
    approvals: (item.approvals ?? []).map(humanizeStatus),
    approvalRequired: item.approvalRequired,
    responsibilities: item.responsibilities,
    readiness: humanizeStatus(item.readiness),
    knowledgeNeeded: item.knowledgeNeeded,
    integrationsNeeded: item.integrationsNeeded,
    escalation: item.escalation,
    ownerAdded: Boolean(item.ownerAdded),
  };
}

export function humanizeStatus(value) {
  if (value == null) return value;
  return String(value).replace(/_/g, " ");
}

export function quickRepliesForQuestion(question) {
  if (!question) return [];
  // Choice questions only — never surface the next discovery prompts as reply chips.
  if (Array.isArray(question.options) && question.options.length) {
    return question.options.map((option) => humanizeStatus(option));
  }
  return [];
}
