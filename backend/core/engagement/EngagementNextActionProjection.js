import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { NEXT_ACTION_TYPES, FOLLOW_UP_STATUSES } from "./EngagementDefaults.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function createNextAction({
  id,
  actionType,
  title,
  description,
  priority,
  dueAt,
  ownerId,
  sourceType,
  sourceId,
  relatedObjects,
  requiresApproval,
  status,
}) {
  return deepFreeze({
    id: String(id),
    actionType: String(actionType),
    title: String(title),
    description: String(description),
    priority: String(priority),
    dueAt: dueAt === undefined || dueAt === null ? null : String(dueAt),
    ownerId: ownerId === undefined || ownerId === null ? null : String(ownerId),
    sourceType: String(sourceType),
    sourceId: String(sourceId),
    relatedObjects: deepFreeze(Array.isArray(relatedObjects) ? relatedObjects : []),
    requiresApproval: Boolean(requiresApproval),
    status: String(status ?? "open"),
  });
}

export function buildEngagementNextActions({
  partyId,
  followUps,
  workItems,
  approvals,
  messages,
  automationRuns,
} = {}) {
  const pid = String(partyId);
  const actions = [];

  for (const fu of safeArray(followUps)) {
    actions.push(
      createNextAction({
        id: `next_follow_up_${fu.interactionId}`,
        actionType: NEXT_ACTION_TYPES.COMPLETE_FOLLOW_UP,
        title: fu.status === FOLLOW_UP_STATUSES.OVERDUE ? "Complete overdue follow-up" : "Complete scheduled follow-up",
        description: fu.nextStep ? `Next step: ${fu.nextStep}` : "Follow-up commitment recorded.",
        priority: fu.status === FOLLOW_UP_STATUSES.OVERDUE ? "immediate" : "soon",
        dueAt: fu.dueAt,
        ownerId: fu.ownerId,
        sourceType: "interaction",
        sourceId: fu.interactionId,
        relatedObjects: [{ partyId: pid }, { interactionId: fu.interactionId }],
        requiresApproval: fu.approvalPending,
        status: "open",
      }),
    );
  }

  for (const work of safeArray(workItems)) {
    if (["completed", "cancelled", "closed"].includes(String(work.status))) continue;
    actions.push(
      createNextAction({
        id: `next_work_${work.id}`,
        actionType: NEXT_ACTION_TYPES.REVIEW_WORK,
        title: `Review work: ${work.title ?? work.id}`,
        description: String(work.description ?? ""),
        priority: String(work.priority) === "high" ? "immediate" : "soon",
        dueAt: work.dueAt ?? null,
        ownerId: work.assignedTo ?? null,
        sourceType: "work",
        sourceId: work.id,
        relatedObjects: [{ partyId: pid }, { workItemId: work.id }],
        requiresApproval: false,
        status: work.status,
      }),
    );
  }

  for (const approval of safeArray(approvals)) {
    if (String(approval.status) !== "PENDING") continue;
    actions.push(
      createNextAction({
        id: `next_approval_${approval.id}`,
        actionType: NEXT_ACTION_TYPES.GRANT_APPROVAL,
        title: "Review pending approval",
        description: `${approval.requestType} requires ${approval.requiredApprover}`,
        priority: "immediate",
        dueAt: null,
        ownerId: approval.requiredApprover,
        sourceType: "approval",
        sourceId: approval.id,
        relatedObjects: [{ partyId: pid }, { approvalId: approval.id }],
        requiresApproval: true,
        status: "pending",
      }),
    );
  }

  for (const msg of safeArray(messages)) {
    if (String(msg.status) !== "failed") continue;
    actions.push(
      createNextAction({
        id: `next_retry_comm_${msg.id}`,
        actionType: NEXT_ACTION_TYPES.RETRY_COMMUNICATION,
        title: "Retry failed communication",
        description: String(msg.subject ?? msg.id),
        priority: "soon",
        dueAt: null,
        ownerId: msg.sender?.id ?? null,
        sourceType: "communication_message",
        sourceId: msg.id,
        relatedObjects: [{ partyId: pid }, { communicationMessageId: msg.id }],
        requiresApproval: false,
        status: "open",
      }),
    );
  }

  for (const run of safeArray(automationRuns)) {
    if (String(run.status) !== "FAILED") continue;
    actions.push(
      createNextAction({
        id: `next_automation_failure_${run.id}`,
        actionType: NEXT_ACTION_TYPES.RESOLVE_AUTOMATION_FAILURE,
        title: "Resolve automation failure",
        description: String(run.error ?? "Automation run failed."),
        priority: "soon",
        dueAt: null,
        ownerId: null,
        sourceType: "automation_run",
        sourceId: run.id,
        relatedObjects: [{ partyId: pid }, { automationRunId: run.id }],
        requiresApproval: false,
        status: "failed",
      }),
    );
  }

  const priorityOrder = { immediate: 0, soon: 1, later: 2 };
  actions.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    const da = a.dueAt ?? "9999";
    const db = b.dueAt ?? "9999";
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });

  return deepFreeze(actions);
}
