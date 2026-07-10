import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

import {
  approvalBindingsMatch,
  computeAudienceFingerprint,
  computeContentHash,
  createApprovalBinding,
  createCampaignDocument,
  createCampaignSection,
  messageIdForContentVersion,
  normalizeCampaignDocumentFromPreparation,
  sortCampaignSections,
} from "./CampaignDocument.js";
import {
  buildRecipientPreparations,
  previewCampaignForRecipient,
  renderCampaignDocumentBody,
  renderCampaignSubjectLine,
} from "./CampaignDocumentRenderer.js";
import { buildCampaignAudiencePreview } from "./CampaignAudienceProjection.js";
import { isSupportedCampaignSectionType } from "../../../industries/property-management/config/campaignSectionCatalog.js";

function asCampaign(work) {
  return work?.metadata?.campaignPreparation ?? null;
}

function isProtectedMessageStatus(status) {
  return ["queued", "sent", "delivered"].includes(String(status ?? ""));
}

function resolveBaseMessageId(campaign) {
  if (campaign?.baseMessageId) return String(campaign.baseMessageId);
  return String(campaign?.messageId ?? "").replace(/_v\d+$/, "");
}

function currentMessage(stack, campaign) {
  const messageId = String(campaign?.messageId ?? "");
  return messageId ? stack.communicationRuntime?.getMessage?.(messageId) : null;
}

function normalizeSectionsInput(sections) {
  return sortCampaignSections((Array.isArray(sections) ? sections : []).map((section, index) => createCampaignSection({
    id: String(section?.id ?? `sec_${index + 1}`),
    type: String(section?.type ?? "custom_text"),
    order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
    fields: section?.fields ?? {},
  })));
}

function updateWorkCampaignMetadata(stack, { workId, campaign, nowISO, status = null }) {
  const work = stack.workRuntime.getWorkItem(String(workId));
  const patch = {
    metadata: {
      ...(work.metadata ?? {}),
      campaignPreparation: campaign,
    },
  };
  if (status) patch.status = status;
  stack.workRuntime.applyEvent({
    id: `evt_${String(workId)}_campaign_studio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestampISO: String(nowISO),
    type: WORK_EVENT_TYPES.WORK_ITEM_UPDATED,
    source: "campaign_studio",
    payload: { workItemId: String(workId), patch },
  });
}

function ensureDraftMessage(stack, {
  messageId,
  threadId,
  channel,
  recipients,
  subject,
  body,
  relatedObjects,
  campaign,
  nowISO,
}) {
  if (stack.communicationRuntime.getMessage(messageId)) return;
  stack.communicationRuntime.applyEvent({
    id: `evt_${messageId}_drafted`,
    timestampISO: String(nowISO),
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "campaign_studio",
    payload: {
      message: {
        id: messageId,
        threadId,
        direction: "outbound",
        channel,
        status: "draft",
        sender: { id: "vibetech", type: "system" },
        recipients: recipients.map((recipient) => ({
          id: recipient.partyId,
          type: "party",
          metadata: { email: recipient.email, displayName: recipient.displayName },
        })),
        subject,
        body,
        createdAt: String(nowISO),
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        relatedObjects,
        metadata: { campaignPreparation: campaign },
      },
    },
  });
}

function audiencePreviewFromCampaign(campaign) {
  return {
    included: campaign.recipientPreparations ?? [],
    excluded: campaign.exclusions ?? [],
    excludedCount: campaign.excludedCount ?? 0,
    subject: campaign.subject ?? null,
  };
}

export class CampaignDocumentService {
  getCampaignWork(stack, workId) {
    const work = stack?.workRuntime?.getWorkItem?.(String(workId));
    if (!work) return { ok: false, reason: "work_not_found" };
    const campaign = asCampaign(work);
    if (!campaign) return { ok: false, reason: "not_campaign_work" };
    const document = normalizeCampaignDocumentFromPreparation(campaign);
    const message = currentMessage(stack, campaign);
    return {
      ok: true,
      work,
      campaign: {
        ...campaign,
        document,
        contentVersion: document.contentVersion,
        contentHash: document.contentHash,
        audienceFingerprint: document.audienceFingerprint ?? campaign.audienceFingerprint ?? null,
        communicationStatus: message?.status ?? campaign.communicationStatus ?? "draft",
      },
      document,
      message,
    };
  }

  preview({ stack, workId, partyId = null } = {}) {
    const loaded = this.getCampaignWork(stack, workId);
    if (!loaded.ok) return loaded;
    const { campaign, document } = loaded;
    const audiencePreview = audiencePreviewFromCampaign(campaign);
    if (partyId) {
      return {
        ok: true,
        preview: previewCampaignForRecipient({ document, audiencePreview, partyId }),
        document,
        contentVersion: document.contentVersion,
        contentHash: document.contentHash,
      };
    }
    return {
      ok: true,
      preview: {
        subjectLine: renderCampaignSubjectLine(document, { subject: campaign.subject }),
        previewText: document.previewText,
        body: renderCampaignDocumentBody(document, { subject: campaign.subject }),
        partyId: null,
        found: true,
        personalizationSummary: [],
        personalizationEvidence: null,
      },
      document,
      contentVersion: document.contentVersion,
      contentHash: document.contentHash,
    };
  }

  updateDocument({
    stack,
    workId,
    subjectLine = undefined,
    previewText = undefined,
    sections = undefined,
    nowISO = new Date().toISOString(),
  } = {}) {
    const loaded = this.getCampaignWork(stack, workId);
    if (!loaded.ok) return { ...loaded, snapshotKinds: [] };
    const { work, campaign, document, message } = loaded;

    const nextSections = sections === undefined ? document.sections : normalizeSectionsInput(sections);
    for (const section of nextSections) {
      if (!isSupportedCampaignSectionType(section.type)) {
        return { ok: false, reason: "unsupported_section_type", sectionType: section.type, snapshotKinds: [] };
      }
    }

    const nextSubjectLine = subjectLine === undefined ? document.subjectLine : String(subjectLine ?? "");
    const nextPreviewText = previewText === undefined
      ? document.previewText
      : (previewText == null ? null : String(previewText));
    const nextHash = computeContentHash({
      subjectLine: nextSubjectLine,
      previewText: nextPreviewText,
      channel: document.channel,
      sections: nextSections,
    });

    if (nextHash === document.contentHash) {
      return {
        ok: true,
        idempotent: true,
        workId: String(workId),
        messageId: String(campaign.messageId),
        contentVersion: document.contentVersion,
        contentHash: document.contentHash,
        snapshotKinds: [],
      };
    }

    const previousProtected = message && isProtectedMessageStatus(message.status);
    const wasApproved = String(work.status) === "approved"
      || campaign.approvalStatus === "approved"
      || Boolean(campaign.approvalBinding);

    const bumpedVersion = Number(document.contentVersion) + 1;
    const baseMessageId = resolveBaseMessageId(campaign);
    const nextMessageId = messageIdForContentVersion(baseMessageId, bumpedVersion);

    const nextDocument = createCampaignDocument({
      ...document,
      subjectLine: nextSubjectLine,
      previewText: nextPreviewText,
      sections: nextSections,
      contentVersion: bumpedVersion,
      contentHash: nextHash,
      status: "draft",
      audienceFingerprint: document.audienceFingerprint ?? campaign.audienceFingerprint,
      updatedAt: String(nowISO),
    });

    const recipients = buildRecipientPreparations({
      document: nextDocument,
      audiencePreview: audiencePreviewFromCampaign(campaign),
    });
    const sharedSubject = renderCampaignSubjectLine(nextDocument, { subject: campaign.subject });
    const sharedBody = renderCampaignDocumentBody(nextDocument, {
      recipient: recipients[0] ?? null,
      subject: campaign.subject,
    });

    const versionHistory = [...(Array.isArray(campaign.versionHistory) ? campaign.versionHistory : [])];
    if (previousProtected || wasApproved) {
      versionHistory.push({
        contentVersion: document.contentVersion,
        contentHash: document.contentHash,
        messageId: campaign.messageId,
        approvalBinding: campaign.approvalBinding ?? null,
        communicationStatus: message?.status ?? campaign.communicationStatus ?? null,
        supersededAt: String(nowISO),
      });
    }

    const nextCampaign = {
      ...campaign,
      document: nextDocument,
      contentVersion: nextDocument.contentVersion,
      contentHash: nextDocument.contentHash,
      audienceFingerprint: nextDocument.audienceFingerprint,
      subjectLine: nextDocument.subjectLine,
      previewText: nextDocument.previewText,
      recipientPreparations: recipients,
      recipientCount: recipients.length,
      status: "draft",
      communicationStatus: "draft",
      approvalStatus: "pending_review",
      approvalBinding: null,
      messageId: nextMessageId,
      baseMessageId,
      updatedAt: String(nowISO),
      versionHistory,
      cta: nextDocument.sections.find((section) => section.fields?.ctaText)?.fields?.ctaText ?? campaign.cta,
    };

    // Never mutate a protected (approved/queued) message — previous message stays as historical truth.
    ensureDraftMessage(stack, {
      messageId: nextMessageId,
      threadId: String(campaign.threadId),
      channel: nextDocument.channel,
      recipients,
      subject: sharedSubject,
      body: sharedBody || "Review campaign draft before sending.",
      relatedObjects: Array.isArray(work.relatedObjects) ? work.relatedObjects : [],
      campaign: nextCampaign,
      nowISO,
    });

    updateWorkCampaignMetadata(stack, {
      workId,
      campaign: nextCampaign,
      nowISO,
      status: "review_required",
    });

    return {
      ok: true,
      idempotent: false,
      workId: String(workId),
      messageId: nextMessageId,
      contentVersion: nextDocument.contentVersion,
      contentHash: nextDocument.contentHash,
      forkedFromApproved: Boolean(previousProtected || wasApproved),
      previousMessageId: previousProtected || wasApproved ? String(campaign.messageId) : null,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }

  refreshAudience({
    stack,
    workId,
    campaignTemplate = null,
    nowISO = new Date().toISOString(),
  } = {}) {
    const loaded = this.getCampaignWork(stack, workId);
    if (!loaded.ok) return { ...loaded, snapshotKinds: [] };
    const { work, campaign, document, message } = loaded;

    const resolvedAudience = campaignTemplate?.audience
      ?? (campaign.subject?.id ? { type: "subject_interest" } : { type: "all_marketable_contacts" });

    const audiencePreview = buildCampaignAudiencePreview({
      stack,
      audience: resolvedAudience,
      subjectId: campaign.subject?.id ?? null,
      channel: document.channel ?? "email",
    });
    const fingerprint = computeAudienceFingerprint({
      includedPartyIds: (audiencePreview.included ?? []).map((entry) => entry.partyId),
      excludedPartyIds: (audiencePreview.excluded ?? []).map((entry) => entry.partyId),
      subjectId: audiencePreview.subject?.id ?? campaign.subject?.id ?? null,
      audienceType: resolvedAudience?.type ?? null,
    });
    const fingerprintChanged = fingerprint !== String(campaign.audienceFingerprint ?? document.audienceFingerprint ?? "");
    const recipients = buildRecipientPreparations({ document, audiencePreview });

    if (!fingerprintChanged) {
      const nextCampaign = {
        ...campaign,
        document: createCampaignDocument({ ...document, audienceFingerprint: fingerprint }),
        audienceFingerprint: fingerprint,
        recipientPreparations: recipients,
        recipientCount: recipients.length,
        exclusions: audiencePreview.excluded ?? [],
        excludedCount: audiencePreview.excludedCount ?? 0,
        subject: audiencePreview.subject ?? campaign.subject ?? null,
        updatedAt: String(nowISO),
      };
      updateWorkCampaignMetadata(stack, { workId, campaign: nextCampaign, nowISO });
      return {
        ok: true,
        idempotent: true,
        fingerprintChanged: false,
        approvalInvalidated: false,
        audienceFingerprint: fingerprint,
        workId: String(workId),
        messageId: String(campaign.messageId),
        contentVersion: document.contentVersion,
        snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK],
      };
    }

    const previousProtected = message && isProtectedMessageStatus(message.status);
    const wasApproved = String(work.status) === "approved" || Boolean(campaign.approvalBinding);
    const bumpedVersion = Number(document.contentVersion) + 1;
    const baseMessageId = resolveBaseMessageId(campaign);
    const nextMessageId = messageIdForContentVersion(baseMessageId, bumpedVersion);
    const nextDocument = createCampaignDocument({
      ...document,
      contentVersion: bumpedVersion,
      audienceFingerprint: fingerprint,
      status: "draft",
      updatedAt: String(nowISO),
    });

    const versionHistory = [...(Array.isArray(campaign.versionHistory) ? campaign.versionHistory : [])];
    if (previousProtected || wasApproved) {
      versionHistory.push({
        contentVersion: document.contentVersion,
        contentHash: document.contentHash,
        messageId: campaign.messageId,
        approvalBinding: campaign.approvalBinding ?? null,
        communicationStatus: message?.status ?? campaign.communicationStatus ?? null,
        supersededAt: String(nowISO),
      });
    }

    const nextCampaign = {
      ...campaign,
      document: nextDocument,
      contentVersion: nextDocument.contentVersion,
      contentHash: nextDocument.contentHash,
      audienceFingerprint: fingerprint,
      recipientPreparations: recipients,
      recipientCount: recipients.length,
      exclusions: audiencePreview.excluded ?? [],
      excludedCount: audiencePreview.excludedCount ?? 0,
      subject: audiencePreview.subject ?? campaign.subject ?? null,
      evidenceSummary: audiencePreview.subject
        ? `Audience is based on canonical interest in ${String(audiencePreview.subject.displayName)}.`
        : campaign.evidenceSummary,
      status: "draft",
      communicationStatus: "draft",
      approvalStatus: "pending_review",
      approvalBinding: null,
      messageId: nextMessageId,
      baseMessageId,
      versionHistory,
      updatedAt: String(nowISO),
    };

    ensureDraftMessage(stack, {
      messageId: nextMessageId,
      threadId: String(campaign.threadId),
      channel: nextDocument.channel,
      recipients,
      subject: renderCampaignSubjectLine(nextDocument, { subject: nextCampaign.subject }),
      body: renderCampaignDocumentBody(nextDocument, {
        recipient: recipients[0] ?? null,
        subject: nextCampaign.subject,
      }) || "Review campaign draft before sending.",
      relatedObjects: Array.isArray(work.relatedObjects) ? work.relatedObjects : [],
      campaign: nextCampaign,
      nowISO,
    });

    updateWorkCampaignMetadata(stack, {
      workId,
      campaign: nextCampaign,
      nowISO,
      status: "review_required",
    });

    return {
      ok: true,
      idempotent: false,
      fingerprintChanged: true,
      approvalInvalidated: true,
      forkedFromApproved: Boolean(previousProtected || wasApproved),
      previousMessageId: previousProtected || wasApproved ? String(campaign.messageId) : null,
      audienceFingerprint: fingerprint,
      workId: String(workId),
      messageId: nextMessageId,
      contentVersion: bumpedVersion,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }
}

export function buildExpectedApprovalBinding(campaign, workId) {
  const document = normalizeCampaignDocumentFromPreparation(campaign);
  return createApprovalBinding({
    workId: String(workId),
    messageId: String(campaign.messageId),
    contentVersion: document.contentVersion,
    contentHash: document.contentHash,
    audienceFingerprint: document.audienceFingerprint ?? campaign.audienceFingerprint,
  });
}

export { approvalBindingsMatch, createApprovalBinding };
