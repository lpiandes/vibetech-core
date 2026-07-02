import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { SUBSCRIBER_RESULT_STATUS_LIST } from "./PlatformEventSubscriberDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventSubscriberResult: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

export function createPlatformEventSubscriberResult({
  subscriberId,
  subscriberName,
  eventId,
  eventType,
  status,
  message,
  actions,
  errors,
  metadata,
} = {}) {
  requireString(subscriberId, "subscriberId");
  requireString(subscriberName, "subscriberName");
  requireString(eventId, "eventId");
  requireString(eventType, "eventType");
  const st = String(status ?? "");
  if (!SUBSCRIBER_RESULT_STATUS_LIST.includes(st)) fail(`invalid status: ${st}`);

  const view = {
    subscriberId: String(subscriberId),
    subscriberName: String(subscriberName),
    eventId: String(eventId),
    eventType: String(eventType),
    status: st,
    message: message === undefined ? "" : String(message),
    actions: Array.isArray(actions) ? deepFreeze(actions.map((x) => x)) : deepFreeze([]),
    errors: Array.isArray(errors) ? deepFreeze(errors.map((x) => String(x))) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

