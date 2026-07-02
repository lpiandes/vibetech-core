import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { requirePlatformEventType } from "../PlatformEventType.js";

function fail(message) {
  throw new Error(`PlatformEventSubscription: ${message}`);
}

export function createPlatformEventSubscription({ eventType, subscriber } = {}) {
  const et = requirePlatformEventType(eventType);
  if (!subscriber || typeof subscriber !== "object") fail("subscriber required.");
  if (!subscriber.id || typeof subscriber.id !== "string") fail("subscriber.id required string.");

  return deepFreeze({
    eventType: et,
    subscriber,
  });
}

