import assert from "node:assert/strict";
import { test } from "node:test";

import { AutomationRuleEngine } from "./AutomationRuleEngine.js";
import { evaluateAutomationCondition } from "./AutomationConditionEvaluator.js";
import { AutomationRuntime } from "../AutomationRuntime.js";
import { createAutomationDefinition } from "../AutomationDefinition.js";
import { createAutomationTrigger } from "../AutomationTrigger.js";
import { createAutomationCondition } from "../AutomationCondition.js";
import { createAutomationAction, AUTOMATION_ACTION_TYPES } from "../AutomationAction.js";
import { computeAutomationMetrics } from "../AutomationMetrics.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function buildEmptyAutomationRuntime({ automations } = {}) {
  const seed = () => {
    const runs = [];
    const metrics = computeAutomationMetrics({ automations: automations ?? [], runs });
    return { automations: automations ?? [], runs, metrics };
  };
  return new AutomationRuntime({ nowISO: NOW0, seed });
}

test("AutomationRuleEngine: eventType mismatch => no matches", () => {
  const a = createAutomationDefinition({
    id: "automation_1",
    name: "A1",
    description: "",
    status: "ACTIVE",
    trigger: createAutomationTrigger({ eventType: "INTERACTION_OUTCOME_RECORDED" }),
    conditions: [createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "follow_up_required" })],
    actions: [
      createAutomationAction({
        id: "act_1",
        actionType: AUTOMATION_ACTION_TYPES.CREATE_WORK,
        requiresApproval: false,
        order: 1,
        parameters: { workType: "follow_up", title: "t", description: "d", priority: "low" },
        metadata: {},
      }),
    ],
    priority: 0,
    version: 1,
    metadata: {},
    createdAt: NOW0,
    updatedAt: NOW0,
  });

  const rt = buildEmptyAutomationRuntime({ automations: [a] });
  const engine = new AutomationRuleEngine();

  const res = engine.matchEvent({
    event: Object.freeze({
      eventId: "evt_1",
      eventType: "WORK_CREATED",
      version: 1,
      occurredAt: NOW0,
      publisher: "x",
      aggregateType: "work",
      aggregateId: "w1",
      correlationId: "c",
      causationId: "c",
      payload: { outcome: "follow_up_required" },
      metadata: {},
    }),
    automationRuntime: rt,
  });

  assert.equal(res.matchedAutomations.length, 0);
  assert.deepEqual(res.skippedAutomations, []);
});

test("AutomationConditionEvaluator: nested field path + operators", () => {
  const event = Object.freeze({
    eventType: "INTERACTION_OUTCOME_RECORDED",
    payload: { outcome: "follow_up_required", count: 10, flags: ["a", "b"] },
  });

  assert.equal(
    evaluateAutomationCondition({
      condition: createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "follow_up_required" }),
      event,
    }),
    true,
  );

  assert.equal(
    evaluateAutomationCondition({
      condition: createAutomationCondition({ fieldPath: "payload.outcome", operator: "NOT_EQUALS", value: "x" }),
      event,
    }),
    true,
  );

  assert.equal(
    evaluateAutomationCondition({
      condition: createAutomationCondition({ fieldPath: "payload.missing", operator: "EXISTS", value: null }),
      event,
    }),
    false,
  );

  assert.equal(
    evaluateAutomationCondition({
      condition: createAutomationCondition({ fieldPath: "payload.missing", operator: "NOT_EXISTS", value: null }),
      event,
    }),
    true,
  );

  assert.equal(
    evaluateAutomationCondition({
      condition: createAutomationCondition({ fieldPath: "payload.flags", operator: "IN", value: ["b", "c"] }),
      event,
    }),
    true,
  );

  assert.equal(
    evaluateAutomationCondition({
      condition: createAutomationCondition({ fieldPath: "payload.count", operator: "GREATER_THAN", value: 5 }),
      event,
    }),
    true,
  );
});

test("AutomationConditionEvaluator: invalid operator rejection", () => {
  assert.throws(() => {
    evaluateAutomationCondition({
      condition: { fieldPath: "payload.outcome", operator: "NOPE", value: "x" },
      event: { payload: { outcome: "x" } },
    });
  }, /Unsupported operator/);
});

test("AutomationRuleEngine: deterministic ordering by priority then id", () => {
  const aLow = createAutomationDefinition({
    id: "automation_low",
    name: "low",
    description: "",
    status: "ACTIVE",
    trigger: createAutomationTrigger({ eventType: "INTERACTION_OUTCOME_RECORDED" }),
    conditions: [createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "follow_up_required" })],
    actions: [
      createAutomationAction({
        id: "act_1",
        actionType: AUTOMATION_ACTION_TYPES.CREATE_WORK,
        requiresApproval: false,
        order: 1,
        parameters: { workType: "follow_up", title: "t", description: "d", priority: "low" },
        metadata: {},
      }),
    ],
    priority: 10,
    version: 1,
    metadata: {},
    createdAt: NOW0,
    updatedAt: NOW0,
  });

  const aHigh = createAutomationDefinition({
    id: "automation_high",
    name: "high",
    description: "",
    status: "ACTIVE",
    trigger: createAutomationTrigger({ eventType: "INTERACTION_OUTCOME_RECORDED" }),
    conditions: [createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "follow_up_required" })],
    actions: [
      createAutomationAction({
        id: "act_2",
        actionType: AUTOMATION_ACTION_TYPES.CREATE_WORK,
        requiresApproval: false,
        order: 1,
        parameters: { workType: "follow_up", title: "t", description: "d", priority: "low" },
        metadata: {},
      }),
    ],
    priority: 1,
    version: 1,
    metadata: {},
    createdAt: NOW0,
    updatedAt: NOW0,
  });

  const rt = buildEmptyAutomationRuntime({ automations: [aLow, aHigh] });
  const engine = new AutomationRuleEngine();

  const before = JSON.stringify(rt._state);
  const res = engine.matchEvent({
    event: Object.freeze({
      eventId: "evt_1",
      eventType: "INTERACTION_OUTCOME_RECORDED",
      payload: { outcome: "follow_up_required" },
    }),
    automationRuntime: rt,
  });
  const after = JSON.stringify(rt._state);
  assert.equal(before, after, "Rule engine must not mutate runtime state.");

  assert.equal(res.matchedAutomations.length, 2);
  assert.equal(res.matchedAutomations[0].automationId, aHigh.id);
  assert.equal(res.matchedAutomations[1].automationId, aLow.id);
});
