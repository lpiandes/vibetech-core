import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { DISPATCH_RESULT_STATUS_LIST } from "./PlatformEventBusDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventDispatchResult: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} required plain object.`);
  return value;
}

export function createPlatformEventDispatchResult({
  subscriberId,
  subscriberName,
  status,
  message,
  metadata,
} = {}) {
  requireString(subscriberId, "subscriberId");
  requireString(subscriberName, "subscriberName");
  if (!DISPATCH_RESULT_STATUS_LIST.includes(String(status))) fail(`invalid status: ${String(status)}`);

  const view = {
    subscriberId: String(subscriberId),
    subscriberName: String(subscriberName),
    status: String(status),
    message: message === undefined ? "" : String(message),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

