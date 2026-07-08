import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { defaultWorkspaceDeliveryDedup } from "./WorkspaceDeliveryDedup.js";

/**
 * Universal webhook ingress boundary.
 * Provider owns signature validation; Core owns orchestration.
 */
export class WebhookIngressService {
  constructor({
    providerRegistry,
    platformEventPublisher,
    workspaceId = "default",
    deliveryDedup = defaultWorkspaceDeliveryDedup,
    nowISO = "2026-07-01T00:00:00.000Z",
  } = {}) {
    this.providerRegistry = providerRegistry;
    this.platformEventPublisher = platformEventPublisher ?? null;
    this.workspaceId = String(workspaceId);
    this.deliveryDedup = deliveryDedup;
    this.nowISO = String(nowISO);
  }

  ingest({ providerId, payload, headers } = {}) {
    const provider = this.providerRegistry.getProvider(providerId);
    if (!provider) {
      return deepFreeze({ accepted: false, reason: "unknown_provider" });
    }

    const validation = provider.validateWebhook?.({ payload, headers }) ?? { valid: false, reason: "unsupported" };
    if (!validation.valid) {
      this.#publishRejected(providerId, payload, validation.reason);
      return deepFreeze({ accepted: false, reason: validation.reason ?? "invalid_webhook" });
    }

    const normalized = provider.normalizeInboundEvent?.({ payload, headers });
    if (!normalized?.externalEventId) {
      return deepFreeze({ accepted: false, reason: "normalization_failed" });
    }

    const deliveryKey = `${providerId}:${normalized.externalEventId}`;
    if (this.deliveryDedup.has(this.workspaceId, deliveryKey)) {
      return deepFreeze({ accepted: true, duplicate: true, externalEventId: normalized.externalEventId });
    }
    this.deliveryDedup.add(this.workspaceId, deliveryKey);

    this.#publishInbound(providerId, normalized);
    return deepFreeze({
      accepted: true,
      duplicate: false,
      externalEventId: normalized.externalEventId,
      eventType: normalized.eventType,
    });
  }

  #publishInbound(providerId, normalized) {
    if (!this.platformEventPublisher?.publish) return;
    this.platformEventPublisher.publish({
      eventType: "INBOUND_EVENT_RECEIVED",
      payload: deepFreeze({
        provider: providerId,
        externalEventId: normalized.externalEventId,
        eventType: normalized.eventType,
        occurredAt: normalized.occurredAt,
        channel: normalized.channel,
        normalizedFacts: normalized.normalizedFacts ?? {},
      }),
      occurredAt: this.nowISO,
    });
  }

  #publishRejected(providerId, payload, reason) {
    if (!this.platformEventPublisher?.publish) return;
    this.platformEventPublisher.publish({
      eventType: "INBOUND_EVENT_REJECTED",
      payload: deepFreeze({
        provider: providerId,
        reason: String(reason ?? ""),
        externalEventId: String(payload?.id ?? payload?.eventId ?? ""),
      }),
      occurredAt: this.nowISO,
    });
  }
}
