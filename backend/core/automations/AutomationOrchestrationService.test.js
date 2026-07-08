import assert from "node:assert/strict";
import { test } from "node:test";

import { AutomationRuntime } from "./AutomationRuntime.js";
import { AutomationRuleEngine } from "./engine/AutomationRuleEngine.js";
import { AUTOMATION_INTERNAL_EVENT_TYPES } from "./AutomationEventTypes.js";
import { createAutomationDefinition } from "./AutomationDefinition.js";
import { createAutomationTrigger } from "./AutomationTrigger.js";
import { createAutomationCondition } from "./AutomationCondition.js";
import { createAutomationAction, AUTOMATION_ACTION_TYPES } from "./AutomationAction.js";
import { computeAutomationMetrics } from "./AutomationMetrics.js";
import { AutomationOrchestrationService } from "./AutomationOrchestrationService.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("AutomationOrchestrationService: matching event creates run + executes actions (bounded, deterministic)", () => {
  const automation = createAutomationDefinition({
    id: "automation_test_create_work",
    name: "Test automation",
    description: "",
    status: "ACTIVE",
    trigger: createAutomationTrigger({ eventType: "INTERACTION_OUTCOME_RECORDED" }),
    conditions: [createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "follow_up_required" })],
    actions: [
      createAutomationAction({
        id: "act_create_follow_up_work",
        actionType: AUTOMATION_ACTION_TYPES.CREATE_WORK,
        requiresApproval: false,
        order: 1,
        parameters: {
          workItemId: "work_1",
          workType: "follow_up",
          title: "Follow up",
          description: "desc",
          priority: "low",
          assignedTo: "unassigned",
          stageId: "stage_follow_up",
          queueId: "queue_follow_up",
          status: "new",
          dueAt: "2026-07-03T15:00:00.000Z",
          relatedObjects: [{ interactionId: "int_1" }],
          requestedBy: "tm_system",
          source: "automation",
          requirements: [],
          metadata: {},
        },
        metadata: {},
      }),
    ],
    priority: 0,
    version: 1,
    metadata: {},
    createdAt: NOW0,
    updatedAt: NOW0,
  });

  const seed = ({ nowISO } = {}) => {
    const runs = [];
    const metrics = computeAutomationMetrics({ automations: [automation], runs });
    return { automations: [automation], runs, metrics };
  };

  const automationRuntime = new AutomationRuntime({ nowISO: NOW0, seed });
  const engine = new AutomationRuleEngine();

  const interactionRuntime = {
    getInteraction: () => ({
      ownerId: "tm_owner",
      relatedObjects: [{ requestId: "req_1" }, { partyId: "party_1" }],
    }),
  };

  const calls = [];
  const actionExecutorRegistry = {
    execute: ({ action }) => {
      calls.push(String(action.id));
      return Object.freeze({
        actionId: String(action.id),
        actionType: String(action.actionType),
        status: "COMPLETED",
        startedAt: NOW0,
        completedAt: NOW0,
        output: Object.freeze({ workItemId: String(action.parameters.workItemId) }),
        metadata: Object.freeze({}),
      });
    },
  };

  const platformPublisher = {
    publishAutomationRunStarted: () => {},
    publishAutomationRunCompleted: () => {},
    publishAutomationRunFailed: () => {},
  };

  const orchestration = new AutomationOrchestrationService({
    automationRuntime,
    automationRuleEngine: engine,
    actionExecutorRegistry,
    interactionRuntime,
    automationPlatformEventPublisher: platformPublisher,
  });

  const interactionId = "int_1";
  const followUpAt = "2026-07-03T15:00:00.000Z";
  const platformEvent = Object.freeze({
    eventId: "evt_interaction_outcome_1",
    eventType: "INTERACTION_OUTCOME_RECORDED",
    occurredAt: NOW0,
    version: 1,
    publisher: "interaction_os",
    aggregateType: "interaction",
    aggregateId: interactionId,
    correlationId: interactionId,
    causationId: interactionId,
    payload: { interactionId, outcome: "follow_up_required", nextStep: "call_back", followUpAt },
    metadata: {},
  });

  const res1 = orchestration.orchestratePlatformEvent({
    platformEvent,
    context: { nowISO: NOW0, workRuntime: { getWorkItem: () => null } },
  });

  assert.equal(res1.status, "SUCCESS");
  assert.equal(calls.length, 1, "one action executed");

  const runId = `run_${automation.id.replace(/[^a-zA-Z0-9_]/g, "_")}_${platformEvent.eventId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const run = automationRuntime.getRunById(runId);
  assert.ok(run);
  assert.equal(run.status, "COMPLETED");
  assert.equal(run.plannedActions.length, 1);
  assert.equal(run.executionResults.length, 1);
  assert.equal(String(run.plannedActions[0].parameters.dueAt), followUpAt);

  const res2 = orchestration.orchestratePlatformEvent({
    platformEvent,
    context: { nowISO: NOW0, workRuntime: { getWorkItem: () => null } },
  });
  assert.equal(automationRuntime.getRuns().length, 1, "duplicate delivery should not duplicate runs");
  assert.equal(calls.length, 1, "existing run should prevent re-execution");
  assert.equal(res2.status, "SUCCESS");
});
