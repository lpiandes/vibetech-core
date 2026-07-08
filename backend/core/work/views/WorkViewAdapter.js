import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { WORK_VIEW_VERSION, ACTION_TYPES, ACTION_PRIORITIES } from "./WorkViewDefaults.js";

import { createWorkViewModel } from "./WorkViewModel.js";
import { createWorkItemView } from "./WorkItemView.js";
import { createWorkQueueView } from "./WorkQueueView.js";
import { createWorkStageView } from "./WorkStageView.js";
import { createWorkAssignmentView } from "./WorkAssignmentView.js";
import { createWorkAttentionView } from "./WorkAttentionView.js";
import { createWorkActionView } from "./WorkActionView.js";
import { validateWorkViewModel } from "./WorkViewValidator.js";
import { formatBusinessDateWithOverdue } from "../../presentation/formatBusinessDate.js";
import {
  resolveBusinessWorkLinks,
  resolveWorkPartyId,
} from "./resolveWorkRowLinks.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function toISO(iso) {
  if (typeof iso !== "string" || !iso) return null;
  return iso;
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

function priorityForAttention(priority) {
  const p = String(priority ?? "later");
  return ACTION_PRIORITIES.includes(p) ? p : "later";
}

function categoryPriority(category) {
  // Deterministic mapping.
  switch (category) {
    case "blocked_work":
    case "failed_work":
    case "overdue_work":
    case "review_required_work":
    case "unassigned_work":
    case "missing_assignees":
      return "immediate";
    case "work_waiting_too_long":
      return "soon";
    case "queues_growing_too_large":
    default:
      return "later";
  }
}

function computeQueueStatus({ items }) {
  // Deterministic: blocked > review_required > review_required_wait > waiting too long > open/completed.
  if (items.length === 0) return "open";
  const statuses = items.map((w) => String(w.status));
  if (statuses.every((s) => ["completed", "cancelled", "failed", "rejected"].includes(s))) return "completed";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("review_required")) return "review_required";
  if (statuses.includes("waiting")) return "needs_attention";
  if (statuses.includes("in_progress")) return "open";
  return "open";
}

function computeStageStatus({ items }) {
  const statuses = items.map((w) => String(w.status));
  if (statuses.length === 0) return "open";
  if (statuses.every((s) => ["completed", "cancelled", "failed", "rejected"].includes(s))) return "completed";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("review_required")) return "review_required";
  if (statuses.includes("failed")) return "failed";
  return "active";
}

function safeGetAssignee(teamRuntime, assigneeId) {
  const id = String(assigneeId ?? "");
  if (!id || id === "unassigned" || id === "tm_system") return { name: null, type: null };
  const members = safeArray(teamRuntime?.getMembers?.());
  const m = members.find((x) => String(x.id) === id);
  if (!m || m.metadata?.seeded) return { name: null, type: null };
  return { name: String(m.name), type: String(m.memberType) };
}

function workTypeLabel(presentation, workType) {
  const key = String(workType ?? "");
  return (
    presentation?.workTypeLabels?.[key] ??
    presentation?.requestTypeLabels?.[key] ??
    key.replace(/_/g, " ")
  );
}

function workStatusLabel(presentation, status) {
  const key = String(status ?? "");
  return presentation?.workStatusLabels?.[key] ?? key.replace(/_/g, " ");
}

function resolveWorkDisplay({
  w,
  teamRuntime,
  businessGraphRuntime,
  businessSubjectRuntime,
  requestRuntime,
  presentation,
  nowISO,
  businessId,
}) {
  let requestId = w.requestId ? String(w.requestId) : null;
  if (!requestId) {
    for (const ref of safeArray(w.relatedObjects)) {
      if (String(ref?.entityType) === "Request") {
        requestId = String(ref.entityId);
        break;
      }
    }
  }

  const request = requestId ? requestRuntime?.getRequest?.(requestId) : null;
  const partyId = resolveWorkPartyId({ workItem: w, requestRuntime, businessGraphRuntime });

  let subjectId = request?.subjectRefs?.[0]?.entityId ?? null;
  if (!subjectId) {
    for (const ref of safeArray(w.relatedObjects)) {
      if (String(ref?.entityType) === "Subject") {
        subjectId = ref.entityId;
        break;
      }
    }
  }
  const partyName = partyId ? businessGraphRuntime?.getParty?.(String(partyId))?.displayName ?? null : null;
  const subjectName = subjectId ? businessSubjectRuntime?.getSubject?.(String(subjectId))?.displayName ?? null : null;
  const assignee = safeGetAssignee(teamRuntime, w.assignedTo);
  const dueMeta = w.dueAt ? formatBusinessDateWithOverdue(w.dueAt, { nowISO }) : { label: null, overdue: false };

  let nextStep = "In progress";
  if (w.status === "blocked") nextStep = "Blocked — needs resolution";
  else if (w.status === "waiting" || w.status === "pending") nextStep = "Waiting for confirmation";
  else if (String(w.workType) === "showing_coordination") nextStep = "Confirm tour time";

  const links = resolveBusinessWorkLinks({
    partyId,
    subjectId,
    businessId,
    businessGraphRuntime,
    workItem: w,
    requestRuntime,
  });

  return deepFreeze({
    partyId: links.partyId,
    partyName,
    subjectId: subjectId ? String(subjectId) : null,
    subjectName,
    assigneeName: assignee.name,
    workTypeLabel: workTypeLabel(presentation, w.workType),
    statusLabel: workStatusLabel(presentation, w.status),
    dueLabel: dueMeta.label,
    overdue: Boolean(dueMeta.overdue),
    nextStep,
    personHref: links.personHref,
    propertyHref: links.propertyHref,
    rowHref: links.rowHref,
    engagementHref: null,
  });
}

export class WorkViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  translate({
    workRuntime,
    teamRuntime,
    companyRuntime,
    companyBrief,
    companyHealth,
    missionControl,
    teamViewModel,
    businessGraphRuntime,
    businessSubjectRuntime,
    requestRuntime,
    presentation,
    nowISO,
    businessId,
  } = {}) {
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";
    if (!workRuntime) throw new Error("WorkViewAdapter.translate requires workRuntime.");
    if (!teamRuntime) throw new Error("WorkViewAdapter.translate requires teamRuntime.");
    if (!companyRuntime) throw new Error("WorkViewAdapter.translate requires companyRuntime.");

    const companyId = String(companyRuntime.getCompany?.().companyName ?? "company");

    const workItems = safeArray(workRuntime.getWorkItems?.());
    const stages = safeArray(workRuntime.getStages?.());
    const queues = safeArray(workRuntime.getQueues?.());
    const assignments = safeArray(workRuntime.getAssignments?.());

    // Build stage views and enrich per stage.
    const stageById = new Map(stages.map((s) => [String(s.id), s]));
    const queueById = new Map(queues.map((q) => [String(q.id), q]));

    const itemsByStageId = new Map();
    const itemsByQueueId = new Map();
    for (const w of workItems) {
      const sid = String(w.stageId);
      const qid = String(w.queueId);
      if (!itemsByStageId.has(sid)) itemsByStageId.set(sid, []);
      if (!itemsByQueueId.has(qid)) itemsByQueueId.set(qid, []);
      itemsByStageId.get(sid).push(w);
      itemsByQueueId.get(qid).push(w);
    }

    const stagesView = stages.map((s) => {
      const sid = String(s.id);
      const stageItems = safeArray(itemsByStageId.get(sid));
      const itemCount = stageItems.length;
      const stageStatus = computeStageStatus({ items: stageItems });

      const items = stageItems.map((w) => String(w.id));
      return createWorkStageView({
        id: sid,
        name: String(s.name),
        summary: String(s.description ?? ""),
        status: stageStatus,
        sortOrder: Number(s.sortOrder ?? 0),
        itemCount,
        items,
        metadata: deepFreeze({ derivedFrom: { workStageId: sid }, version: WORK_VIEW_VERSION }),
      });
    });

    // Queue view creation.
    const queuesView = queues.map((q) => {
      const qid = String(q.id);
      const qItems = safeArray(itemsByQueueId.get(qid));
      const itemCount = qItems.length;
      const queueStatus = computeQueueStatus({ items: qItems });
      const items = qItems.map((w) => String(w.id));

      // Deterministic summary copy.
      const summary = `${itemCount} item(s) awaiting attention`;

      // Actions for queue: basic view_queue.
      const actions = [
        createWorkActionView({
          id: `act_view_queue_${qid}`,
          label: `View Queue`,
          type: ACTION_TYPES.view_queue,
          target: qid,
          priority: "later",
          disabled: false,
          metadata: deepFreeze({ queueId: qid }),
        }),
      ];

      return createWorkQueueView({
        id: qid,
        name: String(q.name),
        summary,
        type: String(q.type),
        priority: String(q.priority),
        itemCount,
        items,
        status: queueStatus,
        actions,
        metadata: deepFreeze({ derivedFrom: { queueId: qid }, version: WORK_VIEW_VERSION }),
      });
    });

    // Assignment views.
    const teamMembersById = new Map(safeArray(teamRuntime.getMembers?.()).map((m) => [String(m.id), m]));
    const assignmentViews = assignments.map((a) => {
      const aid = String(a.id);
      const wiid = String(a.workItemId);
      const assigneeId = String(a.assigneeId);
      const m = teamMembersById.get(assigneeId);
      return createWorkAssignmentView({
        id: aid,
        workItemId: wiid,
        assigneeId,
        assigneeName: m ? String(m.name) : "Unknown",
        assigneeType: String(a.assigneeType),
        assignedAt: String(a.assignedAt),
        status: String(a.status),
        metadata: deepFreeze({ derivedFrom: { assignmentId: aid } }),
      });
    });

    // Attention detection.
    const nowMs = new Date(effectiveNowISO).getTime();
    // (work item details are read directly from `workItems` below)

    const attentionItems = [];
    const pushAttention = ({ id, category, summary, priority, metadata } = {}) => {
      attentionItems.push(
        deepFreeze({
          id: String(id),
          category,
          summary: String(summary),
          priority: priorityForAttention(priority ?? categoryPriority(category)),
          metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
        }),
      );
    };

    const queueGrowthThreshold = 4;
    const workWaitingTooLongHours = 48;

    // blocked_work, failed_work, review_required_work, overdue_work, unassigned_work, work_waiting_too_long
    for (const w of workItems) {
      const wid = String(w.id);
      const status = String(w.status);
      const dueAt = w.dueAt;
      const createdAt = String(w.createdAt ?? "");

      if (status === "blocked") {
        pushAttention({
          id: `att_blocked_${wid}`,
          category: "blocked_work",
          summary: `${String(w.title)} is blocked.`,
          priority: "immediate",
          metadata: deepFreeze({ workItemId: wid }),
        });
      }

      if (status === "failed") {
        pushAttention({
          id: `att_failed_${wid}`,
          category: "failed_work",
          summary: `${String(w.title)} failed execution.`,
          priority: "immediate",
          metadata: deepFreeze({ workItemId: wid }),
        });
      }

      if (status === "review_required") {
        pushAttention({
          id: `att_review_required_${wid}`,
          category: "review_required_work",
          summary: `${String(w.title)} needs review.`,
          priority: "immediate",
          metadata: deepFreeze({ workItemId: wid }),
        });
      }

      if (dueAt && typeof dueAt === "string" && ["new", "ready", "in_progress", "waiting", "blocked", "review_required"].includes(status)) {
        const dueMs = new Date(dueAt).getTime();
        if (Number.isFinite(dueMs) && dueMs < nowMs) {
          pushAttention({
            id: `att_overdue_${wid}`,
            category: "overdue_work",
            summary: `${String(w.title)} is overdue.`,
            priority: "immediate",
            metadata: deepFreeze({ workItemId: wid, dueAt }),
          });
        }
      }

      if (status !== "completed" && String(w.assignedTo ?? "") === "unassigned") {
        pushAttention({
          id: `att_unassigned_${wid}`,
          category: "unassigned_work",
          summary: `${String(w.title)} is unassigned.`,
          priority: "immediate",
          metadata: deepFreeze({ workItemId: wid }),
        });
      }

      // work waiting too long (based on createdAt age)
      const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
      if (Number.isFinite(createdMs) && ["new", "ready", "waiting", "review_required"].includes(status)) {
        const hours = (nowMs - createdMs) / (60 * 60 * 1000);
        if (hours >= workWaitingTooLongHours) {
          pushAttention({
            id: `att_waiting_too_long_${wid}`,
            category: "work_waiting_too_long",
            summary: `${String(w.title)} has been waiting too long.`,
            priority: "soon",
            metadata: deepFreeze({ workItemId: wid, ageHours: Math.floor(hours) }),
          });
        }
      }

      // missing assignees: assignedTo not unassigned and not present in team members
      if (status !== "completed" && String(w.assignedTo ?? "") !== "unassigned") {
        const assigneeId = String(w.assignedTo);
        if (!teamMembersById.has(assigneeId)) {
          pushAttention({
            id: `att_missing_assignee_${wid}`,
            category: "missing_assignees",
            summary: `${String(w.title)} has a missing assignee.`,
            priority: "immediate",
            metadata: deepFreeze({ workItemId: wid, assigneeId }),
          });
        }
      }
    }

    // queues growing too large.
    for (const qv of queuesView) {
      if (qv.itemCount >= queueGrowthThreshold && !["completed"].includes(String(qv.status))) {
        pushAttention({
          id: `att_queue_growth_${qv.id}`,
          category: "queues_growing_too_large",
          summary: `${String(qv.name)} has ${qv.itemCount} item(s).`,
          priority: "later",
          metadata: deepFreeze({ queueId: qv.id, itemCount: qv.itemCount }),
        });
      }
    }

    const attentionView = createWorkAttentionView({
      summary: attentionItems.length ? `${attentionItems.length} work attention item(s) detected.` : "No work requires immediate attention.",
      items: attentionItems,
      metadata: deepFreeze({ derivedFrom: { version: WORK_VIEW_VERSION } }),
    });

    // Recommended actions derived from attention items.
    const actionDedup = new Map();
    const setAction = (action) => {
      actionDedup.set(String(action.id), action);
    };

    for (const it of attentionItems) {
      const category = String(it.category);
      const workItemId = it?.metadata?.workItemId ? String(it.metadata.workItemId) : null;

      if (category === "blocked_work") {
        const id = `act_unblock_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Unblock Work",
              type: ACTION_TYPES.unblock_work,
              target: workItemId ?? "work",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }

      if (category === "failed_work") {
        const id = `act_review_failed_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Review Work",
              type: ACTION_TYPES.review_work,
              target: workItemId ?? "work",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }

      if (category === "overdue_work") {
        const id = `act_follow_up_overdue_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Follow Up",
              type: ACTION_TYPES.follow_up,
              target: workItemId ?? "work",
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }

      if (category === "review_required_work") {
        const id = `act_review_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Review Work",
              type: ACTION_TYPES.review_work,
              target: workItemId ?? "work",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }

      if (category === "unassigned_work") {
        const id = `act_assign_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Assign Work",
              type: ACTION_TYPES.assign_work,
              target: workItemId ?? "work",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }

      if (category === "missing_assignees") {
        const id = `act_assign_missing_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Assign Work",
              type: ACTION_TYPES.assign_work,
              target: workItemId ?? "work",
              priority: "immediate",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }

      if (category === "work_waiting_too_long") {
        const id = `act_follow_up_waiting_${workItemId}`;
        if (!actionDedup.has(id)) {
          setAction(
            createWorkActionView({
              id,
              label: "Follow Up",
              type: ACTION_TYPES.follow_up,
              target: workItemId ?? "work",
              priority: "soon",
              disabled: false,
              metadata: deepFreeze({ workItemId }),
            }),
          );
        }
      }
    }

    const recommendedActionList = Array.from(actionDedup.values()).sort((a, b) => String(a.priority).localeCompare(String(b.priority)) || String(a.id).localeCompare(String(b.id)));

    // Items view.
    const workItemViews = workItems.map((w) => {
      const wid = String(w.id);
      const stage = stageById.get(String(w.stageId)) ?? { id: String(w.stageId), name: "" };
      const queue = queueById.get(String(w.queueId)) ?? { id: String(w.queueId), name: "" };

      const assignedTo = String(w.assignedTo ?? "unassigned");
      const attentionRequired = attentionItems.some((it) => it?.metadata?.workItemId === wid);

      const badges = [];
      if (w.status === "blocked") badges.push("Blocked");
      if (w.status === "failed") badges.push("Failed");
      if (w.status === "review_required") badges.push("Review required");
      if (w.status === "overdue") badges.push("Overdue");
      if (assignedTo === "unassigned") badges.push("Unassigned");

      const nextAction = (() => {
        if (String(w.status) === "blocked") return ACTION_TYPES.unblock_work;
        if (String(w.status) === "failed") return ACTION_TYPES.review_work;
        if (String(w.status) === "review_required") return ACTION_TYPES.review_work;
        if (String(w.status) !== "completed" && assignedTo === "unassigned") return ACTION_TYPES.assign_work;
        if (w.dueAt && typeof w.dueAt === "string") {
          const dueMs = new Date(String(w.dueAt)).getTime();
          if (Number.isFinite(dueMs) && dueMs < nowMs) return ACTION_TYPES.follow_up;
        }
        return null;
      })();

      const member = safeGetAssignee(teamRuntime, assignedTo);
      const owner = String(w.requestedBy ?? "");
      const display = resolveWorkDisplay({
        w,
        teamRuntime,
        businessGraphRuntime,
        businessSubjectRuntime,
        requestRuntime,
        presentation: presentation ?? {},
        nowISO: effectiveNowISO,
        businessId,
      });

      const itemActions = [];
      if (nextAction) {
        itemActions.push(
          createWorkActionView({
            id: `act_item_${wid}_${String(nextAction)}`,
            label:
              nextAction === ACTION_TYPES.unblock_work
                ? "Unblock Work"
                : nextAction === ACTION_TYPES.review_work
                  ? "Review Work"
                  : nextAction === ACTION_TYPES.assign_work
                    ? "Assign Work"
                    : nextAction === ACTION_TYPES.follow_up
                      ? "Follow Up"
                      : "Open",
            type: String(nextAction),
            target: wid,
            priority: "immediate",
            disabled: false,
            metadata: deepFreeze({ workItemId: wid }),
          }),
        );
      }

      return createWorkItemView({
        id: wid,
        title: String(w.title),
        description: String(w.description),
        workType: String(w.workType),
        status: String(w.status),
        priority: String(w.priority),
        stage: { id: String(stage.id), name: String(stage.name ?? "") },
        queue: { id: String(queue.id), name: String(queue.name ?? "") },
        assignedTo,
        owner,
        dueAt: w.dueAt === undefined ? null : w.dueAt,
        age: daysHoursAge(String(w.createdAt), effectiveNowISO),
        blockedReason: w.blockedReason,
        attentionRequired,
        nextAction,
        relatedObjects: Array.isArray(w.relatedObjects) ? w.relatedObjects : [],
        badges,
        actions: itemActions,
        metadata: deepFreeze({
          derivedFrom: { workItemId: wid },
          version: WORK_VIEW_VERSION,
          display,
        }),
      });
    });

    const summary = (() => {
      const blocked = attentionItems.filter((x) => x.category === "blocked_work").length;
      const review = attentionItems.filter((x) => x.category === "review_required_work").length;
      const overdue = attentionItems.filter((x) => x.category === "overdue_work").length;
      const unassigned = attentionItems.filter((x) => x.category === "unassigned_work").length;
      const parts = [];
      if (blocked) parts.push(`${blocked} blocked item(s)`);
      if (review) parts.push(`${review} requiring review`);
      if (overdue) parts.push(`${overdue} overdue`);
      if (unassigned) parts.push(`${unassigned} unassigned`);
      if (parts.length === 0) return "Work is stable. Nothing needs immediate attention.";
      return `Work needs attention: ${parts.join(", ")}.`;
    })();

    const vm = createWorkViewModel({
      viewId: `work_view_${companyId}_${effectiveNowISO}`,
      companyId,
      generatedAt: effectiveNowISO,
      summary,
      queues: queuesView,
      stages: stagesView,
      items: workItemViews,
      assignments: assignmentViews,
      attention: attentionView,
      recommendedActions: recommendedActionList,
      metrics: deepFreeze({ ...workRuntime.getMetrics?.(), attentionCount: attentionItems.length }),
      metadata: deepFreeze({ derivedFrom: { workRuntime: true }, version: WORK_VIEW_VERSION }),
    });

    validateWorkViewModel(vm);
    return vm;
  }
}

