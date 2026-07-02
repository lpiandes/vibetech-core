import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createPlatformEventSubscriberResult } from "./PlatformEventSubscriberResult.js";
import { DEFAULT_SUBSCRIBER_PRIORITY, DEFAULT_SUBSCRIBER_ENABLED } from "./PlatformEventSubscriberDefaults.js";

import { validateSubscriberShape, validateSubscriberCompatibilityWithBus } from "./PlatformEventSubscriberValidator.js";

function fail(message) {
  throw new Error(`PlatformEventSubscriberFactory: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function createPlatformEventSubscriberFromHandler({
  id,
  name,
  operatingSystem,
  supportedEvents,
  priority,
  enabled,
  handler,
  handlerMetadata,
} = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requireString(operatingSystem, "operatingSystem");
  if (!Array.isArray(supportedEvents)) fail("supportedEvents must be array.");
  if (typeof handler !== "function") fail("handler must be function.");

  const subscriberEnabled = typeof enabled === "boolean" ? enabled : DEFAULT_SUBSCRIBER_ENABLED;
  const subscriberPriority = priority === undefined ? DEFAULT_SUBSCRIBER_PRIORITY : priority;

  // The bus calls handle(event) with a single argument.
  // We allow handler(event, context) via a wrapper; context is optional.
  const wrappedHandle = (event, context) => {
    // Disabled subscribers must be deterministic and must not execute business logic.
    if (!subscriberEnabled) {
      return createPlatformEventSubscriberResult({
        subscriberId: id,
        subscriberName: name,
        eventId: String(event?.eventId ?? ""),
        eventType: String(event?.eventType ?? ""),
        status: "DISABLED",
        message: "",
        actions: [],
        errors: [],
        metadata: deepFreeze({
          derivedFrom: { disabled: true },
          ...(handlerMetadata && typeof handlerMetadata === "object" ? handlerMetadata : {}),
        }),
      });
    }

    const result = handler(event, context);

    // Bus contract compatibility: "no result" from handler is treated as SKIPPED.
    // This keeps dispatch outcomes deterministic without throwing inside subscribers.
    if (!result) {
      return createPlatformEventSubscriberResult({
        subscriberId: id,
        subscriberName: name,
        eventId: String(event?.eventId ?? ""),
        eventType: String(event?.eventType ?? ""),
        status: "SKIPPED",
        message: "",
        actions: [],
        errors: [],
        metadata: {},
      });
    }

    const status = String(result?.status ?? "SKIPPED");
    const message = result?.message === undefined ? "" : result?.message;
    const actions = Array.isArray(result?.actions) ? result.actions : [];
    const errors = Array.isArray(result?.errors) ? result.errors : [];
    const metadata = result?.metadata && typeof result.metadata === "object" ? result.metadata : {};

    return createPlatformEventSubscriberResult({
      subscriberId: id,
      subscriberName: name,
      eventId: String(event?.eventId ?? ""),
      eventType: String(event?.eventType ?? ""),
      status,
      message,
      actions,
      errors,
      metadata,
    });
  };

  const subscriber = deepFreeze({
    id: String(id),
    name: String(name),
    operatingSystem: String(operatingSystem),
    supportedEvents: safeArray(supportedEvents).map((x) => String(x)),
    priority: Number(subscriberPriority),
    enabled: Boolean(subscriberEnabled),
    handle: wrappedHandle,
  });

  validateSubscriberCompatibilityWithBus(subscriber);
  validateSubscriberShape(subscriber);
  return subscriber;
}

