import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";
import { CommunicationExecutionService } from "../communications/providers/CommunicationExecutionService.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { approvalBindingsMatch, normalizeCampaignDocumentFromPreparation } from "./CampaignDocument.js";
import { buildExpectedApprovalBinding } from "./CampaignDocumentService.js";
import { DeterministicCampaignEmailProvider } from "./DeterministicCampaignEmailProvider.js";

function safeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function deliveryMessageId({ workId, partyId, contentVersion }) {
  return `cm_campaign_delivery_${safeId(workId)}_${safeId(partyId)}_v${Number(contentVersion) || 1}`;
}

function findEmailConnection(connectionRuntime) {
  return (connectionRuntime?.getConnections?.() ?? []).find((c) => String(c.connectionType) === "business_email") ?? null;
}

function resolveEmailProvider({ integrationPlatform, emailProvider, nowISO }) {
  if (emailProvider) return { provider: emailProvider, reason: null };
  const connection = findEmailConnection(integrationPlatform?.connectionRuntime);
  if (!connection || ![CONNECTION_STATUSES.CONNECTED, CONNECTION_STATUSES.DEGRADED].includes(connection.status)) {
    return { provider: null, reason: "needs_setup_business_email", connection };
  }
  const registry = integrationPlatform?.providerRegistry;
  const integrationProvider = registry?.getProvider?.(connection.providerType)
    ?? registry?.getProvider?.(connection.providerId)
    ?? null;
  if (integrationProvider?.communicationProvider) {
    return { provider: integrationProvider.communicationProvider, reason: null, connection };
  }
  // Mock email is for tests/dev only — never pretend campaigns sent in production.
  const isMock = String(connection.providerType ?? connection.providerId ?? "").includes("mock")
    || String(integrationProvider?.id ?? "").includes("mock");
  if (isMock) {
    if (process.env.NODE_ENV === "production") {
      return { provider: null, reason: "mock_email_forbidden_in_production", connection };
    }
    return {
      provider: new DeterministicCampaignEmailProvider({ nowISO, id: "campaign_mock_email" }),
      reason: null,
      connection,
    };
  }
  return { provider: null, reason: "needs_setup_business_email", connection };
}

function updateCampaignMetadata(stack, { workId, campaign, nowISO }) {
  const work = stack.workRuntime.getWorkItem(String(workId));
  stack.workRuntime.applyEvent({
    id: `evt_${String(workId)}_delivery_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestampISO: String(nowISO),
    type: WORK_EVENT_TYPES.WORK_ITEM_UPDATED,
    source: "campaign_delivery",
    payload: {
      workItemId: String(workId),
      patch: {
        metadata: {
          ...(work.metadata ?? {}),
          campaignPreparation: campaign,
        },
      },
    },
  });
}

function summarizeDelivery(records = []) {
  const list = Array.isArray(records) ? records : [];
  const counts = {
    total: list.length,
    pending: 0,
    excluded: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
  };
  for (const record of list) {
    const status = String(record.status ?? "pending");
    if (counts[status] != null) counts[status] += 1;
    else counts.pending += 1;
  }
  let campaignDeliveryStatus = "ready_to_send";
  if (!list.length) campaignDeliveryStatus = "no_recipients";
  else if (counts.sent === list.length) campaignDeliveryStatus = "sent";
  else if (counts.sent > 0 && (counts.failed > 0 || counts.excluded > 0)) campaignDeliveryStatus = "completed_with_failures";
  else if (counts.sent > 0) campaignDeliveryStatus = "partially_sent";
  else if (counts.failed === list.length) campaignDeliveryStatus = "failed";
  else if (counts.excluded === list.length) campaignDeliveryStatus = "all_excluded";
  return { counts, campaignDeliveryStatus };
}

export class CampaignDeliveryService {
  constructor({ executionService = new CommunicationExecutionService() } = {}) {
    this.executionService = executionService;
  }

  previewSend({ stack, workId, integrationPlatform = null, emailProvider = null, nowISO = new Date().toISOString() } = {}) {
    const work = stack?.workRuntime?.getWorkItem?.(String(workId));
    if (!work) return { ok: false, reason: "work_not_found" };
    const campaign = work.metadata?.campaignPreparation;
    if (!campaign) return { ok: false, reason: "not_campaign_work" };
    if (String(work.status) !== "approved" && campaign.approvalStatus !== "approved") {
      return { ok: false, reason: "not_approved" };
    }
    const expected = buildExpectedApprovalBinding(campaign, workId);
    if (!campaign.approvalBinding || !approvalBindingsMatch(expected, campaign.approvalBinding)) {
      return { ok: false, reason: "stale_approval_binding", expected };
    }
    const providerResolution = resolveEmailProvider({ integrationPlatform, emailProvider, nowISO });
    const recipients = Array.isArray(campaign.recipientPreparations) ? campaign.recipientPreparations : [];
    const exclusions = [];
    const eligible = [];
    for (const recipient of recipients) {
      const preference = checkCommunicationPermitted({
        preferenceRuntime: stack.communicationPreferenceRuntime,
        partyId: recipient.partyId,
        channel: "email",
        scope: "marketing",
      });
      if (!preference.permitted) {
        exclusions.push({
          partyId: recipient.partyId,
          displayName: recipient.displayName,
          reason: preference.reason ?? "communication_not_permitted",
        });
      } else {
        eligible.push(recipient);
      }
    }
    return {
      ok: true,
      workId: String(workId),
      contentVersion: campaign.contentVersion,
      contentHash: campaign.contentHash,
      audienceFingerprint: campaign.audienceFingerprint,
      recipientCount: eligible.length,
      excludedCount: exclusions.length,
      exclusions,
      providerReady: Boolean(providerResolution.provider),
      providerStatus: providerResolution.provider ? "ready" : "needs_setup",
      providerReason: providerResolution.reason,
      deliveryReadiness: providerResolution.provider ? "ready_to_send" : "provider_required_for_sending",
    };
  }

  async executeSend({
    stack,
    workId,
    binding = null,
    integrationPlatform = null,
    emailProvider = null,
    actorId = null,
    nowISO = new Date().toISOString(),
  } = {}) {
    const preview = this.previewSend({ stack, workId, integrationPlatform, emailProvider, nowISO });
    if (!preview.ok) return { ...preview, snapshotKinds: [] };
    if (!preview.providerReady) {
      return {
        ok: false,
        reason: "needs_setup_business_email",
        deliveryReadiness: "provider_required_for_sending",
        snapshotKinds: [],
      };
    }

    const work = stack.workRuntime.getWorkItem(String(workId));
    const campaign = work.metadata.campaignPreparation;
    const expected = buildExpectedApprovalBinding(campaign, workId);
    if (binding && !approvalBindingsMatch(expected, binding)) {
      return { ok: false, reason: "stale_approval_binding", expected, snapshotKinds: [] };
    }

    const providerResolution = resolveEmailProvider({ integrationPlatform, emailProvider, nowISO });
    const document = normalizeCampaignDocumentFromPreparation(campaign);
    const existingRecords = Array.isArray(campaign.deliveryRecords) ? [...campaign.deliveryRecords] : [];
    const recordsByParty = new Map(existingRecords.map((record) => [String(record.partyId), record]));
    const relatedObjects = [
      createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(workId) }),
    ];

    for (const exclusion of preview.exclusions) {
      const prior = recordsByParty.get(String(exclusion.partyId));
      if (prior?.status === "sent") continue;
      recordsByParty.set(String(exclusion.partyId), {
        workId: String(workId),
        contentVersion: document.contentVersion,
        partyId: String(exclusion.partyId),
        displayName: exclusion.displayName ?? null,
        messageId: null,
        channel: "email",
        provider: null,
        status: "excluded",
        exclusionReason: exclusion.reason,
        attempt: Number(prior?.attempt ?? 0),
        providerMessageId: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        updatedAt: String(nowISO),
      });
    }

    for (const recipient of campaign.recipientPreparations ?? []) {
      const partyId = String(recipient.partyId);
      if (preview.exclusions.some((entry) => String(entry.partyId) === partyId)) continue;

      const prior = recordsByParty.get(partyId);
      if (prior?.status === "sent") {
        continue; // idempotent: do not resend successful deliveries
      }

      const messageId = deliveryMessageId({
        workId,
        partyId,
        contentVersion: document.contentVersion,
      });

      let message = stack.communicationRuntime.getMessage(messageId);
      if (!message) {
        const threadId = String(campaign.threadId);
        stack.communicationRuntime.applyEvent({
          id: `evt_${messageId}_drafted`,
          timestampISO: String(nowISO),
          type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
          source: "campaign_delivery",
          payload: {
            message: {
              id: messageId,
              threadId,
              direction: "outbound",
              channel: "email",
              status: "draft",
              sender: {
                id: "vibetech",
                type: "system",
                metadata: {
                  email: providerResolution.connection?.credentialReference?.metadata?.senderEmail
                    || providerResolution.provider?.senderEmail
                    || null,
                },
              },
              recipients: [{
                id: partyId,
                type: "party",
                metadata: { email: recipient.email, displayName: recipient.displayName },
              }],
              subject: String(recipient.subject ?? document.subjectLine),
              body: String(recipient.body ?? ""),
              createdAt: String(nowISO),
              sentAt: null,
              deliveredAt: null,
              failedAt: null,
              relatedObjects,
              metadata: {
                campaignDelivery: {
                  workId: String(workId),
                  partyId,
                  contentVersion: document.contentVersion,
                  contentHash: document.contentHash,
                },
              },
            },
          },
        });
        stack.communicationRuntime.applyEvent({
          id: `evt_${messageId}_queued`,
          timestampISO: String(nowISO),
          type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
          source: "campaign_delivery",
          payload: { messageId },
        });
        message = stack.communicationRuntime.getMessage(messageId);
      } else if (String(message.status) === "draft") {
        stack.communicationRuntime.applyEvent({
          id: `evt_${messageId}_queued_retry`,
          timestampISO: String(nowISO),
          type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
          source: "campaign_delivery",
          payload: { messageId },
        });
      }

      recordsByParty.set(partyId, {
        workId: String(workId),
        contentVersion: document.contentVersion,
        partyId,
        displayName: recipient.displayName ?? null,
        email: recipient.email ?? null,
        messageId,
        channel: "email",
        provider: providerResolution.provider.id,
        status: "sending",
        exclusionReason: null,
        attempt: Number(prior?.attempt ?? 0) + 1,
        providerMessageId: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        updatedAt: String(nowISO),
      });

      try {
        const result = await this.executionService.execute({
          communicationRuntime: stack.communicationRuntime,
          provider: providerResolution.provider,
          messageId,
          nowISO,
        });
        if (result.status === "success") {
          recordsByParty.set(partyId, {
            ...recordsByParty.get(partyId),
            status: "sent",
            providerMessageId: result.providerMessageId ?? null,
            sentAt: result.sentAt ?? String(nowISO),
            failedAt: null,
            failureReason: null,
            updatedAt: String(nowISO),
          });
        } else {
          recordsByParty.set(partyId, {
            ...recordsByParty.get(partyId),
            status: "failed",
            providerMessageId: result.providerMessageId ?? null,
            failedAt: String(nowISO),
            failureReason: result.providerMetadata?.error ?? "send_failed",
            updatedAt: String(nowISO),
          });
        }
      } catch (err) {
        recordsByParty.set(partyId, {
          ...recordsByParty.get(partyId),
          status: "failed",
          failedAt: String(nowISO),
          failureReason: String(err?.message ?? err),
          updatedAt: String(nowISO),
        });
      }
    }

    const deliveryRecords = [...recordsByParty.values()].sort((a, b) => String(a.partyId).localeCompare(String(b.partyId)));
    const summary = summarizeDelivery(deliveryRecords);
    const nextCampaign = {
      ...campaign,
      deliveryRecords: deepFreeze(deliveryRecords),
      deliverySummary: deepFreeze(summary),
      deliveryReadiness: summary.campaignDeliveryStatus,
      communicationStatus: summary.counts.sent > 0 ? "sent" : campaign.communicationStatus,
      lastSendAt: String(nowISO),
      lastSendBy: actorId ? String(actorId) : null,
    };
    updateCampaignMetadata(stack, { workId, campaign: nextCampaign, nowISO });

    return {
      ok: true,
      workId: String(workId),
      deliveryRecords,
      deliverySummary: summary,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    };
  }
}

export { summarizeDelivery, deliveryMessageId };
