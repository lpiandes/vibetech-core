/**
 * Lightweight persistence for synced Gmail inbox messages.
 *
 * v1 storage shape: `installation.configuration.gmailInbox` (array of parsed messages,
 * newest first) + `installation.configuration.gmailInboxSync` (last sync bookkeeping).
 *
 * This mirrors CrmStore's read -> mutate -> write pattern but intentionally does NOT
 * route through CommunicationRuntime yet (see GmailInboundSyncService for the TODO on
 * that heavier wiring). It is a pragmatic v1 read path: enough for a "Sync now" +
 * inbox list/detail UI without touching the event-sourced communications runtime.
 */

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

const MAX_STORED_MESSAGES = 500;

export function emptyGmailInboxState() {
  return {
    version: 1,
    messages: [],
    updatedAt: null,
  };
}

export function emptyGmailInboxSyncState() {
  return {
    version: 1,
    lastSyncAt: null,
    lastSyncOk: null,
    lastSyncError: null,
    historyId: null,
    messageCount: 0,
  };
}

export function readGmailInboxState(installation = null) {
  const raw = installation?.configuration?.gmailInbox;
  if (!raw) return emptyGmailInboxState();
  if (Array.isArray(raw)) {
    return { version: 1, messages: raw, updatedAt: null };
  }
  if (typeof raw === "object") {
    return {
      version: 1,
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      updatedAt: raw.updatedAt ?? null,
    };
  }
  return emptyGmailInboxState();
}

export function readGmailInboxSyncState(installation = null) {
  const raw = installation?.configuration?.gmailInboxSync;
  if (!raw || typeof raw !== "object") return emptyGmailInboxSyncState();
  return {
    version: 1,
    lastSyncAt: raw.lastSyncAt ?? null,
    lastSyncOk: raw.lastSyncOk ?? null,
    lastSyncError: raw.lastSyncError ?? null,
    historyId: raw.historyId ?? null,
    messageCount: Number(raw.messageCount ?? 0) || 0,
  };
}

export function findStoredMessageByGmailId(inboxState, gmailMessageId) {
  const id = safeString(gmailMessageId);
  if (!id) return null;
  return (inboxState?.messages ?? []).find((m) => safeString(m?.gmailMessageId) === id) ?? null;
}

/**
 * Pure merge of newly-fetched messages into existing stored state (dedup by gmailMessageId,
 * newest-first, capped). No I/O — callers persist via writeGmailInboxState.
 */
export function mergeInboundMessages(inboxState, newMessages = []) {
  const existingById = new Map((inboxState?.messages ?? []).map((m) => [safeString(m.gmailMessageId), m]));
  let added = 0;
  for (const msg of newMessages) {
    const id = safeString(msg.gmailMessageId);
    if (!id) continue;
    if (existingById.has(id)) continue;
    existingById.set(id, msg);
    added += 1;
  }
  const merged = [...existingById.values()].sort((a, b) => {
    const at = a.receivedAt ? Date.parse(a.receivedAt) : 0;
    const bt = b.receivedAt ? Date.parse(b.receivedAt) : 0;
    return bt - at;
  });
  return {
    state: {
      version: 1,
      messages: merged.slice(0, MAX_STORED_MESSAGES),
      updatedAt: new Date().toISOString(),
    },
    added,
  };
}

export async function writeGmailInboxState({
  platformStore,
  installation,
  inbox,
  sync,
  actorId = null,
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("writeGmailInboxState requires platformStore and installation");
  }
  const nextInbox = {
    ...inbox,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const nextSync = {
    ...readGmailInboxSyncState(installation),
    ...sync,
    version: 1,
  };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "gmail_inbox_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration ?? {}),
      gmailInbox: nextInbox,
      gmailInboxSync: nextSync,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      {
        at: nextInbox.updatedAt,
        action: "gmail_inbox_sync",
        actorId,
      },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return { inbox: nextInbox, sync: nextSync };
}

/**
 * Persist (or clear) a not-yet-sent draft reply on a stored message.
 * Approve-first: this never sends anything, it only records intent for a human to review.
 */
export function setDraftReplyOnMessage(inboxState, { gmailMessageId, draftReply } = {}) {
  const id = safeString(gmailMessageId);
  const messages = (inboxState?.messages ?? []).map((m) => {
    if (safeString(m.gmailMessageId) !== id) return m;
    return { ...m, draftReply: draftReply ?? null };
  });
  return { version: 1, messages, updatedAt: new Date().toISOString() };
}
