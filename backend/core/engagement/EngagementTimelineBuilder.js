import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createEngagementTimelineItem } from "./EngagementTimelineItem.js";
import { TIMELINE_CATEGORIES, TIMELINE_ITEM_TYPES } from "./EngagementDefaults.js";
import {
  entityReferencesParty,
  extractRelatedObjectRefs,
  interactionReferencesParty,
  relatedObjectsReferenceParty,
} from "./_utils/relatedObjectRefs.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function compareTimelineItems(a, b) {
  const ta = new Date(String(a.occurredAt)).getTime();
  const tb = new Date(String(b.occurredAt)).getTime();
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

function validDateString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "null" || text === "undefined") return null;
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? text : null;
}

function humanizeToken(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function relationshipDescription({ relationship, partyId, businessSubjectRuntime } = {}) {
  const type = String(relationship?.relationshipType ?? "");
  const from = relationship?.fromEntity ?? {};
  const to = relationship?.toEntity ?? {};
  const other = String(from.entityId) === String(partyId) ? to : from;
  if (type === "INTERESTED_IN" && String(other.entityType) === "Subject") {
    const subject = businessSubjectRuntime?.getSubject?.(String(other.entityId));
    return `Property interest linked${subject?.displayName ? `: ${subject.displayName}` : ""}.`;
  }
  if (type === "REQUESTED_BY") return "Request linked to this contact.";
  if (String(other.entityType) === "Organization") return `${humanizeToken(type)} classification added.`;
  return `${humanizeToken(type)} relationship added.`;
}

function partyLinkedRequestIds({ businessGraphRuntime, partyId } = {}) {
  const pid = String(partyId);
  const ids = new Set();
  for (const rel of safeArray(businessGraphRuntime?.getRelationships?.())) {
    const to = rel?.toEntity;
    const from = rel?.fromEntity;
    if (String(to?.entityType) === "Party" && String(to?.entityId) === pid && String(from?.entityType) === "Request") {
      ids.add(String(from.entityId));
    }
    if (String(from?.entityType) === "Party" && String(from?.entityId) === pid && String(to?.entityType) === "Request") {
      ids.add(String(to.entityId));
    }
  }
  return ids;
}

function workReferencesParty(work, partyId, requestIds) {
  if (!work) return false;
  if (relatedObjectsReferenceParty(work.relatedObjects, partyId)) return true;
  const refs = extractRelatedObjectRefs(work.relatedObjects);
  return refs.requestIds.some((id) => requestIds.has(id));
}

function collectPartyContext({
  partyId,
  businessGraphRuntime,
  requestRuntime,
  workRuntime,
  communicationRuntime,
  interactionRuntime,
  automationRuntime,
  approvalRuntime,
  businessSubjectRuntime,
} = {}) {
  const pid = String(partyId);
  const linkedRequestIds = partyLinkedRequestIds({ businessGraphRuntime, partyId: pid });

  const requests = safeArray(requestRuntime?.getRequests?.()).filter(
    (r) => linkedRequestIds.has(String(r.id)) || String(r.requester) === pid,
  );
  const requestIds = new Set(requests.map((r) => String(r.id)));

  const workItems = safeArray(workRuntime?.getWorkItems?.()).filter((w) =>
    workReferencesParty(w, pid, requestIds),
  );
  const workIds = new Set(workItems.map((w) => String(w.id)));

  const interactions = safeArray(interactionRuntime?.getInteractions?.()).filter((i) =>
    interactionReferencesParty(i, pid),
  );
  const interactionIds = new Set(interactions.map((i) => String(i.id)));

  const threads = safeArray(communicationRuntime?.getThreads?.()).filter((t) =>
    entityReferencesParty(t, pid),
  );
  const threadIds = new Set(threads.map((t) => String(t.id)));

  const messages = safeArray(communicationRuntime?.getMessages?.()).filter((m) => {
    if (entityReferencesParty(m, pid)) return true;
    if (threadIds.has(String(m.threadId))) return true;
    const refs = extractRelatedObjectRefs(m.relatedObjects);
    return refs.partyIds.includes(pid) || refs.requestIds.some((id) => requestIds.has(id)) || refs.workItemIds.some((id) => workIds.has(id));
  });

  const automationRuns = safeArray(automationRuntime?.getRuns?.()).filter((run) => {
    const triggerId = String(run.triggerEventId ?? "");
    if ([...interactionIds].some((id) => triggerId.includes(id))) return true;
    for (const er of safeArray(run.executionResults)) {
      const out = er?.output;
      if (out?.workItemId && workIds.has(String(out.workItemId))) return true;
    }
    return false;
  });
  const runIds = new Set(automationRuns.map((r) => String(r.id)));

  const approvals = safeArray(approvalRuntime?.getRequests?.()).filter((a) => {
    const src = a.sourceReference ?? {};
    if (runIds.has(String(src.runId))) return true;
    return false;
  });

  return {
    partyId: pid,
    linkedRequestIds,
    requestIds,
    requests,
    workItems,
    interactions,
    threads,
    messages,
    automationRuns,
    approvals,
    businessSubjectRuntime,
  };
}

function extractWorkItemIdFromTimelineItem(item) {
  for (const ref of safeArray(item?.relatedObjects)) {
    if (ref?.workItemId) return String(ref.workItemId);
  }
  return null;
}

function extractRequestIdFromTimelineItem(item) {
  for (const ref of safeArray(item?.relatedObjects)) {
    if (ref?.requestId) return String(ref.requestId);
  }
  return null;
}

function timelineSemanticKey(item) {
  const type = String(item?.type ?? "");
  if (type === TIMELINE_ITEM_TYPES.WORK_ASSIGNED || type === TIMELINE_ITEM_TYPES.WORK_CREATED) {
    const workItemId = extractWorkItemIdFromTimelineItem(item);
    if (workItemId) return `${type}:${workItemId}`;
  }
  if (type === TIMELINE_ITEM_TYPES.REQUEST_CREATED || type === TIMELINE_ITEM_TYPES.REQUEST_CONVERTED) {
    const requestId = extractRequestIdFromTimelineItem(item);
    if (requestId) return `${type}:${requestId}`;
  }
  return String(item?.id ?? "");
}

function mergeTimelineItems(runtimeItems, platformItems) {
  const platformByKey = new Map();
  for (const item of platformItems) {
    platformByKey.set(timelineSemanticKey(item), item);
  }

  const merged = [];
  const seenPlatformKeys = new Set();

  for (const item of runtimeItems) {
    const key = timelineSemanticKey(item);
    const platform = platformByKey.get(key);
    if (platform) {
      merged.push(
        createEngagementTimelineItem({
          ...item,
          id: platform.id,
          occurredAt: platform.occurredAt,
          sourceReference: platform.sourceReference ?? item.sourceReference,
        }),
      );
      seenPlatformKeys.add(key);
      continue;
    }
    merged.push(item);
  }

  for (const [key, item] of platformByKey.entries()) {
    if (seenPlatformKeys.has(key)) continue;
    merged.push(item);
  }

  return merged;
}

function resolveLinkedRequestForWork(work, requestRuntime) {
  const refs = extractRelatedObjectRefs(work?.relatedObjects);
  const requestId = refs.requestIds[0] ?? (work?.requestId ? String(work.requestId) : null);
  if (!requestId) return null;
  return requestRuntime?.getRequest?.(requestId) ?? null;
}

function resolveLinkedInteractionForWork(work, interactions) {
  const refs = extractRelatedObjectRefs(work?.relatedObjects);
  for (const interactionId of refs.interactionIds) {
    const interaction = safeArray(interactions).find((i) => String(i.id) === String(interactionId));
    if (interaction) return interaction;
  }
  for (const interaction of safeArray(interactions)) {
    const iRefs = extractRelatedObjectRefs(interaction?.relatedObjects);
    if (iRefs.workItemIds.includes(String(work?.id))) return interaction;
  }
  return null;
}

function requestOccurrenceAt(request) {
  return request?.receivedAt ?? request?.createdAt ?? null;
}

function isEarlierThan(iso, otherIso) {
  if (!iso || !otherIso) return false;
  const a = new Date(String(iso)).getTime();
  const b = new Date(String(otherIso)).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a < b;
}

function resolveWorkOccurrenceAt({ work, requestRuntime, interactions, primaryAt, fallbackAt }) {
  const request = resolveLinkedRequestForWork(work, requestRuntime);
  const interaction = resolveLinkedInteractionForWork(work, interactions);
  const anchors = [
    requestOccurrenceAt(request),
    interaction?.occurredAt ?? null,
    primaryAt,
    fallbackAt,
    work?.createdAt ?? null,
  ].filter(Boolean);

  let resolved = primaryAt ?? fallbackAt ?? work?.createdAt ?? null;
  for (const anchor of anchors) {
    if (!resolved || isEarlierThan(resolved, anchor)) {
      resolved = anchor;
    }
  }
  return resolved;
}

function buildRuntimeTimelineItems(ctx, party, workRuntime, requestRuntime) {
  const items = [];
  const pid = ctx.partyId;

  if (party) {
    items.push(
      createEngagementTimelineItem({
        id: `tl_party_created_${party.id}`,
        type: TIMELINE_ITEM_TYPES.PARTY_CREATED,
        category: TIMELINE_CATEGORIES.PARTY,
        occurredAt: party.createdAt,
        title: "Party created",
        description: `${party.displayName} (${party.partyType})`,
        status: party.status,
        actor: null,
        relatedObjects: [{ partyId: pid }],
        sourceReference: { sourceType: "party", sourceId: String(party.id) },
      }),
    );
  }

  for (const rel of safeArray(ctx.businessGraphRuntime?.getRelationships?.())) {
    const involvesParty =
      (String(rel?.toEntity?.entityType) === "Party" && String(rel?.toEntity?.entityId) === pid) ||
      (String(rel?.fromEntity?.entityType) === "Party" && String(rel?.fromEntity?.entityId) === pid);
    if (!involvesParty) continue;

    items.push(
      createEngagementTimelineItem({
        id: `tl_relationship_created_${rel.id}`,
        type: TIMELINE_ITEM_TYPES.RELATIONSHIP_CREATED,
        category: TIMELINE_CATEGORIES.RELATIONSHIP,
        occurredAt: rel.createdAt,
        title: "Relationship created",
        description: relationshipDescription({
          relationship: rel,
          partyId: pid,
          businessSubjectRuntime: ctx.businessSubjectRuntime,
        }),
        status: rel.status,
        actor: null,
        relatedObjects: [{ partyId: pid }, { relationshipId: rel.id }],
        sourceReference: { sourceType: "relationship", sourceId: String(rel.id) },
      }),
    );
  }

  for (const req of ctx.requests) {
    items.push(
      createEngagementTimelineItem({
        id: `tl_request_created_${req.id}`,
        type: TIMELINE_ITEM_TYPES.REQUEST_CREATED,
        category: TIMELINE_CATEGORIES.REQUEST,
        occurredAt: req.receivedAt ?? req.createdAt,
        title: "Request received",
        description: String(req.title ?? req.id),
        status: req.status,
        actor: req.requestedBy ?? null,
        relatedObjects: [{ requestId: req.id }, { partyId: pid }],
        sourceReference: { sourceType: "request", sourceId: String(req.id) },
      }),
    );

    if (String(req.status) === "converted" && req.convertedAt) {
      items.push(
        createEngagementTimelineItem({
          id: `tl_request_converted_${req.id}`,
          type: TIMELINE_ITEM_TYPES.REQUEST_CONVERTED,
          category: TIMELINE_CATEGORIES.REQUEST,
          occurredAt: req.convertedAt,
          title: "Request converted",
          description: String(req.title ?? req.id),
          status: req.status,
          actor: null,
          relatedObjects: [{ requestId: req.id }, { partyId: pid }],
          sourceReference: { sourceType: "request", sourceId: String(req.id) },
        }),
      );
    }
  }

  for (const work of ctx.workItems) {
    items.push(
      createEngagementTimelineItem({
        id: `tl_work_created_${work.id}`,
        type: TIMELINE_ITEM_TYPES.WORK_CREATED,
        category: TIMELINE_CATEGORIES.WORK,
        occurredAt: resolveWorkOccurrenceAt({
          work,
          requestRuntime,
          interactions: ctx.interactions,
          primaryAt: work.createdAt,
        }),
        title: "Work created",
        description: String(work.title ?? work.id),
        status: work.status,
        actor: work.requestedBy ?? null,
        relatedObjects: [{ workItemId: work.id }, { partyId: pid }, ...(work.relatedObjects ?? [])],
        sourceReference: { sourceType: "work", sourceId: String(work.id) },
        metadata: { workType: work.workType, priority: work.priority },
      }),
    );
  }

  const workIds = new Set(ctx.workItems.map((w) => String(w.id)));
  const assignmentItems = new Map();
  for (const assignment of safeArray(workRuntime?.getAssignments?.())) {
    if (!workIds.has(String(assignment.workItemId))) continue;
    if (String(assignment.status) !== "active") continue;

    const work = ctx.workItems.find((w) => String(w.id) === String(assignment.workItemId));
    if (!work) continue;

    assignmentItems.set(String(assignment.workItemId), assignment);
    items.push(
      createEngagementTimelineItem({
        id: `tl_work_assigned_${assignment.id}`,
        type: TIMELINE_ITEM_TYPES.WORK_ASSIGNED,
        category: TIMELINE_CATEGORIES.WORK,
        occurredAt: resolveWorkOccurrenceAt({
          work,
          requestRuntime,
          interactions: ctx.interactions,
          primaryAt: assignment.assignedAt,
          fallbackAt: work.createdAt,
        }),
        title: "Work assigned",
        description: `${work.title ?? work.id} → ${assignment.assigneeId}`,
        status: work.status,
        actor: assignment.assigneeId,
        relatedObjects: [{ workItemId: work.id }, { partyId: pid }],
        sourceReference: { sourceType: "work_assignment", sourceId: String(assignment.id) },
      }),
    );
  }

  for (const work of ctx.workItems) {
    if (!work.assignedTo || work.assignedTo === "unassigned") continue;
    if (assignmentItems.has(String(work.id))) continue;

    items.push(
      createEngagementTimelineItem({
        id: `tl_work_assigned_${work.id}`,
        type: TIMELINE_ITEM_TYPES.WORK_ASSIGNED,
        category: TIMELINE_CATEGORIES.WORK,
        occurredAt: resolveWorkOccurrenceAt({
          work,
          requestRuntime,
          interactions: ctx.interactions,
          primaryAt: work.createdAt,
        }),
        title: "Work assigned",
        description: `${work.title ?? work.id} → ${work.assignedTo}`,
        status: work.status,
        actor: work.assignedTo,
        relatedObjects: [{ workItemId: work.id }, { partyId: pid }],
        sourceReference: { sourceType: "work", sourceId: String(work.id) },
      }),
    );
  }

  for (const thread of ctx.threads) {
    for (const msg of ctx.messages.filter((m) => String(m.threadId) === String(thread.id))) {
      const base = {
        category: TIMELINE_CATEGORIES.COMMUNICATION,
        occurredAt: msg.createdAt,
        status: msg.status,
        actor: msg.sender?.id ?? null,
        relatedObjects: [{ communicationThreadId: thread.id }, { communicationMessageId: msg.id }, { partyId: pid }, ...(msg.relatedObjects ?? [])],
        sourceReference: { sourceType: "communication_message", sourceId: String(msg.id) },
        metadata: { channel: msg.channel, direction: msg.direction },
      };

      items.push(
        createEngagementTimelineItem({
          ...base,
          id: `tl_comm_drafted_${msg.id}`,
          type: TIMELINE_ITEM_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
          title: "Communication drafted",
          description: `Draft: ${String(msg.subject ?? msg.body ?? msg.id).slice(0, 120)}`,
        }),
      );

      if (String(msg.status) === "queued" || msg.queuedAt) {
        items.push(
          createEngagementTimelineItem({
            ...base,
            id: `tl_comm_queued_${msg.id}`,
            type: TIMELINE_ITEM_TYPES.COMMUNICATION_MESSAGE_QUEUED,
            occurredAt: msg.queuedAt ?? msg.updatedAt ?? msg.createdAt,
            title: "Communication queued",
            description: `Queued, not sent: ${String(msg.subject ?? msg.id)}`,
          }),
        );
      }
      if (String(msg.status) === "failed" || msg.failedAt) {
        items.push(
          createEngagementTimelineItem({
            ...base,
            id: `tl_comm_failed_${msg.id}`,
            type: TIMELINE_ITEM_TYPES.COMMUNICATION_MESSAGE_FAILED,
            occurredAt: msg.failedAt ?? msg.updatedAt ?? msg.createdAt,
            title: "Communication failed",
            description: String(msg.subject ?? msg.id),
          }),
        );
      }
      if (String(msg.status) === "received" || msg.receivedAt) {
        items.push(
          createEngagementTimelineItem({
            ...base,
            id: `tl_comm_received_${msg.id}`,
            type: TIMELINE_ITEM_TYPES.COMMUNICATION_MESSAGE_RECEIVED,
            occurredAt: msg.receivedAt ?? msg.updatedAt ?? msg.createdAt,
            title: "Communication received",
            description: String(msg.subject ?? msg.id),
          }),
        );
      }
      if (String(msg.status) === "sent" || msg.sentAt) {
        items.push(
          createEngagementTimelineItem({
            ...base,
            id: `tl_comm_sent_${msg.id}`,
            type: TIMELINE_ITEM_TYPES.COMMUNICATION_MESSAGE_SENT,
            occurredAt: msg.sentAt ?? msg.updatedAt ?? msg.createdAt,
            title: "Communication sent",
            description: `Sent: ${String(msg.subject ?? msg.id)}`,
          }),
        );
      }
    }
  }

  for (const interaction of ctx.interactions) {
    items.push(
      createEngagementTimelineItem({
        id: `tl_interaction_recorded_${interaction.id}`,
        type: TIMELINE_ITEM_TYPES.INTERACTION_RECORDED,
        category: TIMELINE_CATEGORIES.INTERACTION,
        occurredAt: interaction.occurredAt,
        title: "Interaction recorded",
        description: String(interaction.summary ?? `${interaction.interactionType} via ${interaction.channel}`),
        status: interaction.status,
        actor: interaction.ownerId,
        relatedObjects: [{ interactionId: interaction.id }, { partyId: pid }, ...(interaction.relatedObjects ?? [])],
        sourceReference: { sourceType: "interaction", sourceId: String(interaction.id) },
        metadata: { interactionType: interaction.interactionType, channel: interaction.channel, direction: interaction.direction },
      }),
    );

    for (const note of safeArray(interaction.notes)) {
      items.push(
        createEngagementTimelineItem({
          id: `tl_interaction_note_${note.id}`,
          type: TIMELINE_ITEM_TYPES.INTERACTION_NOTE_ADDED,
          category: TIMELINE_CATEGORIES.INTERACTION,
          occurredAt: note.timestampISO,
          title: "Human note recorded",
          description: String(note.text),
          status: null,
          actor: note.authorId,
          relatedObjects: [{ interactionId: interaction.id }, { partyId: pid }, ...(note.relatedObjects ?? [])],
          sourceReference: { sourceType: "interaction_note", sourceId: String(note.id) },
          metadata: { exactHumanNote: true },
        }),
      );
    }

    if (interaction.outcome) {
      const outcomeLabel = humanizeToken(interaction.outcome);
      const nextStepLabel =
        interaction.nextStep && String(interaction.nextStep) !== String(interaction.outcome)
          ? humanizeToken(interaction.nextStep)
          : "";
      items.push(
        createEngagementTimelineItem({
          id: `tl_interaction_outcome_${interaction.id}`,
          type: TIMELINE_ITEM_TYPES.INTERACTION_OUTCOME_RECORDED,
          category: TIMELINE_CATEGORIES.INTERACTION,
          occurredAt: interaction.updatedAt ?? interaction.occurredAt,
          title: "Outcome recorded",
          description: `Outcome: ${outcomeLabel}${nextStepLabel ? ` · Next: ${nextStepLabel}` : ""}`,
          status: interaction.outcome,
          actor: interaction.ownerId,
          relatedObjects: [{ interactionId: interaction.id }, { partyId: pid }],
          sourceReference: { sourceType: "interaction", sourceId: String(interaction.id) },
        }),
      );
    }

    const followUpAt = validDateString(interaction.followUpAt);
    if (followUpAt) {
      items.push(
        createEngagementTimelineItem({
          id: `tl_follow_up_scheduled_${interaction.id}`,
          type: TIMELINE_ITEM_TYPES.FOLLOW_UP_SCHEDULED,
          category: TIMELINE_CATEGORIES.INTERACTION,
          occurredAt: followUpAt,
          title: "Follow-up scheduled",
          description: `Follow-up at ${followUpAt}`,
          status: "scheduled",
          actor: interaction.ownerId,
          relatedObjects: [{ interactionId: interaction.id }, { partyId: pid }],
          sourceReference: { sourceType: "interaction", sourceId: String(interaction.id) },
        }),
      );
    }
  }

  for (const run of ctx.automationRuns) {
    items.push(
      createEngagementTimelineItem({
        id: `tl_automation_started_${run.id}`,
        type: TIMELINE_ITEM_TYPES.AUTOMATION_RUN_STARTED,
        category: TIMELINE_CATEGORIES.AUTOMATION,
        occurredAt: run.startedAt,
        title: "Automation run started",
        description: `Automation ${run.automationId}`,
        status: run.status,
        actor: "automation_engine",
        relatedObjects: [{ automationRunId: run.id }, { partyId: pid }],
        sourceReference: { sourceType: "automation_run", sourceId: String(run.id) },
      }),
    );

    if (String(run.status) === "COMPLETED" && run.completedAt) {
      items.push(
        createEngagementTimelineItem({
          id: `tl_automation_completed_${run.id}`,
          type: TIMELINE_ITEM_TYPES.AUTOMATION_RUN_COMPLETED,
          category: TIMELINE_CATEGORIES.AUTOMATION,
          occurredAt: run.completedAt,
          title: "Automation run completed",
          description: `Automation ${run.automationId}`,
          status: run.status,
          actor: "automation_engine",
          relatedObjects: [{ automationRunId: run.id }, { partyId: pid }],
          sourceReference: { sourceType: "automation_run", sourceId: String(run.id) },
        }),
      );
    }

    if (String(run.status) === "FAILED") {
      items.push(
        createEngagementTimelineItem({
          id: `tl_automation_failed_${run.id}`,
          type: TIMELINE_ITEM_TYPES.AUTOMATION_RUN_FAILED,
          category: TIMELINE_CATEGORIES.AUTOMATION,
          occurredAt: run.completedAt ?? run.startedAt,
          title: "Automation run failed",
          description: String(run.error ?? "Automation run failed."),
          status: run.status,
          actor: "automation_engine",
          relatedObjects: [{ automationRunId: run.id }, { partyId: pid }],
          sourceReference: { sourceType: "automation_run", sourceId: String(run.id) },
        }),
      );
    }
  }

  for (const approval of ctx.approvals) {
    items.push(
      createEngagementTimelineItem({
        id: `tl_approval_requested_${approval.id}`,
        type: TIMELINE_ITEM_TYPES.APPROVAL_REQUESTED,
        category: TIMELINE_CATEGORIES.APPROVAL,
        occurredAt: approval.requestedAt,
        title: "Approval requested",
        description: `${approval.requestType} awaiting ${approval.requiredApprover}`,
        status: approval.status,
        actor: approval.requestedBy,
        relatedObjects: [{ approvalId: approval.id }, { partyId: pid }],
        sourceReference: { sourceType: "approval", sourceId: String(approval.id) },
      }),
    );

    if (String(approval.status) === "GRANTED" && approval.decidedAt) {
      items.push(
        createEngagementTimelineItem({
          id: `tl_approval_granted_${approval.id}`,
          type: TIMELINE_ITEM_TYPES.APPROVAL_GRANTED,
          category: TIMELINE_CATEGORIES.APPROVAL,
          occurredAt: approval.decidedAt,
          title: "Approval granted",
          description: approval.requestType,
          status: approval.status,
          actor: approval.requiredApprover,
          relatedObjects: [{ approvalId: approval.id }, { partyId: pid }],
          sourceReference: { sourceType: "approval", sourceId: String(approval.id) },
        }),
      );
    }

    if (String(approval.status) === "REJECTED" && approval.decidedAt) {
      items.push(
        createEngagementTimelineItem({
          id: `tl_approval_rejected_${approval.id}`,
          type: TIMELINE_ITEM_TYPES.APPROVAL_REJECTED,
          category: TIMELINE_CATEGORIES.APPROVAL,
          occurredAt: approval.decidedAt,
          title: "Approval rejected",
          description: approval.requestType,
          status: approval.status,
          actor: approval.requiredApprover,
          relatedObjects: [{ approvalId: approval.id }, { partyId: pid }],
          sourceReference: { sourceType: "approval", sourceId: String(approval.id) },
        }),
      );
    }
  }

  return items;
}

function buildPlatformEventTimelineItems(platformEventStore, ctx) {
  if (!platformEventStore) return [];

  const items = [];
  const pid = ctx.partyId;
  const interactionIds = new Set(ctx.interactions.map((i) => String(i.id)));
  const workIds = new Set(ctx.workItems.map((w) => String(w.id)));
  const requestIds = ctx.requestIds ?? new Set(ctx.requests.map((r) => String(r.id)));

  for (const evt of safeArray(platformEventStore.getEvents?.())) {
    const payload = evt.payload ?? {};
    const aggregateId = String(evt.aggregateId ?? "");
    const requesterId = String(payload.requester ?? payload.request?.requester ?? "");
    const linked =
      aggregateId === pid ||
      requesterId === pid ||
      requestIds.has(aggregateId) ||
      interactionIds.has(aggregateId) ||
      workIds.has(aggregateId) ||
      interactionIds.has(String(payload.interactionId ?? "")) ||
      workIds.has(String(payload.workItemId ?? "")) ||
      requestIds.has(String(payload.requestId ?? ""));

    if (!linked) continue;

    const typeMap = {
      REQUEST_RECEIVED: TIMELINE_ITEM_TYPES.REQUEST_CREATED,
      REQUEST_CONVERTED: TIMELINE_ITEM_TYPES.REQUEST_CONVERTED,
      INTERACTION_RECORDED: TIMELINE_ITEM_TYPES.INTERACTION_RECORDED,
      INTERACTION_OUTCOME_RECORDED: TIMELINE_ITEM_TYPES.INTERACTION_OUTCOME_RECORDED,
      FOLLOW_UP_SCHEDULED: TIMELINE_ITEM_TYPES.FOLLOW_UP_SCHEDULED,
      WORK_CREATED: TIMELINE_ITEM_TYPES.WORK_CREATED,
      WORK_ASSIGNED: TIMELINE_ITEM_TYPES.WORK_ASSIGNED,
      AUTOMATION_RUN_STARTED: TIMELINE_ITEM_TYPES.AUTOMATION_RUN_STARTED,
      AUTOMATION_RUN_COMPLETED: TIMELINE_ITEM_TYPES.AUTOMATION_RUN_COMPLETED,
      AUTOMATION_RUN_FAILED: TIMELINE_ITEM_TYPES.AUTOMATION_RUN_FAILED,
      APPROVAL_REQUESTED: TIMELINE_ITEM_TYPES.APPROVAL_REQUESTED,
      APPROVAL_GRANTED: TIMELINE_ITEM_TYPES.APPROVAL_GRANTED,
      APPROVAL_REJECTED: TIMELINE_ITEM_TYPES.APPROVAL_REJECTED,
    };

    const mapped = typeMap[String(evt.eventType)];
    if (!mapped) continue;

    const workItemId = String(payload.workItemId ?? aggregateId);
    const requestId = String(payload.requestId ?? aggregateId);

    items.push(
      createEngagementTimelineItem({
        id: `tl_platform_${evt.eventId}`,
        type: mapped,
        category:
          mapped === TIMELINE_ITEM_TYPES.REQUEST_CREATED || mapped === TIMELINE_ITEM_TYPES.REQUEST_CONVERTED
            ? TIMELINE_CATEGORIES.REQUEST
            : mapped === TIMELINE_ITEM_TYPES.WORK_CREATED || mapped === TIMELINE_ITEM_TYPES.WORK_ASSIGNED
              ? TIMELINE_CATEGORIES.WORK
              : TIMELINE_CATEGORIES.AUTOMATION,
        occurredAt: evt.occurredAt,
        title: String(evt.eventType).replace(/_/g, " ").toLowerCase(),
        description: aggregateId,
        status: null,
        actor: evt.publisher ?? null,
        relatedObjects: [
          { partyId: pid },
          ...(workIds.has(workItemId) || String(evt.eventType).startsWith("WORK_")
            ? [{ workItemId }]
            : []),
          ...(requestIds.has(requestId) || String(evt.eventType).startsWith("REQUEST_")
            ? [{ requestId }]
            : []),
        ],
        sourceReference: { sourceType: "platform_event", sourceId: String(evt.eventId) },
      }),
    );
  }

  return items;
}

export function buildEngagementTimeline({
  partyId,
  businessGraphRuntime,
  requestRuntime,
  workRuntime,
  communicationRuntime,
  interactionRuntime,
  automationRuntime,
  approvalRuntime,
  platformEventStore,
  businessSubjectRuntime,
} = {}) {
  const party = businessGraphRuntime?.getParty?.(partyId) ?? null;
  const ctx = collectPartyContext({
    partyId,
    businessGraphRuntime,
    requestRuntime,
    workRuntime,
    communicationRuntime,
    interactionRuntime,
    automationRuntime,
    approvalRuntime,
    businessSubjectRuntime,
  });
  ctx.businessGraphRuntime = businessGraphRuntime;

  const runtimeItems = buildRuntimeTimelineItems(ctx, party, workRuntime, requestRuntime);
  const platformItems = buildPlatformEventTimelineItems(platformEventStore, ctx);

  const merged = mergeTimelineItems(runtimeItems, platformItems);

  merged.sort(compareTimelineItems);
  return deepFreeze(merged);
}

export { collectPartyContext };
