import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { AutomationRuntime } from "./AutomationRuntime.js";
import { AUTOMATION_INTERNAL_EVENT_TYPES } from "./AutomationEventTypes.js";
import { createAutomationDefinition } from "./AutomationDefinition.js";
import { createAutomationTrigger } from "./AutomationTrigger.js";
import { createAutomationCondition } from "./AutomationCondition.js";
import { createAutomationAction, AUTOMATION_ACTION_TYPES } from "./AutomationAction.js";
import { computeAutomationMetrics } from "./AutomationMetrics.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("AutomationRuntime: starts empty + deterministic zero-state metrics", () => {
  const rt = new AutomationRuntime({ nowISO: NOW0 });

  assert.deepEqual(rt.getAutomations(), []);
  assert.deepEqual(rt.getRuns(), []);

  const metrics0 = rt.getMetrics();
  assert.equal(metrics0.totalAutomations, 0);
  assert.equal(metrics0.activeAutomations, 0);
  assert.equal(metrics0.totalRuns, 0);
  assert.equal(metrics0.completedRuns, 0);
  assert.equal(metrics0.failedRuns, 0);
});

test("AutomationRuntime: activation/deactivation changes active metrics", () => {
  const automation = createAutomationDefinition({
    id: "automation_activation_1",
    name: "Activation",
    description: "",
    status: "INACTIVE",
    trigger: createAutomationTrigger({ eventType: "INTERACTION_OUTCOME_RECORDED" }),
    conditions: [createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "x" })],
    actions: [
      createAutomationAction({
        id: "act_activation_1",
        actionType: AUTOMATION_ACTION_TYPES.CREATE_WORK,
        requiresApproval: false,
        order: 1,
        parameters: { workItemId: "wi_1", workType: "work", title: "t", description: "d", priority: "low", assignedTo: "unassigned", stageId: "stage_intake", queueId: "queue_needs_review" },
        metadata: {},
      }),
    ],
    priority: 0,
    version: 1,
    metadata: {},
    createdAt: NOW0,
    updatedAt: NOW0,
  });

  const rt = new AutomationRuntime({
    nowISO: NOW0,
    seed: () => ({
      automations: [automation],
      runs: [],
      metrics: computeAutomationMetrics({ automations: [automation], runs: [] }),
    }),
  });

  rt.applyEvent({
    id: `evt_auto_deactivate_${automation.id}`,
    timestampISO: NOW0,
    type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_DEACTIVATED,
    payload: { automationId: automation.id },
  });

  const metrics = rt.getMetrics();
  assert.equal(metrics.activeAutomations, 0);
});

test("AutomationRuntime: duplicate automation ids rejected", () => {
  const rt = new AutomationRuntime({ nowISO: NOW0, seed: () => ({ automations: [], runs: [], metrics: { totalAutomations: 0, activeAutomations: 0, totalRuns: 0, completedRuns: 0, failedRuns: 0, runsByAutomation: {} } }) });

  const a1 = createAutomationDefinition({
    id: "automation_1",
    name: "A1",
    description: "desc",
    status: "ACTIVE",
    trigger: createAutomationTrigger({ eventType: "INTERACTION_OUTCOME_RECORDED" }),
    conditions: [createAutomationCondition({ fieldPath: "payload.outcome", operator: "EQUALS", value: "x" })],
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

  rt.applyEvent({
    id: "evt_auto_register_1",
    timestampISO: NOW0,
    type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_REGISTERED,
    payload: { automation: a1 },
  });

  assert.throws(() => {
    rt.applyEvent({
      id: "evt_auto_register_1_dup",
      timestampISO: NOW0,
      type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_REGISTERED,
      payload: { automation: a1 },
    });
  }, /automation already exists/);
});

test("AutomationRuntime: does not import platform event runtime/bus", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const contents = readFileSync(join(here, "AutomationRuntime.js"), "utf8");
  assert.equal(contents.includes("PlatformEventBus"), false);
  assert.equal(contents.includes("events/bus/PlatformEventBus"), false);
});
