import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { VIEW_ID_COMMUNICATIONS, QUEUE_DEFS, ACTION_TYPES, ACTION_PRIORITIES_DEFAULT, ATTENTION_CATEGORIES, RECEIVED_REQUIRES_RESPONSE_DIRECTION, QUEUED_WAIT_TOO_LONG_MS, DRAFTS_OLDER_THAN_MS } from "./CommunicationViewDefaults.js";

import { createCommunicationViewModel } from "./CommunicationViewModel.js";
import { validateCommunicationViewModel } from "./CommunicationViewValidator.js";

import { createCommunicationThreadView } from "./CommunicationThreadView.js";
import { createCommunicationMessageView } from "./CommunicationMessageView.js";
import { createCommunicationParticipantView } from "./CommunicationParticipantView.js";
import { createCommunicationQueueView } from "./CommunicationQueueView.js";
import { createCommunicationAttentionItem, createCommunicationAttentionView } from "./CommunicationAttentionView.js";
import { createCommunicationActionView } from "./CommunicationActionView.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function parseTimeMs(iso) {
  const s = safeString(iso);
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of safeArray(arr)) {
    const s = String(x);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function extractWorkItemIdsFromRelatedObjects(relatedObjects) {
  // relatedObjects is an untyped canonical list; best-effort extraction.
  const objs = safeArray(relatedObjects);
  const ids = [];
  for (const o of objs) {
    if (typeof o === "string") ids.push(String(o));
    if (!o || typeof o !== "object") continue;
    const wid =
      o.workItemId ??
      o.workId ??
      o.work_item_id ??
      o.id ??
      (o.type === "work" ? o.id : null);
    if (wid) ids.push(String(wid));
  }
  return uniqStrings(ids);
}

function makeActionId(type, target, scopeId) {
  return `act_${type}_${String(target ?? "")}_${String(scopeId ?? "")}`;
}

function labelForActionType(type) {
  switch (String(type)) {
    case ACTION_TYPES.review_message:
      return "Review Message";
    case ACTION_TYPES.send_message:
      return "Send Message";
    case ACTION_TYPES.retry_message:
      return "Retry Message";
    case ACTION_TYPES.archive_thread:
      return "Archive Thread";
    case ACTION_TYPES.reply_to_message:
      return "Reply To Message";
    case ACTION_TYPES.view_related_work:
      return "View Related Work";
    case ACTION_TYPES.assign_owner:
      return "Assign Owner";
    default:
      return String(type);
  }
}

function actionPriorityFor(type) {
  return ACTION_PRIORITIES_DEFAULT[String(type)] ?? "later";
}

function badgeForMessage(msg) {
  const status = String(msg.status ?? "");
  const badges = [];
  if (status === "failed") badges.push("Failed");
  if (status === "queued") badges.push("Queued");
  if (status === "sent") badges.push("Sent");
  if (status === "received") badges.push("Received");
  if (status === "draft") badges.push("Draft");

  return badges;
}

export class CommunicationViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  translate({
    communicationRuntime,
    workRuntime,
    teamRuntime,
    companyWorkspaceRuntime,
    nowISO,
    workViewModel,
    teamViewModel,
    missionControl,
  } = {}) {
    if (!communicationRuntime) throw new Error("CommunicationViewAdapter.translate requires communicationRuntime.");

    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";
    const nowMs = parseTimeMs(effectiveNowISO);

    const companyId = String(companyWorkspaceRuntime?.getCompany?.()?.companyName ?? "company");

    // Read-only signals.
    const threads = safeArray(communicationRuntime.getThreads?.());
    const messages = safeArray(communicationRuntime.getMessages?.());
    const teamMembers = safeArray(teamRuntime?.getMembers?.());

    // Index messages by thread.
    const messagesByThreadId = new Map();
    for (const m of messages) {
      const tid = String(m.threadId);
      if (!messagesByThreadId.has(tid)) messagesByThreadId.set(tid, []);
      messagesByThreadId.get(tid).push(m);
    }
    for (const [tid, list] of messagesByThreadId.entries()) {
      list.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
    }

    // Participant enrichment (best-effort name mapping).
    const memberById = new Map(teamMembers.map((m) => [String(m.id), m]));
    const participantCache = new Map();
    const toParticipantView = (p, fallbackName) => {
      const pid = p?.id ?? "";
      const ptype = p?.type ?? "unknown";
      const member = memberById.get(String(pid));
      const name = member?.name ?? p?.name ?? fallbackName ?? null;

      const key = `${String(pid)}|${String(ptype)}`;
      if (participantCache.has(key)) return participantCache.get(key);

      const view = createCommunicationParticipantView({
        id: String(pid),
        type: String(ptype),
        name,
        metadata: p?.metadata ?? {},
      });
      participantCache.set(key, view);
      return view;
    };

    const actionById = new Map();
    const addAction = (a) => {
      actionById.set(a.id, a);
    };

    // Attention detection across messages.
    const attentionItemsById = new Map();
    const attentionThreadIds = new Set();
    const attentionMessageIds = new Set();

    const createAttention = ({ id, category, priority, summary, metadata }) => {
      if (attentionItemsById.has(id)) return attentionItemsById.get(id);
      const item = createCommunicationAttentionItem({ id, category, priority, summary, metadata });
      attentionItemsById.set(id, item);
      return item;
    };

    const findLatestMessageAt = (threadMessageList) => {
      if (!threadMessageList.length) return null;
      // Prefer explicit terminal timestamps; otherwise createdAt.
      const times = threadMessageList.map((m) => {
        const c = parseTimeMs(m.createdAt);
        const s = parseTimeMs(m.sentAt ?? null);
        const d = parseTimeMs(m.deliveredAt ?? null);
        const f = parseTimeMs(m.failedAt ?? null);
        return Math.max(c, s, d, f);
      });
      const bestIdx = times.reduce((best, t, idx) => (t > times[best] ? idx : best), 0);
      const best = threadMessageList[bestIdx];
      const toMs = (x) => parseTimeMs(x ?? null);
      const finalMs = Math.max(toMs(best.createdAt), toMs(best.sentAt), toMs(best.deliveredAt), toMs(best.failedAt));
      if (!Number.isFinite(finalMs) || finalMs <= 0) return best.createdAt ? String(best.createdAt) : null;
      // Convert deterministically back to ISO-like string format (best effort).
      return new Date(finalMs).toISOString();
    };

    const computeMessageAttention = (msg) => {
      const st = String(msg.status ?? "");
      const createdMs = parseTimeMs(msg.createdAt);
      const ageMs = Math.max(0, nowMs - createdMs);

      const failures = st === "failed";
      const queuedTooLong = st === "queued" && ageMs >= QUEUED_WAIT_TOO_LONG_MS;
      const draftsOld = st === "draft" && ageMs >= DRAFTS_OLDER_THAN_MS;
      const receivedNeedsResponse =
        st === "received" &&
        String(msg.direction ?? "") === RECEIVED_REQUIRES_RESPONSE_DIRECTION &&
        // if inbound received without a sent reply signal, we consider it needs response.
        true;
      const missingRecipients = safeArray(msg.recipients).length === 0 || safeArray(msg.recipients).some((r) => !String(r?.id ?? "").length);
      const missingSender = msg.sender?.id === "unknown_sender" || !String(msg.sender?.id ?? "").length;
      const hasAttention =
        failures || queuedTooLong || draftsOld || receivedNeedsResponse || missingRecipients || missingSender;

      return {
        hasAttention,
        flags: {
          failed_messages: failures,
          queued_too_long: queuedTooLong,
          drafts_old: draftsOld,
          received_needs_response: receivedNeedsResponse,
          missing_recipients: missingRecipients,
          missing_sender: missingSender,
        },
      };
    };

    // First pass: compute attention categories.
    for (const msg of messages) {
      const { hasAttention, flags } = computeMessageAttention(msg);
      if (!hasAttention) continue;
      const mid = String(msg.id);
      attentionMessageIds.add(mid);
      const tid = String(msg.threadId);

      if (flags.failed_messages) {
        const item = createAttention({
          id: `att_msg_failed_${mid}`,
          category: "failed_messages",
          priority: "immediate",
          summary: `Message ${mid} failed.`,
          metadata: deepFreeze({ messageId: mid, threadId: tid }),
        });
        if (item) attentionThreadIds.add(tid);
      }
      if (flags.queued_too_long) {
        createAttention({
          id: `att_msg_queued_old_${mid}`,
          category: "queued_too_long",
          priority: "soon",
          summary: `Queued message ${mid} is waiting too long.`,
          metadata: deepFreeze({ messageId: mid, threadId: tid }),
        });
        attentionThreadIds.add(tid);
      }
      if (flags.drafts_old) {
        createAttention({
          id: `att_msg_draft_old_${mid}`,
          category: "drafts_old",
          priority: "soon",
          summary: `Draft message ${mid} is older than threshold.`,
          metadata: deepFreeze({ messageId: mid, threadId: tid }),
        });
        attentionThreadIds.add(tid);
      }
      if (flags.received_needs_response) {
        createAttention({
          id: `att_msg_received_needs_${mid}`,
          category: "received_needs_response",
          priority: "soon",
          summary: `Received message ${mid} requires response.`,
          metadata: deepFreeze({ messageId: mid, threadId: tid }),
        });
        attentionThreadIds.add(tid);
      }
      if (flags.missing_recipients) {
        createAttention({
          id: `att_msg_missing_recipients_${mid}`,
          category: "missing_recipients",
          priority: "soon",
          summary: `Message ${mid} is missing recipients.`,
          metadata: deepFreeze({ messageId: mid, threadId: tid }),
        });
        attentionThreadIds.add(tid);
      }
      if (flags.missing_sender) {
        createAttention({
          id: `att_msg_missing_sender_${mid}`,
          category: "missing_sender",
          priority: "soon",
          summary: `Message ${mid} is missing sender information.`,
          metadata: deepFreeze({ messageId: mid, threadId: tid }),
        });
        attentionThreadIds.add(tid);
      }
    }

    // Second pass: thread-level attention for threads with failed latest message.
    for (const thread of threads) {
      const tid = String(thread.id);
      const list = safeArray(messagesByThreadId.get(tid));
      const latestAt = findLatestMessageAt(list);
      const latest = list
        .slice()
        .sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
        .slice(-1)[0];

      if (latest && String(latest.status) === "failed") {
        // Only create category once.
        const already = safeArray([...attentionItemsById.values()]).some((i) => String(i.category) === "threads_failed_latest" && String(i.metadata?.threadId) === tid);
        if (!already) {
          createAttention({
            id: `att_thread_failed_latest_${tid}`,
            category: "threads_failed_latest",
            priority: "immediate",
            summary: `Thread ${tid} has a failed latest message.`,
            metadata: deepFreeze({ threadId: tid, latestMessageId: latest.id, latestMessageAt: latestAt }),
          });
        }
        attentionThreadIds.add(tid);
      }
    }

    const attentionItems = Array.from(attentionItemsById.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const attentionSummary =
      attentionThreadIds.size > 0 ? `${attentionThreadIds.size} thread(s) require attention.` : "No communications require immediate attention.";

    // Build queues deterministically.
    const messagesByStatus = new Map();
    for (const m of messages) {
      const st = String(m.status ?? "");
      if (!messagesByStatus.has(st)) messagesByStatus.set(st, []);
      messagesByStatus.get(st).push(m);
    }

    const threadsByStatus = new Map();
    for (const t of threads) {
      const st = String(t.status ?? "");
      if (!threadsByStatus.has(st)) threadsByStatus.set(st, []);
      threadsByStatus.get(st).push(t);
    }

    // Threads & messages views.
    const threadsView = [];
    const messagesView = [];
    const participantsById = new Map();

    const addParticipantToIndex = (pv) => {
      if (!pv?.id) return;
      participantsById.set(String(pv.id), pv);
    };

    // Helper: add thread/message actions.
    const createMessageActions = ({ msg, thread, workItemIds } = {}) => {
      const st = String(msg.status ?? "");
      const actions = [];
      const mid = String(msg.id);
      const tid = String(thread.id);

      const add = (action) => {
        addAction(action);
        actions.push(action);
      };

      if (st === "failed") {
        add(
          createCommunicationActionView({
            id: makeActionId(ACTION_TYPES.retry_message, mid, tid),
            label: labelForActionType(ACTION_TYPES.retry_message),
            type: ACTION_TYPES.retry_message,
            target: mid,
            priority: actionPriorityFor(ACTION_TYPES.retry_message),
            metadata: deepFreeze({ messageId: mid, threadId: tid }),
          }),
        );
      }

      if (st === "queued" || st === "draft") {
        // Review queued/draft when attention triggered.
        const createdMs = parseTimeMs(msg.createdAt);
        const ageMs = Math.max(0, nowMs - createdMs);
        const queuedTooLong = st === "queued" && ageMs >= QUEUED_WAIT_TOO_LONG_MS;
        const draftsOld = st === "draft" && ageMs >= DRAFTS_OLDER_THAN_MS;

        if (queuedTooLong || draftsOld) {
          add(
            createCommunicationActionView({
              id: makeActionId(ACTION_TYPES.review_message, mid, tid),
              label: labelForActionType(ACTION_TYPES.review_message),
              type: ACTION_TYPES.review_message,
              target: mid,
              priority: actionPriorityFor(ACTION_TYPES.review_message),
              metadata: deepFreeze({ messageId: mid, threadId: tid, category: queuedTooLong ? "queued_too_long" : "drafts_old" }),
            }),
          );
        }
      }

      if (st === "draft") {
        // Drafts older than threshold get a send action.
        const createdMs = parseTimeMs(msg.createdAt);
        const ageMs = Math.max(0, nowMs - createdMs);
        if (ageMs >= DRAFTS_OLDER_THAN_MS) {
          add(
            createCommunicationActionView({
              id: makeActionId(ACTION_TYPES.send_message, mid, tid),
              label: labelForActionType(ACTION_TYPES.send_message),
              type: ACTION_TYPES.send_message,
              target: mid,
              priority: actionPriorityFor(ACTION_TYPES.send_message),
              metadata: deepFreeze({ messageId: mid, threadId: tid }),
            }),
          );
        }
      }

      if (String(msg.direction ?? "") === RECEIVED_REQUIRES_RESPONSE_DIRECTION && st === "received") {
        add(
          createCommunicationActionView({
            id: makeActionId(ACTION_TYPES.reply_to_message, mid, tid),
            label: labelForActionType(ACTION_TYPES.reply_to_message),
            type: ACTION_TYPES.reply_to_message,
            target: mid,
            priority: actionPriorityFor(ACTION_TYPES.reply_to_message),
            metadata: deepFreeze({ messageId: mid, threadId: tid }),
          }),
        );
      }

      if (workItemIds?.length) {
        const wid = String(workItemIds[0]);
        add(
          createCommunicationActionView({
            id: makeActionId(ACTION_TYPES.view_related_work, wid, mid),
            label: labelForActionType(ACTION_TYPES.view_related_work),
            type: ACTION_TYPES.view_related_work,
            target: wid,
            priority: actionPriorityFor(ACTION_TYPES.view_related_work),
            metadata: deepFreeze({ workItemId: wid, messageId: mid, threadId: tid }),
          }),
        );

        if (workRuntime) {
          const workItem = workRuntime.getWorkItem?.(wid);
          if (workItem && String(workItem.assignedTo) === "unassigned") {
            add(
              createCommunicationActionView({
                id: makeActionId(ACTION_TYPES.assign_owner, wid, mid),
                label: labelForActionType(ACTION_TYPES.assign_owner),
                type: ACTION_TYPES.assign_owner,
                target: wid,
                priority: actionPriorityFor(ACTION_TYPES.assign_owner),
                metadata: deepFreeze({ workItemId: wid, messageId: mid, threadId: tid }),
              }),
            );
          }
        }
      }

      // Missing sender/recipients should trigger review_message when attention is true.
      const missingRecipients = safeArray(msg.recipients).length === 0;
      const missingSender = msg.sender?.id === "unknown_sender";
      if ((missingRecipients || missingSender) && (st === "queued" || st === "draft" || st === "received" || st === "failed")) {
        if (!actions.some((a) => a.type === ACTION_TYPES.review_message)) {
          add(
            createCommunicationActionView({
              id: makeActionId(ACTION_TYPES.review_message, mid, tid),
              label: labelForActionType(ACTION_TYPES.review_message),
              type: ACTION_TYPES.review_message,
              target: mid,
              priority: actionPriorityFor(ACTION_TYPES.review_message),
              metadata: deepFreeze({ messageId: mid, threadId: tid, category: missingRecipients ? "missing_recipients" : "missing_sender" }),
            }),
          );
        }
      }

      return actions;
    };

    const createThreadActions = ({ thread, workItemIds } = {}) => {
      const actions = [];
      const tid = String(thread.id);
      const add = (action) => {
        addAction(action);
        actions.push(action);
      };

      if (String(thread.status) !== "archived" && attentionThreadIds.has(tid)) {
        add(
          createCommunicationActionView({
            id: makeActionId(ACTION_TYPES.archive_thread, tid, "latest"),
            label: labelForActionType(ACTION_TYPES.archive_thread),
            type: ACTION_TYPES.archive_thread,
            target: tid,
            priority: actionPriorityFor(ACTION_TYPES.archive_thread),
            metadata: deepFreeze({ threadId: tid }),
          }),
        );
      }

      if (workItemIds?.length) {
        const wid = String(workItemIds[0]);
        add(
          createCommunicationActionView({
            id: makeActionId(ACTION_TYPES.view_related_work, wid, tid),
            label: labelForActionType(ACTION_TYPES.view_related_work),
            type: ACTION_TYPES.view_related_work,
            target: wid,
            priority: actionPriorityFor(ACTION_TYPES.view_related_work),
            metadata: deepFreeze({ workItemId: wid, threadId: tid }),
          }),
        );

        if (workRuntime) {
          const workItem = workRuntime.getWorkItem?.(wid);
          if (workItem && String(workItem.assignedTo) === "unassigned") {
            add(
              createCommunicationActionView({
                id: makeActionId(ACTION_TYPES.assign_owner, wid, tid),
                label: labelForActionType(ACTION_TYPES.assign_owner),
                type: ACTION_TYPES.assign_owner,
                target: wid,
                priority: actionPriorityFor(ACTION_TYPES.assign_owner),
                metadata: deepFreeze({ workItemId: wid, threadId: tid }),
              }),
            );
          }
        }
      }

      return actions;
    };

    // Build view objects for threads.
    const threadIdsSorted = threads
      .slice()
      .sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
      .map((t) => String(t.id));

    for (const tid of threadIdsSorted) {
      const thread = threads.find((t) => String(t.id) === tid);
      if (!thread) continue;
      const tMessages = safeArray(messagesByThreadId.get(tid)).slice();

      const latestAt = (() => {
        const times = tMessages.map((m) => Math.max(parseTimeMs(m.createdAt), parseTimeMs(m.sentAt ?? null), parseTimeMs(m.deliveredAt ?? null), parseTimeMs(m.failedAt ?? null)));
        const bestIdx = times.reduce((best, t, idx) => (t > times[best] ? idx : best), 0);
        const ms = times[bestIdx];
        if (!ms || ms <= 0) return null;
        return new Date(ms).toISOString();
      })();

      const attentionRequired = attentionThreadIds.has(tid);
      const badges = [];
      if (attentionRequired) badges.push("Needs Attention");
      if (String(thread.status) === "archived") badges.push("Archived");

      const relatedWorkItemIds = extractWorkItemIdsFromRelatedObjects(thread.relatedObjects);
      for (const wid of relatedWorkItemIds) {
        if (!wid) continue;
        // Placeholder badge hook: keep industry-agnostic.
        if (workRuntime?.getWorkItem?.(wid)) {
          badges.push("Linked Work");
          break;
        }
      }

      const participantViews = safeArray(thread.participants).map((p) => {
        const pv = toParticipantView(p, p?.id);
        addParticipantToIndex(pv);
        return pv;
      });

      // Thread actions.
      const threadActions = createThreadActions({ thread, workItemIds: relatedWorkItemIds });

      // Thread attention should imply message-level attention too.
      const view = createCommunicationThreadView({
        id: tid,
        subject: safeString(thread.subject),
        channel: safeString(thread.channel),
        status: safeString(thread.status),
        participants: participantViews,
        messageCount: tMessages.length,
        latestMessageAt: latestAt,
        relatedObjects: safeArray(thread.relatedObjects),
        attentionRequired,
        badges: uniqStrings(badges),
        actions: threadActions,
        metadata: deepFreeze({
          derivedFrom: { threadId: tid },
        }),
      });
      threadsView.push(view);
    }

    // Build message view objects.
    for (const msg of messages.slice().sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))) {
      const mid = String(msg.id);
      const tid = String(msg.threadId);

      const attentionRequired = attentionMessageIds.has(mid);
      const badges = badgeForMessage(msg);
      if (attentionRequired) badges.push("Needs Attention");

      const workItemIds = extractWorkItemIdsFromRelatedObjects(msg.relatedObjects);

      const senderView = toParticipantView(msg.sender ?? {}, msg.sender?.id);
      addParticipantToIndex(senderView);
      const recipientViews = safeArray(msg.recipients).map((r) => {
        const pv = toParticipantView(r, r?.id);
        addParticipantToIndex(pv);
        return pv;
      });

      const messageActions = createMessageActions({ msg, thread: threads.find((t) => String(t.id) === tid) ?? { id: tid }, workItemIds });

      const view = createCommunicationMessageView({
        id: mid,
        threadId: tid,
        direction: safeString(msg.direction),
        channel: safeString(msg.channel),
        status: safeString(msg.status),
        sender: senderView,
        recipients: recipientViews,
        subject: safeString(msg.subject),
        bodyPreview: safeString(msg.body).slice(0, 120),
        createdAt: safeString(msg.createdAt),
        sentAt: msg.sentAt,
        deliveredAt: msg.deliveredAt,
        failedAt: msg.failedAt,
        relatedObjects: safeArray(msg.relatedObjects),
        attentionRequired,
        badges: uniqStrings(badges),
        actions: messageActions,
        metadata: deepFreeze({ derivedFrom: { messageId: mid, threadId: tid } }),
      });
      messagesView.push(view);
    }

    // Build participant view array.
    const participantsView = Array.from(participantsById.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));

    // Queue generation: map fixed queue defs.
    const queueViews = QUEUE_DEFS.map((q) => {
      const items = (() => {
        if (q.id === "q_drafts") return safeArray(messagesByStatus.get("draft")).map((m) => String(m.id));
        if (q.id === "q_queued") return safeArray(messagesByStatus.get("queued")).map((m) => String(m.id));
        if (q.id === "q_sent") return safeArray(messagesByStatus.get("sent")).map((m) => String(m.id));
        if (q.id === "q_received") return safeArray(messagesByStatus.get("received")).map((m) => String(m.id));
        if (q.id === "q_failed") return safeArray(messagesByStatus.get("failed")).map((m) => String(m.id));
        if (q.id === "q_needs_attention") return threadIdsSorted.filter((tid) => attentionThreadIds.has(tid));
        if (q.id === "q_archived") return threadIdsSorted.filter((tid) => String(threads.find((t) => String(t.id) === tid)?.status) === "archived");
        return [];
      })();

      const summary = (() => {
        if (q.id === "q_needs_attention") {
          return `${items.length} thread(s) awaiting attention`;
        }
        return `${items.length} message(s) in ${q.name}`;
      })();

      const actions = [];
      return createCommunicationQueueView({
        id: q.id,
        name: q.name,
        summary,
        type: String(q.type),
        priority: String(q.priority),
        itemCount: items.length,
        items,
        status: q.status,
        actions: deepFreeze(actions),
        metadata: deepFreeze({ derivedFrom: { queueId: q.id } }),
      });
    });

    const attentionView = createCommunicationAttentionView({
      summary: attentionSummary,
      items: attentionItems,
      metadata: deepFreeze({ derivedFrom: { nowISO: effectiveNowISO } }),
    });

    // Recommended actions: prioritize attention, then dedupe by action id.
    const recommendedActions = Array.from(actionById.values())
      .filter((a) => {
        // only actions that exist on attention objects or are linked-work.
        const target = a.target;
        const isThreadAction = String(target).startsWith("ct_") || String(target).includes("thread");
        const isMessageAction = String(target).startsWith("cm_") || String(target).includes("message");
        const isWorkAction = String(target).startsWith("work_") || String(target).includes("wi");
        if (isThreadAction) return attentionThreadIds.has(String(target));
        if (isMessageAction) return attentionMessageIds.has(String(target));
        if (isWorkAction) return true; // allow enrichment actions
        return true;
      })
      .sort((a, b) => {
        const pa = ACTION_PRIORITIES_DEFAULT[a.type] ?? "later";
        const pb = ACTION_PRIORITIES_DEFAULT[b.type] ?? "later";
        const order = { immediate: 0, soon: 1, later: 2 };
        return (order[String(pa)] ?? 2) - (order[String(pb)] ?? 2) || String(a.id).localeCompare(String(b.id));
      });

    const metrics = deepFreeze({
      totalThreads: threads.length,
      totalMessages: messages.length,
      draftMessages: safeArray(messagesByStatus.get("draft")).length,
      queuedMessages: safeArray(messagesByStatus.get("queued")).length,
      sentMessages: safeArray(messagesByStatus.get("sent")).length,
      failedMessages: safeArray(messagesByStatus.get("failed")).length,
      receivedMessages: safeArray(messagesByStatus.get("received")).length,
      attentionThreadCount: attentionThreadIds.size,
      attentionMessageCount: attentionMessageIds.size,
    });

    const vm = createCommunicationViewModel({
      viewId: VIEW_ID_COMMUNICATIONS,
      companyId,
      generatedAt: effectiveNowISO,
      summary: attentionThreadIds.size > 0 ? `Communications requiring attention: ${attentionThreadIds.size}.` : "No communications require immediate attention.",
      threads: threadsView,
      messages: messagesView,
      participants: participantsView,
      queues: queueViews,
      attention: attentionView,
      recommendedActions,
      metrics,
      metadata: deepFreeze({ derivedFrom: { runtime: true }, nowISO: effectiveNowISO }),
    });

    validateCommunicationViewModel(vm);
    return vm;
  }
}

