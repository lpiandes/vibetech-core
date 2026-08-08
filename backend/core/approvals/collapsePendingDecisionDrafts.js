/**
 * Keep pending Decision drafts honest: one open prove draft per source, no spam queue.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/** Sources that are controlled prove / practice drafts — replace instead of stacking. */
export const REPLACEABLE_DECISION_DRAFT_SOURCES = deepFreeze([
  "website_form_prove",
  "meta_lead_prove",
  "website_chat_prove",
  "form_prove",
]);

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function isReplaceableDecisionDraftSource(source) {
  const s = String(source ?? "").toLowerCase();
  return REPLACEABLE_DECISION_DRAFT_SOURCES.some((id) => s === id || s.endsWith(`_${id}`) || s.includes(id));
}

export function isPendingDecisionDraftStatus(status) {
  const s = String(status ?? "pending_approval").toLowerCase();
  return s === "pending_approval" || s === "pending";
}

/**
 * Collapse drafts so each replaceable source keeps only the newest pending row.
 * Non-prove drafts are kept as-is (still capped by caller).
 */
export function collapsePendingDecisionDrafts(drafts = []) {
  const list = safeArray(drafts).filter((d) => d && d.id);
  const kept = [];
  const latestBySource = new Map();

  for (const draft of list) {
    const source = String(draft.source ?? "");
    if (!isReplaceableDecisionDraftSource(source) || !isPendingDecisionDraftStatus(draft.status)) {
      kept.push(draft);
      continue;
    }
    const prev = latestBySource.get(source);
    const prevAt = Date.parse(String(prev?.createdAt ?? 0)) || 0;
    const nextAt = Date.parse(String(draft.createdAt ?? 0)) || 0;
    if (!prev || nextAt >= prevAt) {
      latestBySource.set(source, draft);
    }
  }

  for (const draft of latestBySource.values()) kept.push(draft);

  // Stable-ish order: decided/other first, then by createdAt
  kept.sort((a, b) => {
    const aAt = Date.parse(String(a.createdAt ?? 0)) || 0;
    const bAt = Date.parse(String(b.createdAt ?? 0)) || 0;
    return aAt - bAt;
  });

  return deepFreeze(kept);
}

/**
 * Append (or replace) a draft into the list using collapse rules.
 */
export function upsertPendingDecisionDraft(drafts = [], nextDraft) {
  if (!nextDraft?.id) return collapsePendingDecisionDrafts(drafts);
  const source = String(nextDraft.source ?? "");
  let list = safeArray(drafts).filter((d) => d && String(d.id) !== String(nextDraft.id));
  if (isReplaceableDecisionDraftSource(source) && isPendingDecisionDraftStatus(nextDraft.status)) {
    list = list.filter((d) => !(
      isReplaceableDecisionDraftSource(d?.source)
      && String(d.source) === source
      && isPendingDecisionDraftStatus(d?.status)
    ));
  }
  list.push(nextDraft);
  return collapsePendingDecisionDrafts(list);
}
