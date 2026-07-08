import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { ENTITY_TYPES } from "../../references/EntityRef.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function findEntityId(relatedObjects, entityType) {
  for (const ref of safeArray(relatedObjects)) {
    if (String(ref?.entityType) === String(entityType)) {
      return String(ref.entityId);
    }
  }
  return null;
}

function mergeRelatedObjects(...lists) {
  const ids = new Set();
  const merged = [];
  for (const list of lists) {
    for (const ref of safeArray(list)) {
      const key = `${ref?.entityType}:${ref?.entityId}`;
      if (!ref?.entityType || !ref?.entityId || ids.has(key)) continue;
      ids.add(key);
      merged.push(ref);
    }
  }
  return merged;
}

function resolvePartyEmail(party) {
  const methods = safeArray(party?.contactMethods);
  const email = methods.find((m) => String(m).includes("@"));
  return email ? String(email) : null;
}

function messageTimestamp(msg) {
  return (
    msg?.sentAt ??
    msg?.deliveredAt ??
    msg?.queuedAt ??
    msg?.createdAt ??
    null
  );
}

function mapMessage(msg) {
  return deepFreeze({
    id: String(msg.id),
    threadId: String(msg.threadId),
    direction: String(msg.direction),
    channel: String(msg.channel),
    status: String(msg.status),
    subject: String(msg.subject ?? ""),
    body: String(msg.body ?? ""),
    createdAt: msg.createdAt ? String(msg.createdAt) : null,
    sentAt: msg.sentAt ? String(msg.sentAt) : null,
    deliveredAt: msg.deliveredAt ? String(msg.deliveredAt) : null,
    failedAt: msg.failedAt ? String(msg.failedAt) : null,
    timestamp: messageTimestamp(msg) ? String(messageTimestamp(msg)) : null,
  });
}

/**
 * Industry-agnostic thread detail from communication + linked entity runtimes.
 */
export function buildCommunicationThreadDetail({
  threadId,
  communicationRuntime,
  requestRuntime,
  businessGraphRuntime,
  businessSubjectRuntime,
  interactionRuntime,
} = {}) {
  const tid = String(threadId ?? "");
  if (!tid || !communicationRuntime) return null;

  const thread = communicationRuntime.getThread?.(tid) ?? null;
  if (!thread) return null;

  const messages = safeArray(communicationRuntime.getMessages?.()).filter(
    (m) => String(m.threadId) === tid,
  );

  const related = mergeRelatedObjects(
    thread.relatedObjects,
    ...messages.map((m) => m.relatedObjects),
  );

  const partyId = findEntityId(related, ENTITY_TYPES.PARTY);
  const requestId = findEntityId(related, ENTITY_TYPES.REQUEST);
  const interactionId = findEntityId(related, ENTITY_TYPES.INTERACTION);
  const relatedSubjectId = findEntityId(related, ENTITY_TYPES.SUBJECT);

  const party = partyId ? businessGraphRuntime?.getParty?.(partyId) ?? null : null;
  const request = requestId ? requestRuntime?.getRequest?.(requestId) ?? null : null;
  const interaction = interactionId ? interactionRuntime?.getInteraction?.(interactionId) ?? null : null;

  const subjectId =
    request?.subjectRefs?.[0]?.entityId ?? relatedSubjectId ?? null;
  const subject = subjectId ? businessSubjectRuntime?.getSubject?.(String(subjectId)) ?? null : null;

  const interactionNote =
    safeArray(interaction?.notes)
      .map((n) => String(n?.text ?? ""))
      .find((text) => text.length > 0) ?? null;

  const inquiryText = request?.description ? String(request.description) : interactionNote;

  const latestMessageAt = messages
    .map((m) => messageTimestamp(m))
    .filter(Boolean)
    .sort()
    .at(-1) ?? thread.updatedAt ?? thread.createdAt ?? null;

  return deepFreeze({
    thread: deepFreeze({
      id: tid,
      subject: safeString(thread.subject),
      channel: safeString(thread.channel),
      status: safeString(thread.status),
      createdAt: thread.createdAt ? String(thread.createdAt) : null,
      updatedAt: thread.updatedAt ? String(thread.updatedAt) : null,
      latestMessageAt: latestMessageAt ? String(latestMessageAt) : null,
    }),
    messages: deepFreeze(messages.map(mapMessage)),
    contact: deepFreeze({
      partyId: partyId ?? null,
      displayName: party?.displayName ? String(party.displayName) : null,
      email: resolvePartyEmail(party),
    }),
    inquiry: deepFreeze({
      requestId: requestId ?? null,
      requestType: request?.requestType ? String(request.requestType) : null,
      text: inquiryText,
      receivedAt: request?.receivedAt ? String(request.receivedAt) : interaction?.occurredAt ? String(interaction.occurredAt) : null,
    }),
    subject: subject
      ? deepFreeze({
          id: String(subject.id),
          subjectType: String(subject.subjectType),
          displayName: String(subject.displayName),
          status: String(subject.status),
          address: subject.keyAttributes?.address ? String(subject.keyAttributes.address) : null,
        })
      : null,
    interaction: interaction
      ? deepFreeze({
          id: String(interaction.id),
          summary: interaction.summary ? String(interaction.summary) : null,
          occurredAt: interaction.occurredAt ? String(interaction.occurredAt) : null,
          noteText: interactionNote,
        })
      : null,
  });
}
