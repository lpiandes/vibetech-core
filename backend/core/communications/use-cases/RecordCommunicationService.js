import { COMMUNICATION_EVENT_TYPES } from "../CommunicationEventTypes.js";
import {
  buildCommunicationThreadForSeed,
  buildCommunicationMessageForSeed,
} from "../CommunicationBuilder.js";
import { createEntityRef, ENTITY_TYPES } from "../../references/EntityRef.js";

/**
 * Explicit communication use-case orchestration for CommunicationRuntime.
 *
 * CommunicationRuntime state emerges only from runtime events applied here (not from scenario-level sprinkling).
 */
export class RecordCommunicationService {
  execute({
    communicationRuntime,
    nowISO,
    threadId,
    subject,
    channel,
    participants,
    partyId = null,
    requestId = null,
    interactionId = null,
    relatedWorkItemIds = [],
    messages = [],
  } = {}) {
    if (!communicationRuntime) throw new Error("RecordCommunicationService requires communicationRuntime.");
    const effectiveNowISO = String(nowISO ?? communicationRuntime.nowISO ?? "2026-07-01T00:00:00.000Z");

    const workRelatedObjects = relatedWorkItemIds.map((wid) =>
      createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(wid) }),
    );
    const partyRelatedObjects = partyId
      ? [createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: String(partyId) })]
      : [];
    const requestRelatedObjects = requestId
      ? [createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: String(requestId) })]
      : [];
    const interactionRelatedObjects = interactionId
      ? [createEntityRef({ entityType: ENTITY_TYPES.INTERACTION, entityId: String(interactionId) })]
      : [];
    const allRelatedObjects = [...workRelatedObjects, ...partyRelatedObjects, ...requestRelatedObjects, ...interactionRelatedObjects];

    // 1) Thread created
    const thread = buildCommunicationThreadForSeed({
      nowISO: effectiveNowISO,
      overrides: {
        id: threadId,
        subject: subject ?? "Connected thread",
        channel: channel ?? "internal",
        status: "draft",
        participants: Array.isArray(participants) ? participants : [],
        messageIds: [],
        relatedObjects: allRelatedObjects,
        createdAt: effectiveNowISO,
        updatedAt: effectiveNowISO,
        metadata: {},
      },
    });

    communicationRuntime.applyEvent({
      id: `evt_${threadId}_created`,
      timestampISO: effectiveNowISO,
      type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
      source: "record_communication_service",
      payload: { thread },
    });

    // 2) Messages (drafted + status transitions)
    for (const m of messages) {
      const messageId = String(m.id);
      const threadMsg = buildCommunicationMessageForSeed({
        nowISO: String(m.nowISO ?? effectiveNowISO),
        threadId,
        overrides: {
          id: messageId,
          direction: m.direction,
          channel: m.channel,
          status: "draft",
          subject: m.subject ?? "",
          body: m.body ?? "",
          sender: m.sender ?? null,
          recipients: m.recipients ?? [],
          createdAt: String(m.createdAtISO ?? m.nowISO ?? effectiveNowISO),
          sentAt: null,
          deliveredAt: null,
          failedAt: null,
          relatedObjects: Array.isArray(m.relatedObjects) ? m.relatedObjects : allRelatedObjects,
          metadata: m.metadata ?? {},
        },
      });

      communicationRuntime.applyEvent({
        id: `evt_${messageId}_drafted`,
        timestampISO: String(m.draftedAtISO ?? m.nowISO ?? effectiveNowISO),
        type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
        source: "record_communication_service",
        payload: { message: threadMsg },
      });

      if (m.queuedAtISO) {
        communicationRuntime.applyEvent({
          id: `evt_${messageId}_queued`,
          timestampISO: String(m.queuedAtISO),
          type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
          source: "record_communication_service",
          payload: { messageId },
        });
      }

      if (m.failedAtISO) {
        communicationRuntime.applyEvent({
          id: `evt_${messageId}_failed`,
          timestampISO: String(m.failedAtISO),
          type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED,
          source: "record_communication_service",
          payload: { messageId },
        });
      }

      if (m.receivedAtISO) {
        communicationRuntime.applyEvent({
          id: `evt_${messageId}_received`,
          timestampISO: String(m.receivedAtISO),
          type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_RECEIVED,
          source: "record_communication_service",
          payload: { messageId },
        });
      }
    }

    return {
      threadId,
      thread,
      messageIds: messages.map((x) => String(x.id)),
    };
  }
}
