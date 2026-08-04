import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

import { buildCampaignAudiencePreview } from "./CampaignAudienceProjection.js";
import { composeCampaignDraft } from "./CampaignDraftComposer.js";
import {
  approvalBindingsMatch,
  createApprovalBinding,
  messageIdForContentVersion,
  normalizeCampaignDocumentFromPreparation,
} from "./CampaignDocument.js";
import { buildExpectedApprovalBinding } from "./CampaignDocumentService.js";
import { renderCampaignDocumentBody, renderCampaignSubjectLine } from "./CampaignDocumentRenderer.js";

function safeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function campaignIds({ operationId, campaignTemplateId, occurrenceKey, subjectId, contentVersion = 1 }) {
  const base = [operationId || "manual", campaignTemplateId, occurrenceKey, subjectId].filter(Boolean).map(safeId).join("_");
  const baseMessageId = `cm_campaign_${base}`;
  return {
    workId: `work_campaign_${base}`,
    threadId: `ct_campaign_${base}`,
    baseMessageId,
    messageId: messageIdForContentVersion(baseMessageId, contentVersion),
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
    businessTemplate = null,
    knowledgeDocuments = [],
    knowledgeExpectations = null,
    crmContacts = [],
    nowISO = new Date().toISOString(),
  } = {}) {
    if (!stack?.workRuntime || !stack?.communicationRuntime || !stack?.businessGraphRuntime) {
      throw new Error("CampaignPreparationService: stack with work, communication, and graph runtimes required.");
    }
    const template = businessTemplate
      ? {
          id: businessTemplate.sourceTemplateId || businessTemplate.id,
          name: businessTemplate.name,
          purpose: businessTemplate.purpose || "Review campaign audience and draft.",
          channel: businessTemplate.channel || "email",
          audience: businessTemplate.audience || { type: "all_marketable_contacts" },
          approvalRequired: businessTemplate.approvalRequired !== false,
          defaultSubject: businessTemplate.subjectLine,
          cta: businessTemplate.cta || "",
          guardrails: businessTemplate.guardrails || [],
        }
      : campaignTemplate;
    if (!template?.id && !businessTemplate?.id) throw new Error("CampaignPreparationService: campaignTemplate required.");
    const requiresSubject = String(template?.audience?.type ?? "") === "subject_interest";
    if (requiresSubject && !subjectId) throw new Error("CampaignPreparationService: subjectId required for subject campaign.");
    if (subjectId && !stack.businessSubjectRuntime?.getSubject?.(String(subjectId))) {
      throw new Error("CampaignPreparationService: subject does not exist in this business.");
    }

    const key = String(occurrenceKey ?? nowISO).slice(0, 10);
    const ids = campaignIds({
      operationId: operation?.id ?? null,
      campaignTemplateId: template.id || businessTemplate?.id,
      occurrenceKey: key,
      subjectId,
      contentVersion: 1,
    });
    const existing = existingCampaignWork(stack.workRuntime, ids.workId);
    if (existing) {
      return {
        ok: true,
        idempotent: true,
        workId: ids.workId,
        threadId: ids.threadId,
        messageId: existing.metadata?.campaignPreparation?.messageId ?? ids.messageId,
        snapshotKinds: [],
      };
    }

    const audiencePreview = buildCampaignAudiencePreview({
      stack,
      audience: template.audience,
      subjectId,
      channel: template.channel ?? "email",
      crmContacts,
    });
    const draft = composeCampaignDraft({
      template: campaignTemplate || template,
      businessTemplate,
      audiencePreview,
      operation,
      nowISO,
      documentId: `doc_${ids.workId}`,
      contentVersion: 1,
      knowledgeDocuments,
      businessId,
      knowledgeExpectations,
    });

    const relatedObjects = [
      createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: ids.workId }),
    ];
    if (subjectId) relatedObjects.push(createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(subjectId) }));

    const campaignPreparation = {
      ...draft,
      workId: ids.workId,
      threadId: ids.threadId,
      messageId: ids.messageId,
      baseMessageId: ids.baseMessageId,
      occurrenceKey: key,
      approvalStatus: draft.approvalRequired ? "pending_review" : "not_required",
      deliveryReadiness: "provider_required_for_sending",
      approvalBinding: null,
      versionHistory: [],
    };

    stack.workRuntime.applyEvent({
      id: `evt_${ids.workId}_created`,
      timestampISO: String(nowISO),
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "campaign_preparation",
      payload: {
        workItem: {
          id: ids.workId,
          title: String(template.name ?? "Campaign preparation"),
          description: String(template.purpose ?? "Review campaign audience and draft."),
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
          metadata: { campaignPreparation },
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
          subject: String(template.name ?? "Campaign preparation"),
          channel: String(template.channel ?? "email"),
          status: "draft",
          participants: [],
          messageIds: [],
          relatedObjects,
          createdAt: String(nowISO),
          updatedAt: String(nowISO),
          metadata: { campaignPreparation: { workId: ids.workId, campaignTemplateId: template.id } },
        },
      },
    });

    const sharedSubject = renderCampaignSubjectLine(draft.document, { subject: audiencePreview.subject });
    const sharedBody = renderCampaignDocumentBody(draft.document, {
      recipient: draft.recipientPreparations[0] ?? null,
      subject: audiencePreview.subject,
    });

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
          channel: String(template.channel ?? "email"),
          status: "draft",
          sender: { id: "vibetech", type: "system" },
          recipients: draft.recipientPreparations.map((recipient) => ({
            id: recipient.partyId,
            type: "party",
            metadata: { email: recipient.email, displayName: recipient.displayName },
          })),
          subject: sharedSubject,
          body: sharedBody || "Review campaign draft before sending.",
          createdAt: String(nowISO),
          sentAt: null,
          deliveredAt: null,
          failedAt: null,
          relatedObjects,
          metadata: { campaignPreparation },
        },
      },
    });

    return {
      ok: true,
      idempotent: false,
      workId: ids.workId,
      threadId: ids.threadId,
      messageId: ids.messageId,
      campaign: campaignPreparation,
      audiencePreview,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }

  approve({
    stack,
    workId,
    binding = null,
    approvedBy = null,
    nowISO = new Date().toISOString(),
  } = {}) {
    const work = stack?.workRuntime?.getWorkItem?.(String(workId));
    if (!work) return { ok: false, reason: "work_not_found", snapshotKinds: [] };
    const campaign = work.metadata?.campaignPreparation;
    if (!campaign) return { ok: false, reason: "not_campaign_work", snapshotKinds: [] };
    const messageId = String(campaign.messageId ?? "");
    const message = stack.communicationRuntime?.getMessage?.(messageId);
    if (!message) return { ok: false, reason: "message_not_found", snapshotKinds: [] };
    const recipients = Array.isArray(campaign.recipientPreparations) ? campaign.recipientPreparations : [];
    const document = normalizeCampaignDocumentFromPreparation(campaign);
    if (recipients.length === 0 || (!document.subjectLine && !message.subject && !message.body)) {
      return { ok: false, reason: "campaign_review_not_ready", snapshotKinds: [] };
    }

    const expected = buildExpectedApprovalBinding(campaign, workId);
    if (binding) {
      if (!approvalBindingsMatch(expected, binding)) {
        return { ok: false, reason: "stale_approval_binding", expected, snapshotKinds: [] };
      }
    } else if (campaign.approvalBinding && !approvalBindingsMatch(expected, campaign.approvalBinding)) {
      return { ok: false, reason: "stale_approval_binding", expected, snapshotKinds: [] };
    }

    // Reject approving a protected historical message when work already points at a newer draft.
    if (String(message.status) !== "draft" && String(work.status) === "review_required") {
      return { ok: false, reason: "stale_approval_binding", expected, snapshotKinds: [] };
    }

    const approvalBinding = createApprovalBinding({
      ...expected,
      approvedAt: String(nowISO),
      approvedBy: approvedBy ? String(approvedBy) : null,
    });

    if (String(work.status) !== "approved") {
      stack.workRuntime.applyEvent({
        id: `evt_${String(workId)}_campaign_approved`,
        timestampISO: String(nowISO),
        type: WORK_EVENT_TYPES.WORK_ITEM_STATUS_CHANGED,
        source: "campaign_preparation",
        payload: { workItemId: String(workId), status: "approved" },
      });
    }

    stack.workRuntime.applyEvent({
      id: `evt_${String(workId)}_campaign_binding_${Date.now()}`,
      timestampISO: String(nowISO),
      type: WORK_EVENT_TYPES.WORK_ITEM_UPDATED,
      source: "campaign_preparation",
      payload: {
        workItemId: String(workId),
        patch: {
          metadata: {
            ...(work.metadata ?? {}),
            campaignPreparation: {
              ...campaign,
              document: {
                ...document,
                status: "approved",
              },
              approvalStatus: "approved",
              communicationStatus: "queued",
              approvalBinding,
              contentVersion: document.contentVersion,
              contentHash: document.contentHash,
              audienceFingerprint: document.audienceFingerprint ?? campaign.audienceFingerprint,
            },
          },
        },
      },
    });

    if (String(message.status) === "draft") {
      stack.communicationRuntime.applyEvent({
        id: `evt_${messageId}_queued_after_approval`,
        timestampISO: String(nowISO),
        type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
        source: "campaign_preparation",
        payload: { messageId },
      });
    }

    return {
      ok: true,
      workId: String(workId),
      messageId,
      approvalBinding,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }
}
