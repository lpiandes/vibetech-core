import { SUPPORTED_INTEGRATION_PLATFORM_EVENT_TYPES } from "../../integrations/events/IntegrationPlatformEventDefaults.js";

export const INTEGRATION_ANALYTICS_EVENTS = SUPPORTED_INTEGRATION_PLATFORM_EVENT_TYPES;

/**
 * Wire integration lifecycle platform events to the analytics subscriber.
 */
export function wireIntegrationLifecycleAnalytics({ bus, analyticsSubscriber } = {}) {
  if (!bus?.subscribe) throw new Error("wireIntegrationLifecycleAnalytics: bus required.");
  if (!analyticsSubscriber) throw new Error("wireIntegrationLifecycleAnalytics: analyticsSubscriber required.");

  for (const eventType of INTEGRATION_ANALYTICS_EVENTS) {
    bus.subscribe({ eventType, subscriber: analyticsSubscriber });
  }
}
