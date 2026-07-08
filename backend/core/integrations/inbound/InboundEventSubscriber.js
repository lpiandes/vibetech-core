import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";

export function createInboundEventSubscriber({
  id = "sub_inbound_business",
  inboundOrchestrator,
} = {}) {
  if (!inboundOrchestrator) throw new Error("createInboundEventSubscriber requires inboundOrchestrator.");

  return createPlatformEventSubscriberFromHandler({
    id: String(id),
    name: "InboundBusinessOrchestrationSubscriber",
    operatingSystem: "inbound_orchestration",
    supportedEvents: ["INBOUND_EVENT_RECEIVED"],
    handler: (event) => {
      const result = inboundOrchestrator.handlePlatformEvent(event);
      return {
        status: result.handled ? "SUCCESS" : "SKIPPED",
        message: "",
        actions: [],
        errors: [],
        metadata: { derivedFrom: result },
      };
    },
  });
}
