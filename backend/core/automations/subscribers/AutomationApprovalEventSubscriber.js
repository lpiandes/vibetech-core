import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";

import { SUBSCRIBER_RESULT_STATUSES } from "../../events/subscribers/PlatformEventSubscriberDefaults.js";

import { AutomationOrchestrationService } from "../AutomationOrchestrationService.js";

function fail(message) {
  throw new Error(`AutomationApprovalEventSubscriber: ${message}`);
}

export function createAutomationApprovalEventSubscriber({
  id = "sub_automation_approval_event",
  name = "AutomationApprovalEventSubscriber",
  operatingSystem = "automation_approval_event_subscribers",
  automationRuntime,
  automationRuleEngine,
  actionExecutorRegistry,
  interactionRuntime,
  workRuntime,
  automationPlatformEventPublisher,
  approvalRuntime,
  approvalPlatformEventPublisher,
  priority = 0,
  enabled = true,
} = {}) {
  if (!automationRuntime) fail("automationRuntime required.");
  if (!automationRuleEngine) fail("automationRuleEngine required.");
  if (!actionExecutorRegistry) fail("actionExecutorRegistry required.");
  if (!interactionRuntime) fail("interactionRuntime required.");
  if (!workRuntime) fail("workRuntime required.");
  if (!approvalRuntime) fail("approvalRuntime required.");

  const orchestration = new AutomationOrchestrationService({
    automationRuntime,
    automationRuleEngine,
    actionExecutorRegistry,
    interactionRuntime,
    automationPlatformEventPublisher,
    approvalRuntime,
    approvalPlatformEventPublisher,
  });

  return createPlatformEventSubscriberFromHandler({
    id: String(id),
    name: String(name),
    operatingSystem: String(operatingSystem),
    supportedEvents: ["APPROVAL_GRANTED", "APPROVAL_REJECTED"],
    priority,
    enabled,
    handler: (event, context = {}) => {
      try {
        const nowISO = String(context.nowISO ?? automationRuntime.nowISO ?? "2026-07-01T00:00:00.000Z");
        const eventType = String(event?.eventType ?? "");

        if (eventType === "APPROVAL_GRANTED") {
          orchestration.resumeAfterApproval({
            platformEvent: event,
            context: { workRuntime, nowISO },
          });
        } else if (eventType === "APPROVAL_REJECTED") {
          orchestration.handleApprovalRejected({
            platformEvent: event,
            context: { nowISO },
          });
        }

        return {
          status: SUBSCRIBER_RESULT_STATUSES.SUCCESS,
          message: "",
          actions: [],
          errors: [],
          metadata: {},
        };
      } catch (err) {
        return {
          status: SUBSCRIBER_RESULT_STATUSES.FAILED,
          message: String(err?.message ?? err),
          actions: [],
          errors: [String(err?.message ?? err)],
          metadata: {},
        };
      }
    },
    handlerMetadata: { version: 1 },
  });
}
