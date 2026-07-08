import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { ACTION_TYPES, DEFAULT_REQUEST_QUEUES, REQUEST_VIEW_VERSION } from "./RequestViewDefaults.js";

import { createRequestViewModel } from "./RequestViewModel.js";
import { createRequestItemView } from "./RequestItemView.js";
import { createRequestQueueView } from "./RequestQueueView.js";
import { createRequestAttentionView } from "./RequestAttentionView.js";
import { createRequestActionView } from "./RequestActionView.js";

import { validateRequestViewModel } from "./RequestViewValidator.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function toISO(iso) {
  return typeof iso === "string" && iso ? iso : null;
}

function daysHoursAge(createdAtISO, nowISO) {
  if (!createdAtISO || !nowISO) return "";
  const createdMs = new Date(createdAtISO).getTime();
  const nowMs = new Date(nowISO).getTime();
  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) return "";
  const diffMs = Math.max(0, nowMs - createdMs);
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
  return `${hours}h`;
}

function priorityFromRequestPriority(priority) {
  const p = String(priority ?? "");
  if (p === "high") return "immediate";
  return "soon";
}

function isFinalStatus(status) {
  return ["closed", "cancelled", "rejected"].includes(String(status));
}

function requestSortKey(req) {
  const rId = String(req.id);
  const receivedMs = new Date(String(req.receivedAt)).getTime();
  return [Number.isFinite(receivedMs) ? -receivedMs : 0, rId];
}

function stableSortByReceivedAtDescThenId(requests) {
  const copy = [...requests];
  copy.sort((a, b) => {
    const ka = requestSortKey(a);
    const kb = requestSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1].localeCompare(kb[1]);
  });
  return copy;
}

function isOperationalRequest(req) {
  if (String(req?.requestType) === "crm_import_profile") return false;
  if (req?.metadata?.importOnly === true) return false;
  return true;
}

function computeOperationalRequestMetrics(requests, nowISO) {
  const operational = safeArray(requests).filter(isOperationalRequest);
  const totalRequests = operational.length;
  const newRequests = operational.filter((r) => String(r.status) === "received").length;
  const qualifiedRequests = operational.filter((r) => String(r.status) === "qualified").length;
  const convertedRequests = operational.filter((r) => String(r.status) === "converted").length;
  const closedRequests = operational.filter((r) => String(r.status) === "closed").length;
  const nowMs = new Date(String(nowISO)).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const averageAgeDays =
    !totalRequests || !Number.isFinite(nowMs)
      ? 0
      : Math.round(
          (operational.reduce((acc, r) => {
            const receivedMs = new Date(String(r.receivedAt)).getTime();
            return acc + (Number.isFinite(receivedMs) ? (nowMs - receivedMs) / dayMs : 0);
          }, 0) /
            totalRequests) *
            100,
        ) / 100;
  return {
    totalRequests,
    newRequests,
    qualifiedRequests,
    convertedRequests,
    closedRequests,
    averageAgeDays,
  };
}

function computeQueueTypeByRequest(req) {
  const status = String(req.status);
  if (status === "received") return "new_requests";
  if (status === "reviewing") return "needs_review";
  if (status === "qualified") {
    const hasAssignment = Boolean(req.assignedTeamMemberId ?? req.assignedWorkId);
    return hasAssignment ? "qualified" : "ready_to_convert";
  }
  if (status === "converted") return "converted";
  if (isFinalStatus(status)) return "closed";
  return "new_requests";
}

function toAttentionItem({ id, category, summary, priority, metadata }) {
  return deepFreeze({
    id: String(id),
    category,
    priority: String(priority),
    summary: String(summary),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

function actionLabelForType(type) {
  switch (type) {
    case ACTION_TYPES.review_request:
      return "Review Request";
    case ACTION_TYPES.qualify_request:
      return "Qualify Request";
    case ACTION_TYPES.reject_request:
      return "Reject Request";
    case ACTION_TYPES.convert_to_work:
      return "Convert to Work";
    case ACTION_TYPES.assign_request:
      return "Assign Request";
    case ACTION_TYPES.view_related_work:
      return "View Related Work";
    case ACTION_TYPES.follow_up:
      return "Follow Up";
    case ACTION_TYPES.close_request:
      return "Close Request";
    default:
      return "Action";
  }
}

function actionTargetForAttention({ requestId, fallback }) {
  return requestId ? String(requestId) : fallback;
}

const conversionBacklogThreshold = 3;
const waitingTooLongHours = 48;

export class RequestViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  translate({ requestRuntime, companyRuntime, teamRuntime, workRuntime, nowISO } = {}) {
    if (!requestRuntime) throw new Error("RequestViewAdapter.translate requires requestRuntime.");
    if (!companyRuntime) throw new Error("RequestViewAdapter.translate requires companyRuntime.");
    if (!teamRuntime) throw new Error("RequestViewAdapter.translate requires teamRuntime.");
    if (!workRuntime) throw new Error("RequestViewAdapter.translate requires workRuntime.");

    const effectiveNowISO = nowISO ?? this.nowISO ?? requestRuntime.nowISO ?? "2026-07-01T00:00:00.000Z";
    const companyId = String(companyRuntime.getCompany?.()?.companyName ?? "company");

    const allRequests = safeArray(requestRuntime.getRequests?.());
    const requests = stableSortByReceivedAtDescThenId(allRequests.filter(isOperationalRequest));

    // Work index for deterministic enrichment.
    const workItems = safeArray(workRuntime.getWorkItems?.());
    const workById = new Map(workItems.map((w) => [String(w.id), w]));

    // Team index for deterministic enrichment (optional).
    const members = safeArray(teamRuntime.getMembers?.());
    const memberById = new Map(members.map((m) => [String(m.id), m]));

    // ---- Attention detection (deterministic, no runtime mutation)
    const attentionItems = [];
    const attentionByRequestId = new Map(); // requestId -> array
    const pushAttention = ({ id, category, priority, summary, metadata, requestId }) => {
      const item = toAttentionItem({ id, category, summary, priority, metadata });
      attentionItems.push(item);
      if (!requestId) return;
      const sid = String(requestId);
      const arr = attentionByRequestId.get(sid) ?? [];
      arr.push(item);
      attentionByRequestId.set(sid, arr);
    };

    const nowMs = new Date(String(effectiveNowISO)).getTime();

    const qualifiedNotConvertedCount = requests.filter((r) => {
      const s = String(r.status);
      return s === "qualified" && !Boolean(r.assignedTeamMemberId ?? r.assignedWorkId);
    }).length;

    for (const r of requests) {
      const rid = String(r.id);
      const status = String(r.status);
      const dueAt = toISO(r.dueAt);
      const receivedAt = toISO(r.receivedAt);
      const age = receivedAt ? new Date(receivedAt).getTime() : NaN;

      const isOverdue = dueAt ? new Date(String(dueAt)).getTime() < nowMs : false;
      const waitingTooLong = Number.isFinite(age) ? (nowMs - age) / (60 * 60 * 1000) >= waitingTooLongHours : false;

      if (status === "received") {
        pushAttention({
          id: `att_new_unreviewed_${rid}`,
          category: "new_unreviewed_requests",
          priority: "immediate",
          summary: `${r.title} is new and unreviewed.`,
          metadata: deepFreeze({ requestId: rid }),
          requestId: rid,
        });
      }

      if (String(r.priority) === "high") {
        pushAttention({
          id: `att_high_priority_${rid}`,
          category: "high_priority_requests",
          priority: "immediate",
          summary: `${r.title} has high priority.`,
          metadata: deepFreeze({ requestId: rid }),
          requestId: rid,
        });
      }

      // Overdue only applies to non-final statuses.
      if (isOverdue && !["closed", "cancelled", "rejected"].includes(status)) {
        pushAttention({
          id: `att_overdue_${rid}`,
          category: "overdue_requests",
          priority: "immediate",
          summary: `${r.title} is overdue.`,
          metadata: deepFreeze({ requestId: rid, dueAt: String(dueAt) }),
          requestId: rid,
        });
      }

      if (status === "qualified") {
        const hasAssignment = Boolean(r.assignedTeamMemberId ?? r.assignedWorkId);
        if (!hasAssignment) {
          pushAttention({
            id: `att_qualified_not_converted_${rid}`,
            category: "qualified_not_converted",
            priority: "soon",
            summary: `${r.title} is qualified but not ready to convert.`,
            metadata: deepFreeze({ requestId: rid }),
            requestId: rid,
          });
        }
      }

      if (["received", "reviewing", "qualified"].includes(status) && !Boolean(r.assignedTeamMemberId ?? r.assignedWorkId)) {
        pushAttention({
          id: `att_missing_assignment_${rid}`,
          category: "missing_assignment",
          priority: "immediate",
          summary: `${r.title} is missing assignment.`,
          metadata: deepFreeze({ requestId: rid }),
          requestId: rid,
        });
      }

      // Related work failure/blocked: deterministic link by assignedWorkId.
      const assignedWorkId = r.assignedWorkId ? String(r.assignedWorkId) : null;
      if (assignedWorkId) {
        const w = workById.get(assignedWorkId);
        const wStatus = w ? String(w.status) : null;
        if (wStatus === "blocked" || wStatus === "failed") {
          pushAttention({
            id: `att_failed_blocked_related_work_${rid}`,
            category: "failed_blocked_related_work",
            priority: "immediate",
            summary: `${r.title} has related work that is ${wStatus}.`,
            metadata: deepFreeze({ requestId: rid, workItemId: assignedWorkId }),
            requestId: rid,
          });
        }
      }

      if (!isFinalStatus(status) && waitingTooLong) {
        pushAttention({
          id: `att_waiting_too_long_${rid}`,
          category: "requests_waiting_too_long",
          priority: "soon",
          summary: `${r.title} has been waiting too long.`,
          metadata: deepFreeze({ requestId: rid }),
          requestId: rid,
        });
      }
    }

    if (qualifiedNotConvertedCount >= conversionBacklogThreshold) {
      // One deterministic global attention item for backlog.
      attentionItems.push(
        toAttentionItem({
          id: "att_conversion_backlog",
          category: "conversion_backlog",
          priority: "soon",
          summary: `Conversion backlog: ${qualifiedNotConvertedCount} qualified request(s) waiting.`,
          metadata: deepFreeze({ qualifiedNotConvertedCount }),
        }),
      );
    }

    const attentionCountsByRequestId = new Map();
    for (const it of attentionItems) {
      const requestId = it?.metadata?.requestId ? String(it.metadata.requestId) : null;
      if (!requestId) continue;
      attentionCountsByRequestId.set(requestId, (attentionCountsByRequestId.get(requestId) ?? 0) + 1);
    }

    // ---- Recommended actions derived from attention categories.
    const actionById = new Map();
    const addAction = (action) => {
      if (!action?.id) return;
      const key = String(action.id);
      if (!actionById.has(key)) actionById.set(key, action);
    };

    const addRecommendedActionsForRequest = (request, attentionCategory) => {
      const rid = String(request.id);
      const target = rid;

      switch (attentionCategory) {
        case "new_unreviewed_requests":
        case "high_priority_requests":
          addAction(
            createRequestActionView({
              id: `act_review_request_${rid}`,
              label: actionLabelForType(ACTION_TYPES.review_request),
              type: ACTION_TYPES.review_request,
              target,
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ requestId: rid, category: attentionCategory }),
            }),
          );
          break;
        case "overdue_requests":
        case "requests_waiting_too_long":
          addAction(
            createRequestActionView({
              id: `act_follow_up_${rid}`,
              label: actionLabelForType(ACTION_TYPES.follow_up),
              type: ACTION_TYPES.follow_up,
              target,
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ requestId: rid, category: attentionCategory }),
            }),
          );
          break;
        case "qualified_not_converted":
        case "conversion_backlog":
          addAction(
            createRequestActionView({
              id: `act_convert_to_work_${rid}`,
              label: actionLabelForType(ACTION_TYPES.convert_to_work),
              type: ACTION_TYPES.convert_to_work,
              target,
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ requestId: rid, category: attentionCategory }),
            }),
          );
          break;
        case "missing_assignment":
          addAction(
            createRequestActionView({
              id: `act_assign_request_${rid}`,
              label: actionLabelForType(ACTION_TYPES.assign_request),
              type: ACTION_TYPES.assign_request,
              target,
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ requestId: rid, category: attentionCategory }),
            }),
          );
          break;
        case "failed_blocked_related_work":
          addAction(
            createRequestActionView({
              id: `act_view_related_work_${rid}`,
              label: actionLabelForType(ACTION_TYPES.view_related_work),
              type: ACTION_TYPES.view_related_work,
              target,
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ requestId: rid, category: attentionCategory }),
            }),
          );
          break;
        default:
          break;
      }
    };

    // Create actions per attention item that is request-linked.
    for (const it of attentionItems) {
      const requestId = it?.metadata?.requestId ? String(it.metadata.requestId) : null;
      if (!requestId) continue;
      const request = requests.find((x) => String(x.id) === requestId);
      if (!request) continue;
      addRecommendedActionsForRequest(request, String(it.category));
    }

    const recommendedActions = Array.from(actionById.values()).sort((a, b) =>
      String(a.priority).localeCompare(String(b.priority)) || String(a.id).localeCompare(String(b.id)),
    );

    // ---- Queue views
    const queueDefs = DEFAULT_REQUEST_QUEUES;

    const itemsByQueueType = new Map();
    for (const q of queueDefs) itemsByQueueType.set(q.type, []);

    for (const r of requests) {
      const qType = computeQueueTypeByRequest(r);
      const arr = itemsByQueueType.get(qType);
      if (arr) arr.push(r);
    }

    // Fill queue view objects with request item ids + queue actions deterministically.
    const queueActionsByQueueType = {
      new_requests: ACTION_TYPES.review_request,
      needs_review: ACTION_TYPES.qualify_request,
      qualified: ACTION_TYPES.convert_to_work,
      ready_to_convert: ACTION_TYPES.convert_to_work,
      converted: ACTION_TYPES.close_request,
      closed: null,
    };

    const nowMsForOverdue = nowMs;

    const finalQueueViews = queueDefs.map((q) => {
      const list = stableSortByReceivedAtDescThenId(itemsByQueueType.get(q.type) ?? []);
      const itemIds = list.map((r) => String(r.id));
      const itemCount = itemIds.length;

      // Deterministic queue status.
      const queueAttention = list.some((r) => (attentionCountsByRequestId.get(String(r.id)) ?? 0) > 0);
      const status = itemCount === 0 ? "open" : queueAttention ? "needs_attention" : "open";

      const actionType = queueActionsByQueueType[q.type];
      const actions = actionType
        ? [
            createRequestActionView({
              id: `act_queue_${q.type}_${q.id}`,
              label: actionLabelForType(actionType),
              type: actionType,
              target: q.id,
              priority: q.priority,
              disabled: false,
              metadata: deepFreeze({ queueId: q.id }),
            }),
          ]
        : [];

      const summary = itemCount === 0 ? `No requests awaiting attention.` : `${itemCount} request(s) requiring attention checks.`;

      return createRequestQueueView({
        id: q.id,
        name: q.name,
        summary,
        type: q.type,
        priority: q.priority,
        itemCount,
        items: itemIds,
        status,
        actions,
        metadata: deepFreeze({ derivedFrom: { requestQueueType: q.type }, version: REQUEST_VIEW_VERSION }),
      });
    });

    // ---- Item views
    const itemViews = requests.map((r) => {
      const rid = String(r.id);
      const age = daysHoursAge(String(r.receivedAt), String(effectiveNowISO));
      // View-level deterministic enrichment: Requests may not carry assignment fields
      // once connectedness hardening removes request-history re-conversion.
      const derivedWorkId = `work_${rid}`;
      const derivedWorkItem = workById.get(derivedWorkId) ?? null;
      const effectiveAssignedWorkId = r.assignedWorkId
        ? String(r.assignedWorkId)
        : derivedWorkItem
          ? String(derivedWorkId)
          : null;
      const effectiveAssignedTeamMemberId = r.assignedTeamMemberId
        ? String(r.assignedTeamMemberId)
        : derivedWorkItem && String(derivedWorkItem.assignedTo) !== "unassigned"
          ? String(derivedWorkItem.assignedTo)
          : null;

      const dueAt = r.dueAt === undefined ? null : r.dueAt;
      const dueAtISO = dueAt === null ? null : toISO(String(dueAt));
      const dueAtDisplay = dueAtISO ? dueAtISO : null;

      const hasAttention = (attentionCountsByRequestId.get(rid) ?? 0) > 0;

      const badges = [];
      if (String(r.status) === "received") badges.push("New");
      if (String(r.status) === "reviewing") badges.push("Reviewing");
      if (String(r.status) === "qualified") badges.push("Qualified");
      if (String(r.status) === "converted") badges.push("Converted");
      if (String(r.status) === "closed") badges.push("Closed");
      if (String(r.priority) === "high") badges.push("High Priority");
      if (dueAtDisplay && isFinalStatus(r.status) === false && new Date(String(dueAtDisplay)).getTime() < nowMsForOverdue) badges.push("Overdue");
      if (!Boolean(effectiveAssignedTeamMemberId ?? effectiveAssignedWorkId) && ["received", "reviewing", "qualified"].includes(String(r.status)))
        badges.push("Missing assignment");

      const assignedWorkId = effectiveAssignedWorkId;
      const w = assignedWorkId ? workById.get(assignedWorkId) : null;
      const wStatus = w ? String(w.status) : null;
      if (wStatus === "blocked") badges.push("Related work blocked");
      if (wStatus === "failed") badges.push("Related work failed");

      // Next action.
      let nextAction = null;
      if (wStatus === "blocked" || wStatus === "failed") {
        nextAction = ACTION_TYPES.view_related_work;
      } else if (dueAtDisplay && new Date(String(dueAtDisplay)).getTime() < nowMsForOverdue && !isFinalStatus(r.status)) {
        nextAction = ACTION_TYPES.follow_up;
      } else if (String(r.status) === "qualified" && !Boolean(effectiveAssignedTeamMemberId ?? effectiveAssignedWorkId)) {
        // Qualified-but-not-ready should lead to conversion.
        nextAction = ACTION_TYPES.convert_to_work;
      } else if (!Boolean(effectiveAssignedTeamMemberId ?? effectiveAssignedWorkId) && ["received", "reviewing", "qualified"].includes(String(r.status))) {
        nextAction = ACTION_TYPES.assign_request;
      } else if (String(r.status) === "received") {
        nextAction = ACTION_TYPES.review_request;
      } else if (String(r.status) === "reviewing") {
        nextAction = ACTION_TYPES.qualify_request;
      } else if (String(r.status) === "qualified") {
        nextAction = ACTION_TYPES.convert_to_work;
      } else if (String(r.status) === "converted") {
        nextAction = ACTION_TYPES.close_request;
      } else if (isFinalStatus(r.status)) {
        nextAction = ACTION_TYPES.close_request;
      }

      const actions = nextAction
        ? [
            createRequestActionView({
              id: `act_item_${rid}_${String(nextAction)}`,
              label: actionLabelForType(nextAction),
              type: nextAction,
              target: rid,
              priority: nextAction === ACTION_TYPES.review_request ? "immediate" : nextAction === ACTION_TYPES.follow_up ? "soon" : qForPriority(nextAction),
              disabled: false,
              metadata: deepFreeze({ requestId: rid }),
            }),
          ]
        : [];

      // Helper for deterministic action priority mapping.
      function qForPriority(actionType) {
        if (actionType === ACTION_TYPES.assign_request) return "immediate";
        if (actionType === ACTION_TYPES.convert_to_work) return "soon";
        if (actionType === ACTION_TYPES.view_related_work) return "immediate";
        if (actionType === ACTION_TYPES.follow_up) return "soon";
        return "later";
      }

      return createRequestItemView({
        id: rid,
        title: String(r.title),
        description: String(r.description),
        requestType: String(r.requestType),
        status: String(r.status),
        priority: String(r.priority),
        channel: String(r.channel),
        source: String(r.source),
        requester: String(r.requester),
        receivedAt: String(r.receivedAt),
        age,
        dueAt: dueAtDisplay,
        qualificationStatus: r.qualificationStatus === undefined ? null : r.qualificationStatus,
        assignedWorkId: effectiveAssignedWorkId === undefined ? null : effectiveAssignedWorkId,
        assignedTeamMemberId: effectiveAssignedTeamMemberId === undefined ? null : effectiveAssignedTeamMemberId,
        attentionRequired: hasAttention,
        nextAction,
        badges,
        actions,
        metadata: deepFreeze({ derivedFrom: { requestId: rid }, version: REQUEST_VIEW_VERSION }),
      });
    });

    const attentionView = createRequestAttentionView({
      summary:
        attentionItems.length > 0
          ? `${attentionItems.length} request attention item(s) detected.`
          : "No requests require immediate attention.",
      items: attentionItems,
      metadata: deepFreeze({ derivedFrom: { requestRuntime: true }, version: REQUEST_VIEW_VERSION }),
    });

    const summary = (() => {
      const newCount = attentionItems.filter((x) => x.category === "new_unreviewed_requests").length;
      const overdueCount = attentionItems.filter((x) => x.category === "overdue_requests").length;
      const missingAssignCount = attentionItems.filter((x) => x.category === "missing_assignment").length;
      const parts = [];
      if (newCount) parts.push(`${newCount} new unreviewed request(s)`);
      if (overdueCount) parts.push(`${overdueCount} overdue request(s)`);
      if (missingAssignCount) parts.push(`${missingAssignCount} missing assignment(s)`);
      if (parts.length === 0) return "Request intake looks stable. Nothing needs immediate attention.";
      return `Requests need attention: ${parts.join(", ")}.`;
    })();

    const vm = createRequestViewModel({
      viewId: `request_view_${companyId}_${String(effectiveNowISO)}`,
      companyId,
      generatedAt: String(effectiveNowISO),
      summary,
      queues: finalQueueViews,
      items: itemViews,
      attention: attentionView,
      recommendedActions,
      metrics: deepFreeze({
        ...computeOperationalRequestMetrics(allRequests, effectiveNowISO),
        attentionCount: attentionItems.length,
      }),
      metadata: deepFreeze({ derivedFrom: { requestRuntime: true, workRuntime: true, teamRuntime: true, companyRuntime: true }, version: REQUEST_VIEW_VERSION }),
    });

    validateRequestViewModel(vm);
    return vm;
  }
}
