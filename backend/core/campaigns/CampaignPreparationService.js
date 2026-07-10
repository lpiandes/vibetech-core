import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

import { buildCampaignAudiencePreview } from "./CampaignAudienceProjection.js";
import { composeCampaignDraft } from "./CampaignDraftComposer.js";

function safeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function campaignIds({ operationId, campaignTemplateId, occurrenceKey, subjectId }) {
  const base = [operationId || "manual", campaignTemplateId, occurrenceKey, subjectId].filter(Boolean).map(safeId).join("_");
  return {
    workId: `work_campaign_${base}`,
    threadId: `ct_campaign_${base}`,
    messageId: `cm_campaign_${base}`,
  };
}

function existingCampaignWork(workRuntime, workId) {
  return workRuntime?.getWorkItem?.(workId) ?? null;
}

export class CampaignPreparationService {
  execute({
    stack,
    businessId,
    campaignTemplate,
    operation = null,
    occurrenceKey,
    subjectId = null,
    nowISO = new Date().toISOString(),
  } = {}) {
    if (!stack?.workRuntime || !stack?.communicationRuntime || !stack?.businessGraphRuntime) {
      throw new Error("CampaignPreparationService: stack with work, communication, and graph runtimes required.");
    }
    if (!campaignTemplate?.id) throw new Error("CampaignPreparationService: campaignTemplate required.");
    const requiresSubject = String(campaignTemplate?.audience?.type ?? "") === "subject_interest";
    if (requiresSubject && !subjectId) throw new Error("CampaignPreparationService: subjectId required for subject campaign.");
    if (subjectId && !stack.businessSubjectRuntime?.getSubject?.(String(subjectId))) {
      throw new Error("CampaignPreparationService: subject does not exist in this business.");
    }

    const key = String(occurrenceKey ?? nowISO).slice(0, 10);
    const ids = campaignIds({
      operationId: operation?.id ?? null,
      campaignTemplateId: campaignTemplate.id,
      occurrenceKey: key,
      subjectId,
    });
    const existing = existingCampaignWork(stack.workRuntime, ids.workId);
    if (existing) {
      return {
        ok: true,
        idempotent: true,
        workId: ids.workId,
        threadId: ids.threadId,
        messageId: ids.messageId,
        snapshotKinds: [],
      };
    }

    const audiencePreview = buildCampaignAudiencePreview({
      stack,
      audience: campaignTemplate.audience,
      subjectId,
      channel: campaignTemplate.channel ?? "email",
    });
    const draft = composeCampaignDraft({
      template: campaignTemplate,
      audiencePreview,
      operation,
      nowISO,
    });

    const relatedObjects = [
      createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: ids.workId }),
    ];
    if (subjectId) relatedObjects.push(createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(subjectId) }));

    stack.workRuntime.applyEvent({
      id: `evt_${ids.workId}_created`,
      timestampISO: String(nowISO),
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "campaign_preparation",
      payload: {
        workItem: {
          id: ids.workId,
          title: String(campaignTemplate.name ?? "Campaign preparation"),
          description: String(campaignTemplate.purpose ?? "Review campaign audience and draft."),
          workType: "campaign_preparation",
          status: "review_required",
          priority: "medium",
          stageId: "stage_approval",
          queueId: "queue_approvals",
          assignedTo: "unassigned",
          requestedBy: "system",
          source: "recurring_business_operation",
          dueAt: String(nowISO),
          createdAt: String(nowISO),
          updatedAt: String(nowISO),
          completedAt: null,
          blockedReason: null,
          relatedObjects,
          requirements: ["review_audience", "approve_before_sending"],
          metadata: {
            campaignPreparation: {
              ...draft,
              workId: ids.workId,
              threadId: ids.threadId,
              messageId: ids.messageId,
              occurrenceKey: key,
              approvalStatus: draft.approvalRequired ? "pending_review" : "not_required",
              deliveryReadiness: "provider_required_for_sending",
            },
          },
        },
      },
    });

    stack.communicationRuntime.applyEvent({
      id: `evt_${ids.threadId}_created`,
      timestampISO: String(nowISO),
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
      source: "campaign_preparation",
      payload: {
        thread: {
          id: ids.threadId,
          subject: String(campaignTemplate.name ?? "Campaign preparation"),
          channel: String(campaignTemplate.channel ?? "email"),
          status: "draft",
          participants: [],
          messageIds: [],
          relatedObjects,
          createdAt: String(nowISO),
          updatedAt: String(nowISO),
          metadata: { campaignPreparation: { workId: ids.workId, campaignTemplateId: campaignTemplate.id } },
        },
      },
    });

    const first = draft.recipientPreparations[0] ?? {};
    stack.communicationRuntime.applyEvent({
      id: `evt_${ids.messageId}_drafted`,
      timestampISO: String(nowISO),
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
      source: "campaign_preparation",
      payload: {
        message: {
          id: ids.messageId,
          threadId: ids.threadId,
          direction: "outbound",
          channel: String(campaignTemplate.channel ?? "email"),
          status: "draft",
          sender: { id: "vibetech", type: "system" },
          recipients: draft.recipientPreparations.map((recipient) => ({
            id: recipient.partyId,
            type: "party",
            metadata: { email: recipient.email, displayName: recipient.displayName },
          })),
          subject: String(first.subject ?? campaignTemplate.defaultSubject ?? campaignTemplate.name),
          body: String(first.body ?? "Review campaign draft before sending."),
          createdAt: String(nowISO),
          sentAt: null,
          deliveredAt: null,
          failedAt: null,
          relatedObjects,
          metadata: { campaignPreparation: draft },
        },
      },
    });

    return {
      ok: true,
      idempotent: false,
      workId: ids.workId,
      threadId: ids.threadId,
      messageId: ids.messageId,
      campaign: draft,
      audiencePreview,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }

  approve({ stack, workId, nowISO = new Date().toISOString() } = {}) {
    const work = stack?.workRuntime?.getWorkItem?.(String(workId));
    if (!work) return { ok: false, reason: "work_not_found", snapshotKinds: [] };
    const campaign = work.metadata?.campaignPreparation;
    if (!campaign) return { ok: false, reason: "not_campaign_work", snapshotKinds: [] };
    const messageId = String(campaign.messageId ?? "");
    const message = stack.communicationRuntime?.getMessage?.(messageId);
    if (!message) return { ok: false, reason: "message_not_found", snapshotKinds: [] };
    const recipients = Array.isArray(campaign.recipientPreparations) ? campaign.recipientPreparations : [];
    if (recipients.length === 0 || (!message.subject && !message.body)) {
      return { ok: false, reason: "campaign_review_not_ready", snapshotKinds: [] };
    }

    if (String(work.status) !== "approved") {
      stack.workRuntime.applyEvent({
        id: `evt_${String(workId)}_campaign_approved`,
        timestampISO: String(nowISO),
        type: WORK_EVENT_TYPES.WORK_ITEM_STATUS_CHANGED,
        source: "campaign_preparation",
        payload: { workItemId: String(workId), status: "approved" },
      });
    }
    if (String(message.status) === "draft") {
      stack.communicationRuntime.applyEvent({
        id: `evt_${messageId}_queued_after_approval`,
        timestampISO: String(nowISO),
        type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
        source: "campaign_preparation",
        payload: { messageId },
      });
    }
    return { ok: true, workId: String(workId), messageId, snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION] };
  }
}
