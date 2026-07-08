import assert from "node:assert/strict";
import { test } from "node:test";

import { AutomationRuntime } from "../AutomationRuntime.js";
import { AutomationRuleEngine } from "../engine/AutomationRuleEngine.js";
import { AutomationOrchestrationService } from "../AutomationOrchestrationService.js";
import { createDefaultAutomationActionExecutorRegistry } from "../actions/AutomationActionExecutorRegistry.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WorkPlatformEventPublisher } from "../../work/events/WorkPlatformEventPublisher.js";
import { PlatformEventStore } from "../../events/PlatformEventStore.js";
import { PlatformEventBus } from "../../events/bus/PlatformEventBus.js";
import { PlatformEventPublisherRegistry } from "../../events/publishing/PlatformEventPublisherRegistry.js";
import { PlatformEventPublisher } from "../../events/publishing/PlatformEventPublisher.js";
import { WORK_OS_PUBLISHER_ID } from "../../work/events/WorkPlatformEventDefaults.js";
import { ApprovalRuntime } from "../../approvals/ApprovalRuntime.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "../../approvals/ApprovalEventTypes.js";
import { ApprovalPlatformEventPublisher } from "../../approvals/events/ApprovalPlatformEventPublisher.js";
import { APPROVAL_OS_PUBLISHER_ID } from "../../approvals/events/ApprovalPlatformEventDefaults.js";
import { installAutomationTemplate } from "./AutomationTemplateInstaller.js";
import {
  OUTCOME_CREATES_WORK_TEMPLATE,
  AutomationTemplateRegistry,
} from "./AutomationTemplateRegistry.js";
import {
  buildUniversalityConfiguration,
  UNIVERSALITY_TEST_CONFIGS,
  buildApprovalGatedAutomationConfiguration,
} from "../install/WorkspaceAutomationInstaller.js";
import { ACTION_EXECUTION_STATUSES } from "../actions/AutomationActionExecutionResult.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function buildOrchestrationStack({ automationRuntime, interactionRuntime, approvalRuntime } = {}) {
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const store = new PlatformEventStore({ nowISO: NOW0 });
  const bus = new PlatformEventBus({ nowISO: NOW0 });
  const publisherRegistry = new PlatformEventPublisherRegistry({
    publishers: [
      {
        id: WORK_OS_PUBLISHER_ID,
        name: "Work OS",
        operatingSystem: "work_os",
        allowedEventTypes: ["WORK_CREATED"],
        version: 1,
        metadata: {},
      },
      {
        id: APPROVAL_OS_PUBLISHER_ID,
        name: "Approval OS",
        operatingSystem: "approval_os",
        allowedEventTypes: ["APPROVAL_REQUESTED", "APPROVAL_GRANTED", "APPROVAL_REJECTED"],
        version: 1,
        metadata: {},
      },
    ],
  });

  const workPublisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: WORK_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO: NOW0,
  });
  const approvalPublisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: APPROVAL_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO: NOW0,
  });

  const actionExecutorRegistry = createDefaultAutomationActionExecutorRegistry({
    workPlatformEventPublisher: new WorkPlatformEventPublisher({ platformEventPublisher: workPublisher }),
  });

  const orchestration = new AutomationOrchestrationService({
    automationRuntime,
    automationRuleEngine: new AutomationRuleEngine(),
    actionExecutorRegistry,
    interactionRuntime,
    approvalRuntime: approvalRuntime ?? new ApprovalRuntime({ nowISO: NOW0 }),
    approvalPlatformEventPublisher: new ApprovalPlatformEventPublisher({ platformEventPublisher: approvalPublisher }),
  });

  return { orchestration, workRuntime, approvalRuntime: approvalRuntime ?? orchestration.approvalRuntime };
}

function platformEventForOutcome({ interactionId, outcome, followUpAt = "2026-07-03T15:00:00.000Z" } = {}) {
  return Object.freeze({
    eventId: `evt_interaction_outcome_recorded_${interactionId}_${NOW0}`,
    eventType: "INTERACTION_OUTCOME_RECORDED",
    occurredAt: NOW0,
    payload: { interactionId, outcome, followUpAt },
    metadata: {},
  });
}

test("AutomationTemplateInstaller: installs through applyEvent deterministically", () => {
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  assert.equal(automationRuntime.getAutomations().length, 0);

  const cfg = buildUniversalityConfiguration({ outcomeValue: "action_required", workType: "operational_action" });
  const first = installAutomationTemplate({
    template: OUTCOME_CREATES_WORK_TEMPLATE,
    configuration: cfg,
    automationRuntime,
    nowISO: NOW0,
  });
  const second = installAutomationTemplate({
    template: OUTCOME_CREATES_WORK_TEMPLATE,
    configuration: cfg,
    automationRuntime,
    nowISO: NOW0,
  });

  assert.equal(first.automationId, second.automationId);
  assert.equal(automationRuntime.getAutomations().length, 1);
  assert.equal(automationRuntime.getAutomationById(first.automationId).trigger.eventType, "INTERACTION_OUTCOME_RECORDED");
});

test("AutomationTemplateInstaller: rejects missing required configuration", () => {
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  assert.throws(
    () =>
      installAutomationTemplate({
        template: OUTCOME_CREATES_WORK_TEMPLATE,
        configuration: { triggerEventType: "INTERACTION_OUTCOME_RECORDED" },
        automationRuntime,
        nowISO: NOW0,
      }),
    /Missing required configuration key/,
  );
});

test("AutomationTemplateRegistry: template remains frozen and duplicate registration fails", () => {
  const registry = new AutomationTemplateRegistry();
  const tpl = registry.getTemplate("tpl_outcome_creates_work");
  assert.ok(Object.isFrozen(tpl));
  assert.throws(() => registry.register(tpl), /duplicate template id/);
});

test("Universality proof: same core + executor, three materially different configurations", () => {
  for (const [name, overrides] of Object.entries(UNIVERSALITY_TEST_CONFIGS)) {
    const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
    const interactionId = `int_${name}`;
    const interactionRuntime = {
      getInteraction: () => ({
        ownerId: "tm_owner",
        relatedObjects: [{ requestId: "req_1" }],
      }),
    };

    installAutomationTemplate({
      template: OUTCOME_CREATES_WORK_TEMPLATE,
      configuration: buildUniversalityConfiguration({
        ...overrides,
        actionId: `act_${name}`,
        assignedTo: "tm_owner",
      }),
      automationRuntime,
      nowISO: NOW0,
    });

    const { orchestration, workRuntime } = buildOrchestrationStack({ automationRuntime, interactionRuntime });
    orchestration.orchestratePlatformEvent({
      platformEvent: platformEventForOutcome({ interactionId, outcome: overrides.outcomeValue }),
      context: { nowISO: NOW0, workRuntime },
    });

    const workId = `${overrides.workItemIdPrefix}${interactionId}`;
    const work = workRuntime.getWorkItem(workId);
    assert.ok(work, `${name} should create configured work`);
    assert.equal(String(work.workType), overrides.workType);
  }
});

test("Approval-gated template: grant resumes once; reject never creates work", () => {
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const approvalRuntime = new ApprovalRuntime({ nowISO: NOW0 });
  const interactionId = "int_gated";
  const interactionRuntime = {
    getInteraction: () => ({ ownerId: "tm_owner", relatedObjects: [] }),
  };

  installAutomationTemplate({
    template: OUTCOME_CREATES_WORK_TEMPLATE,
    configuration: buildApprovalGatedAutomationConfiguration({ assignedTo: "tm_owner" }),
    automationRuntime,
    nowISO: NOW0,
  });

  const { orchestration, workRuntime } = buildOrchestrationStack({
    automationRuntime,
    interactionRuntime,
    approvalRuntime,
  });

  const event = platformEventForOutcome({ interactionId, outcome: "action_required" });
  orchestration.orchestratePlatformEvent({ platformEvent: event, context: { nowISO: NOW0, workRuntime } });

  const workId = `work_auto_gated_${interactionId}`;
  assert.equal(workRuntime.getWorkItem(workId), null, "work must not exist before approval");

  const runs = automationRuntime.getRuns();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "WAITING_FOR_APPROVAL");
  assert.equal(runs[0].executionResults[0].status, ACTION_EXECUTION_STATUSES.PENDING_APPROVAL);

  const approvalId = runs[0].executionResults[0].output.approvalId;
  approvalRuntime.applyEvent({
    id: "evt_grant",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_GRANTED,
    payload: { approvalId, decidedAt: NOW0 },
  });

  orchestration.resumeAfterApproval({
    platformEvent: { payload: { approvalId } },
    context: { nowISO: NOW0, workRuntime },
  });

  assert.ok(workRuntime.getWorkItem(workId), "work exists exactly once after approval");
  assert.equal(automationRuntime.getRunById(runs[0].id).status, "COMPLETED");

  orchestration.resumeAfterApproval({
    platformEvent: { payload: { approvalId } },
    context: { nowISO: NOW0, workRuntime },
  });
  assert.equal(workRuntime.getWorkItems?.()?.length ?? 1, 1, "duplicate resume must not duplicate work");
});

test("Approval-gated template: rejection closes run without execution", () => {
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const approvalRuntime = new ApprovalRuntime({ nowISO: NOW0 });
  const interactionId = "int_reject";
  const interactionRuntime = {
    getInteraction: () => ({ ownerId: "tm_owner", relatedObjects: [] }),
  };

  installAutomationTemplate({
    template: OUTCOME_CREATES_WORK_TEMPLATE,
    configuration: buildApprovalGatedAutomationConfiguration({ assignedTo: "tm_owner" }),
    automationRuntime,
    nowISO: NOW0,
  });

  const { orchestration, workRuntime } = buildOrchestrationStack({
    automationRuntime,
    interactionRuntime,
    approvalRuntime,
  });

  orchestration.orchestratePlatformEvent({
    platformEvent: platformEventForOutcome({ interactionId, outcome: "action_required" }),
    context: { nowISO: NOW0, workRuntime },
  });

  const run = automationRuntime.getRuns()[0];
  const approvalId = run.executionResults[0].output.approvalId;
  const workId = `work_auto_gated_${interactionId}`;

  approvalRuntime.applyEvent({
    id: "evt_reject",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REJECTED,
    payload: { approvalId, decidedAt: NOW0 },
  });

  orchestration.handleApprovalRejected({
    platformEvent: { payload: { approvalId } },
    context: { nowISO: NOW0 },
  });

  assert.equal(workRuntime.getWorkItem(workId), null);
  assert.equal(automationRuntime.getRunById(run.id).status, "CLOSED");
  assert.equal(automationRuntime.getRunById(run.id).executionResults[0].status, ACTION_EXECUTION_STATUSES.SKIPPED);
});
