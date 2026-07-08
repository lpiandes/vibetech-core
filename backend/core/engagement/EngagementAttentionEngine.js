import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { ATTENTION_CATEGORIES } from "./EngagementDefaults.js";
import { FOLLOW_UP_STATUSES } from "./EngagementDefaults.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function createAttentionItem({ id, category, summary, priority, relatedObjects, recommendedNextAction, metadata }) {
  return deepFreeze({
    id: String(id),
    category: String(category),
    summary: String(summary),
    priority: String(priority),
    relatedObjects: deepFreeze(Array.isArray(relatedObjects) ? relatedObjects : []),
    recommendedNextAction: recommendedNextAction ?? null,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

export function buildEngagementAttention({
  partyId,
  followUps,
  messages,
  workItems,
  approvals,
  automationRuns,
  interactions,
} = {}) {
  const items = [];
  const pid = String(partyId);

  for (const fu of safeArray(followUps)) {
    if (String(fu.status) !== FOLLOW_UP_STATUSES.OVERDUE) continue;
    items.push(
      createAttentionItem({
        id: `attn_overdue_follow_up_${fu.interactionId}`,
        category: ATTENTION_CATEGORIES.OVERDUE_FOLLOW_UP,
        summary: `Follow-up overdue since ${fu.dueAt}`,
        priority: "immediate",
        relatedObjects: [{ partyId: pid }, { interactionId: fu.interactionId }],
        recommendedNextAction: "complete_follow_up",
        metadata: { dueAt: fu.dueAt, ownerId: fu.ownerId },
      }),
    );
  }

  for (const msg of safeArray(messages)) {
    if (String(msg.status) !== "failed") continue;
    items.push(
      createAttentionItem({
        id: `attn_failed_comm_${msg.id}`,
        category: ATTENTION_CATEGORIES.FAILED_COMMUNICATION,
        summary: `Communication failed: ${msg.subject ?? msg.id}`,
        priority: "soon",
        relatedObjects: [{ partyId: pid }, { communicationMessageId: msg.id }, { communicationThreadId: msg.threadId }],
        recommendedNextAction: "retry_communication",
        metadata: { channel: msg.channel },
      }),
    );
  }

  for (const approval of safeArray(approvals)) {
    if (String(approval.status) !== "PENDING") continue;
    items.push(
      createAttentionItem({
        id: `attn_pending_approval_${approval.id}`,
        category: ATTENTION_CATEGORIES.PENDING_APPROVAL,
        summary: `Approval pending: ${approval.requestType}`,
        priority: "immediate",
        relatedObjects: [{ partyId: pid }, { approvalId: approval.id }],
        recommendedNextAction: "grant_approval",
        metadata: { requiredApprover: approval.requiredApprover },
      }),
    );
  }

  for (const work of safeArray(workItems)) {
    if (String(work.status) === "completed") continue;
    if (String(work.priority) !== "high") continue;
    items.push(
      createAttentionItem({
        id: `attn_high_priority_work_${work.id}`,
        category: ATTENTION_CATEGORIES.HIGH_PRIORITY_WORK,
        summary: `High-priority open work: ${work.title ?? work.id}`,
        priority: "immediate",
        relatedObjects: [{ partyId: pid }, { workItemId: work.id }],
        recommendedNextAction: "review_work",
        metadata: { workType: work.workType },
      }),
    );
  }

  for (const run of safeArray(automationRuns)) {
    if (String(run.status) !== "FAILED") continue;
    items.push(
      createAttentionItem({
        id: `attn_automation_failed_${run.id}`,
        category: ATTENTION_CATEGORIES.AUTOMATION_FAILURE,
        summary: `Automation run failed: ${run.automationId}`,
        priority: "soon",
        relatedObjects: [{ partyId: pid }, { automationRunId: run.id }],
        recommendedNextAction: "resolve_automation_failure",
        metadata: { error: run.error },
      }),
    );
  }

  const inboundReceived = safeArray(messages).filter((m) => String(m.direction) === "inbound" && String(m.status) === "received");
  const outboundAfter = safeArray(messages).some((m) => String(m.direction) === "outbound");
  if (inboundReceived.length && !outboundAfter) {
    const msg = inboundReceived[0];
    items.push(
      createAttentionItem({
        id: `attn_unanswered_inbound_${msg.id}`,
        category: ATTENTION_CATEGORIES.UNANSWERED_INBOUND,
        summary: `Inbound communication awaiting response: ${msg.subject ?? msg.id}`,
        priority: "soon",
        relatedObjects: [{ partyId: pid }, { communicationMessageId: msg.id }],
        recommendedNextAction: "respond_to_inbound_communication",
        metadata: { receivedAt: msg.receivedAt ?? msg.createdAt },
      }),
    );
  }

  for (const interaction of safeArray(interactions)) {
    if (!interaction.outcome) continue;
    const requiresAction = ["action_required", "review_required", "follow_up_required", "external_response_required"].includes(
      String(interaction.outcome),
    );
    if (!requiresAction) continue;

    const hasDownstreamWork = safeArray(workItems).some((w) => JSON.stringify(w.relatedObjects ?? []).includes(String(interaction.id)));
    const hasPendingApproval = safeArray(approvals).some((a) => String(a.status) === "PENDING");
    if (hasDownstreamWork || hasPendingApproval) continue;

    items.push(
      createAttentionItem({
        id: `attn_outcome_requires_action_${interaction.id}`,
        category: ATTENTION_CATEGORIES.OUTCOME_REQUIRES_ACTION,
        summary: `Outcome recorded (${interaction.outcome}) with no downstream action yet`,
        priority: "soon",
        relatedObjects: [{ partyId: pid }, { interactionId: interaction.id }],
        recommendedNextAction: "complete_follow_up",
        metadata: { outcome: interaction.outcome },
      }),
    );
  }

  items.sort((a, b) => String(a.priority).localeCompare(String(b.priority)) || String(a.id).localeCompare(String(b.id)));
  return deepFreeze(items);
}
