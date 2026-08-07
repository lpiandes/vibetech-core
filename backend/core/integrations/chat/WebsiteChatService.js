/**
 * Native website chat — deterministic Knowledge-grounded replies, lead-signal
 * extraction, and durable transcript persistence on the Business OS installation.
 *
 * Mirrors the existing deterministic Knowledge-consult pattern (no invented
 * answers — see consultSpecialtySources.js / CampaignKnowledgeAssembler.js):
 * score ready Knowledge documents by token overlap with the visitor message,
 * cite the matched excerpt, and fall back to an honest "I don't know" reply
 * (never fabricated) when nothing matches or Knowledge is empty.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "have", "with",
  "this", "that", "what", "when", "where", "how", "can", "does", "do", "did",
  "about", "from", "will", "our", "who", "why", "which", "was", "were",
  "been", "being", "has", "had", "just", "some", "than", "then", "there",
]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const NAME_PATTERNS = [
  /\bmy name is\s+([a-z][a-z' -]{1,60})/i,
  /\bthis is\s+([a-z][a-z' -]{1,40})\b/i,
  /\bit'?s\s+([a-z][a-z' -]{1,40})\s+(?:here|writing|calling)\b/i,
];

/** Cap thread history so installation.configuration stays lean. */
export const MAX_CHAT_THREADS = 50;
export const MAX_TURNS_PER_THREAD = 40;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function knowledgeExcerpt(doc, maxChars = 320) {
  const text = normalizeText(doc?.contentText ?? doc?.excerpt ?? "");
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, "")}…`;
}

/**
 * Ready, non-deleted Knowledge documents for a tenant (defensive filter —
 * callers already scope the query by businessId, this guards against
 * accidental cross-tenant leakage if a caller passes a mixed list).
 */
export function readyKnowledgeDocuments(documents = [], businessId = null) {
  return safeArray(documents)
    .filter((doc) => !businessId || String(doc?.businessId ?? businessId) === String(businessId))
    .filter((doc) => String(doc?.status ?? "ready") === "ready")
    .filter((doc) => !doc?.deletedAt);
}

/**
 * Deterministic token-overlap ranking — no RAG, no invention. Only ready
 * documents whose excerpt shares at least one meaningful token with the
 * visitor's message are returned.
 */
export function matchKnowledgeForMessage({
  documents = [],
  message = "",
  businessId = null,
  limit = 3,
} = {}) {
  const ready = readyKnowledgeDocuments(documents, businessId).filter((doc) => knowledgeExcerpt(doc));
  const queryTokens = tokenize(message);
  if (!queryTokens.length) return deepFreeze([]);

  const scored = ready.map((doc) => {
    const excerpt = knowledgeExcerpt(doc);
    const title = String(doc.title ?? doc.originalFilename ?? "Knowledge document");
    const hay = `${title} ${excerpt}`.toLowerCase();
    const hits = queryTokens.filter((token) => hay.includes(token)).length;
    return { id: String(doc.id), title, excerpt, hits };
  });

  const matched = scored
    .filter((doc) => doc.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.title.localeCompare(b.title));

  return deepFreeze(matched.slice(0, Math.max(1, Number(limit) || 3)));
}

/**
 * Compose the visitor-facing reply. Grounded when a Knowledge match exists;
 * otherwise an honest fallback — never fabricates business specifics.
 */
export function buildChatReply({
  message = "",
  documents = [],
  businessId = null,
  businessName = "",
  limit = 3,
} = {}) {
  const ready = readyKnowledgeDocuments(documents, businessId);
  const matches = matchKnowledgeForMessage({ documents, message, businessId, limit });
  const greeting = businessName ? `Thanks for reaching out to ${businessName}.` : "Thanks for reaching out.";

  if (matches.length) {
    const primary = matches[0];
    const citation = matches.length > 1
      ? `(From: ${matches.map((m) => m.title).join("; ")}.)`
      : `(From: ${primary.title}.)`;
    return deepFreeze({
      text: `${primary.excerpt}\n\n${citation}`,
      groundedInKnowledge: true,
      citedDocumentIds: matches.map((m) => m.id),
      citedDocuments: matches.map((m) => deepFreeze({ id: m.id, title: m.title })),
    });
  }

  if (!ready.length) {
    return deepFreeze({
      text: `${greeting} We don't have any Knowledge documents loaded yet, so I don't want to guess at specifics — a teammate will follow up personally. Feel free to share your name and email in the meantime.`,
      groundedInKnowledge: false,
      citedDocumentIds: [],
      citedDocuments: [],
    });
  }

  return deepFreeze({
    text: `${greeting} I don't have a confirmed answer to that in our Knowledge base yet, so I don't want to guess. Share your email or phone number and a teammate will follow up personally.`,
    groundedInKnowledge: false,
    citedDocumentIds: [],
    citedDocuments: [],
  });
}

/** Best-effort, deterministic email/phone/name extraction from free-text chat. */
export function extractLeadSignals(message = "") {
  const text = String(message ?? "");
  const emailMatch = text.match(EMAIL_RE);
  const phoneMatch = text.match(PHONE_RE);
  let name = "";
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      name = match[1].trim().replace(/[.,!?]+$/, "");
      break;
    }
  }
  return {
    email: emailMatch ? emailMatch[0].toLowerCase() : "",
    phone: phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, "") : "",
    name,
  };
}

/** Merge explicit visitor-supplied fields with signals parsed from the message text. */
export function resolveChatContactSignals({
  message = "",
  visitorName = "",
  visitorEmail = "",
  visitorPhone = "",
} = {}) {
  const parsed = extractLeadSignals(message);
  return {
    name: String(visitorName ?? "").trim() || parsed.name,
    email: String(visitorEmail ?? "").trim() || parsed.email,
    phone: String(visitorPhone ?? "").trim() || parsed.phone,
  };
}

export function readWebsiteChatThreads(installation = null) {
  const raw = installation?.configuration?.websiteChatThreads;
  return safeArray(raw);
}

export function findWebsiteChatThread(threads = [], threadId) {
  const id = String(threadId ?? "").trim();
  if (!id) return null;
  return safeArray(threads).find((thread) => String(thread?.id) === id) ?? null;
}

/**
 * Pure append of visitor/assistant turns onto a thread, capped so the
 * installation.configuration blob stays bounded. Returns the full next
 * threads array (caller persists via persistWebsiteChatThreads).
 */
export function appendChatTurns({
  threads = [],
  threadId,
  turns = [],
  contactId = null,
  nowISO = new Date().toISOString(),
  maxThreads = MAX_CHAT_THREADS,
  maxTurnsPerThread = MAX_TURNS_PER_THREAD,
} = {}) {
  const id = String(threadId ?? "").trim();
  if (!id) throw new Error("appendChatTurns requires threadId");

  const list = safeArray(threads).map((thread) => ({ ...thread }));
  let thread = list.find((t) => String(t?.id) === id);
  if (!thread) {
    thread = { id, createdAt: nowISO, turns: [], contactId: null };
    list.push(thread);
  }
  thread.turns = [...safeArray(thread.turns), ...safeArray(turns)].slice(-Math.max(1, maxTurnsPerThread));
  thread.contactId = contactId ?? thread.contactId ?? null;
  thread.updatedAt = nowISO;

  return deepFreeze(list.slice(-Math.max(1, maxThreads)));
}

/**
 * Persist the updated thread list onto installation.configuration.websiteChatThreads
 * — same read/mutate/write shape as CrmStore.writeCrmState.
 */
export async function persistWebsiteChatThreads({
  platformStore,
  installation,
  threads,
  actorId = "website_chat",
  nowISO = new Date().toISOString(),
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("persistWebsiteChatThreads requires platformStore and installation");
  }
  const priorHistory = Array.isArray(installation.history) ? installation.history : [];
  const history = [
    ...priorHistory.slice(-49),
    { at: nowISO, action: "website_chat_message", actorId },
  ];
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "website_chat",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      websiteChatThreads: threads,
    },
    history,
    installedAt: installation.installedAt ?? null,
    updatedAt: nowISO,
    updatedBy: actorId,
  });
  return nowISO;
}
