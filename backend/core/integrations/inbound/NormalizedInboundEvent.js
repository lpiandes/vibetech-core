import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Provider-normalized inbound event — no vertical semantics.
 */
export function createNormalizedInboundEvent({
  externalEventId,
  providerId,
  workspaceId,
  channel,
  eventKind,
  occurredAt,
  identityHints = {},
  attribution = {},
  payloadFacts = {},
} = {}) {
  if (!externalEventId || !providerId || !eventKind) {
    throw new Error("NormalizedInboundEvent: externalEventId, providerId, eventKind required.");
  }
  return deepFreeze({
    externalEventId: String(externalEventId),
    providerId: String(providerId),
    workspaceId: workspaceId ? String(workspaceId) : null,
    channel: channel ? String(channel) : null,
    eventKind: String(eventKind),
    occurredAt: occurredAt ? String(occurredAt) : null,
    identityHints: deepFreeze(identityHints && typeof identityHints === "object" ? identityHints : {}),
    attribution: deepFreeze(attribution && typeof attribution === "object" ? attribution : {}),
    payloadFacts: deepFreeze(payloadFacts && typeof payloadFacts === "object" ? payloadFacts : {}),
  });
}
