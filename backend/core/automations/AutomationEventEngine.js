import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import {
  AUTOMATION_DEFINITION_STATUSES,
  AUTOMATION_INTERNAL_EVENT_TYPES as INTERNAL_TYPES,
} from "./AutomationEventTypes.js";

import { createAutomationRun } from "./AutomationRun.js";
import { computeAutomationMetrics } from "./AutomationMetrics.js";

function fail(message) {
  throw new Error(`AutomationEventEngine: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findById(items, id) {
  const sid = String(id);
  return items.find((x) => String(x?.id) === sid) ?? null;
}

function findIndexById(items, id) {
  const sid = String(id);
  return items.findIndex((x) => String(x?.id) === sid);
}

export class AutomationEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) fail("AutomationEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") fail("event must be an object.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    if (!isPlainObject(event.payload)) fail("event.payload must be plain object.");

    const type = String(event.type);
    const prev = this.runtime._state;
    let automations = safeClone(prev.automations);
    let runs = safeClone(prev.runs);
    const payload = event.payload;

    switch (type) {
      case INTERNAL_TYPES.AUTOMATION_REGISTERED: {
        const automation = payload.automation;
        if (!automation || typeof automation !== "object") fail("automation required.");
        const existing = findById(automations, automation.id);
        if (existing) throw new Error(`AUTOMATION_REGISTERED: automation already exists: ${String(automation.id)}`);
        automations.push(automation);
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_ACTIVATED: {
        const automationId = payload.automationId;
        requireString(String(automationId ?? ""), "payload.automationId");
        const idx = findIndexById(automations, automationId);
        if (idx === -1) fail(`AUTOMATION_ACTIVATED: automation not found: ${String(automationId)}`);
        automations[idx] = deepFreeze({ ...automations[idx], status: AUTOMATION_DEFINITION_STATUSES.ACTIVE });
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_DEACTIVATED: {
        const automationId = payload.automationId;
        requireString(String(automationId ?? ""), "payload.automationId");
        const idx = findIndexById(automations, automationId);
        if (idx === -1) fail(`AUTOMATION_DEACTIVATED: automation not found: ${String(automationId)}`);
        automations[idx] = deepFreeze({ ...automations[idx], status: AUTOMATION_DEFINITION_STATUSES.INACTIVE });
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_ARCHIVED: {
        const automationId = payload.automationId;
        requireString(String(automationId ?? ""), "payload.automationId");
        const idx = findIndexById(automations, automationId);
        if (idx === -1) fail(`AUTOMATION_ARCHIVED: automation not found: ${String(automationId)}`);
        automations[idx] = deepFreeze({ ...automations[idx], status: AUTOMATION_DEFINITION_STATUSES.ARCHIVED });
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_RUN_STARTED: {
        const run = payload.run;
        if (!run || typeof run !== "object") fail("run required.");
        const existing = findById(runs, run.id);
        if (existing) {
          // Idempotency: starting an already existing run is a no-op.
          break;
        }
        runs.push(run);
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_RUN_WAITING_FOR_APPROVAL: {
        const runId = payload.runId;
        requireString(String(runId ?? ""), "payload.runId");
        const idx = findIndexById(runs, runId);
        if (idx === -1) fail(`AUTOMATION_RUN_WAITING_FOR_APPROVAL: run not found: ${String(runId)}`);

        const next = createAutomationRun({
          ...runs[idx],
          status: "WAITING_FOR_APPROVAL",
          plannedActions: runs[idx].plannedActions ?? [],
          executionResults: Array.isArray(payload.executionResults) ? payload.executionResults : [],
          completedAt: null,
          error: null,
        });
        runs[idx] = next;
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_RUN_COMPLETED: {
        const runId = payload.runId;
        requireString(String(runId ?? ""), "payload.runId");
        const idx = findIndexById(runs, runId);
        if (idx === -1) fail(`AUTOMATION_RUN_COMPLETED: run not found: ${String(runId)}`);

        const next = createAutomationRun({
          ...runs[idx],
          status: "COMPLETED",
          plannedActions: runs[idx].plannedActions ?? [],
          executionResults: Array.isArray(payload.executionResults) ? payload.executionResults : [],
          completedAt: payload.completedAt ?? event.timestampISO,
          error: null,
        });
        runs[idx] = next;
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_RUN_FAILED: {
        const runId = payload.runId;
        requireString(String(runId ?? ""), "payload.runId");
        const idx = findIndexById(runs, runId);
        if (idx === -1) fail(`AUTOMATION_RUN_FAILED: run not found: ${String(runId)}`);

        const next = createAutomationRun({
          ...runs[idx],
          status: "FAILED",
          plannedActions: runs[idx].plannedActions ?? [],
          executionResults: Array.isArray(payload.executionResults) ? payload.executionResults : [],
          completedAt: payload.failedAt ?? null,
          error: payload.error ?? "Automation run failed.",
        });
        runs[idx] = next;
        break;
      }

      case INTERNAL_TYPES.AUTOMATION_RUN_CLOSED: {
        const runId = payload.runId;
        requireString(String(runId ?? ""), "payload.runId");
        const idx = findIndexById(runs, runId);
        if (idx === -1) fail(`AUTOMATION_RUN_CLOSED: run not found: ${String(runId)}`);

        const next = createAutomationRun({
          ...runs[idx],
          status: "CLOSED",
          plannedActions: runs[idx].plannedActions ?? [],
          executionResults: Array.isArray(payload.executionResults) ? payload.executionResults : [],
          completedAt: payload.closedAt ?? event.timestampISO,
          error: payload.error ?? null,
        });
        runs[idx] = next;
        break;
      }

      default:
        throw new Error(`AutomationEventEngine: Unhandled event type: ${type}`);
    }

    // Metrics are derived deterministically from state.
    const metrics = computeAutomationMetrics({ automations, runs });

    this.runtime._state = deepFreeze({
      automations: deepFreeze(automations),
      runs: deepFreeze(runs),
      metrics,
    });
  }
}
