import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CommunicationMessageView: ${message}`);
}

export function createCommunicationMessageView({
  id,
  threadId,
  direction,
  channel,
  status,
  sender,
  recipients,
  subject,
  bodyPreview,
  createdAt,
  sentAt,
  deliveredAt,
  failedAt,
  relatedObjects,
  attentionRequired,
  badges,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!threadId || typeof threadId !== "string") fail("threadId required.");
  if (!direction || typeof direction !== "string") fail("direction required.");
  if (!channel || typeof channel !== "string") fail("channel required.");
  if (!status || typeof status !== "string") fail("status required.");
  if (!sender || typeof sender !== "object") fail("sender required object.");
  if (!Array.isArray(recipients)) fail("recipients required array.");
  if (!subject || typeof subject !== "string") fail("subject required string.");
  if (!bodyPreview || typeof bodyPreview !== "string") fail("bodyPreview required string.");
  if (!createdAt || typeof createdAt !== "string") fail("createdAt required string.");

  const view = {
    id,
    threadId,
    direction: String(direction),
    channel: String(channel),
    status: String(status),
    sender: deepFreeze(sender),
    recipients: deepFreeze(recipients),
    subject,
    bodyPreview,
    createdAt: String(createdAt),
    sentAt: sentAt ? String(sentAt) : null,
    deliveredAt: deliveredAt ? String(deliveredAt) : null,
    failedAt: failedAt ? String(failedAt) : null,
    relatedObjects: deepFreeze(Array.isArray(relatedObjects) ? relatedObjects : []),
    attentionRequired: Boolean(attentionRequired),
    badges: deepFreeze((Array.isArray(badges) ? badges : []).map(String)),
    actions: deepFreeze(Array.isArray(actions) ? actions : []),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

