import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { ATTENTION_CATEGORIES } from "./CommunicationViewDefaults.js";

function fail(message) {
  throw new Error(`CommunicationThreadView: ${message}`);
}

export function createCommunicationThreadView({
  id,
  subject,
  channel,
  status,
  participants,
  messageCount,
  latestMessageAt,
  relatedObjects,
  attentionRequired,
  badges,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!subject || typeof subject !== "string") fail("subject required.");
  if (!channel || typeof channel !== "string") fail("channel required.");
  if (!status || typeof status !== "string") fail("status required.");
  if (!Array.isArray(participants)) fail("participants required array.");
  if (typeof messageCount !== "number") fail("messageCount required number.");
  if (latestMessageAt !== null && latestMessageAt !== undefined && typeof latestMessageAt !== "string") fail("latestMessageAt must be string or null.");
  if (!Array.isArray(relatedObjects)) fail("relatedObjects required array.");
  if (typeof attentionRequired !== "boolean") fail("attentionRequired must be boolean.");
  if (!Array.isArray(badges)) fail("badges required array.");
  if (!Array.isArray(actions)) fail("actions required array.");

  const view = {
    id,
    subject,
    channel,
    status,
    participants: deepFreeze(participants),
    messageCount: Number(messageCount),
    latestMessageAt: latestMessageAt ? String(latestMessageAt) : null,
    relatedObjects: deepFreeze(relatedObjects),
    attentionRequired,
    badges: deepFreeze(badges.map(String)),
    actions: deepFreeze(actions),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

