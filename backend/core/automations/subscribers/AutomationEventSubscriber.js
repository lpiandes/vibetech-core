import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";

import { SUBSCRIBER_RESULT_STATUSES } from "../../events/subscribers/PlatformEventSubscriberDefaults.js";

import { AutomationOrchestrationService } from "../AutomationOrchestrationService.js";

function fail(message) {
  throw new Error(`AutomationEventSubscriber: ${message}`);
}

export function createAutomationEventSubscriber({
  id = "sub_automation_event",
  name = "AutomationEventSubscriber",
  operatingSystem = "automation_event_subscribers",
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
    supportedEvents: [
      "INTERACTION_OUTCOME_RECORDED",
      "SCHEDULE_CHANGE",
      "EVENT_UPDATE",
      "EVENT_REMINDER_DUE",
      "ANNOUNCEMENT_REQUESTED",
      "SPECIALTY_JOB_REQUESTED",
      "SPECIALTY_SCHEDULE_DUE",
      "PIPELINE_STAGE_ENTERED",
      "NEW_INQUIRY",
      "INBOUND_VOICE_CALL",
      "SOCIAL_SCREEN_REQUESTED",
      "FORM_SUBMIT",
      "META_LEAD",
      "PRACTICE_SCHEDULED",
      "COACH_REQUEST",
      "TOURNAMENT_PLANNING",
      "SEASON_MILESTONE",
      "RECALL_DUE",
      "REACTIVATION_LIST",
    ],
    priority,
    enabled,
    handler: (event, context = {}) => {
      try {
        // Specialty stack already handled these events — do not double-fire classic rules.
        if (
          String(event?.metadata?.source ?? "") === "specialty_trigger"
          || event?.payload?.specialtyHandled === true
        ) {
          return {
            status: SUBSCRIBER_RESULT_STATUSES.SKIPPED,
            message: "Skipped — specialty automation owns this event.",
            actions: [],
            errors: [],
            metadata: { dedup: "specialty_trigger" },
          };
        }

        const orchestrated = orchestration.orchestratePlatformEvent({
          platformEvent: event,
          context: {
            workRuntime,
            nowISO: event?.occurredAt ?? context.nowISO ?? automationRuntime.nowISO,
          },
        });

        if (String(orchestrated.status) === "SKIPPED") {
          return {
            status: SUBSCRIBER_RESULT_STATUSES.SKIPPED,
            message: orchestrated.message ?? "",
            actions: [],
            errors: [],
            metadata: {},
          };
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
