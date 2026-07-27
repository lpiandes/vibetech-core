import { evaluateAutomationCondition } from "./AutomationConditionEvaluator.js";
import { createAutomationMatchResult } from "./AutomationMatchResult.js";

function fail(message) {
  throw new Error(`AutomationRuleEngine: ${message}`);
}

function requirePlainObject(v, name) {
  const ok = Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!ok) fail(`${name} must be plain object.`);
  return v;
}

function toSortedByPriorityThenId(items) {
  const copy = [...items];
  copy.sort((a, b) => {
    const pa = Number(a?.priority ?? 0);
    const pb = Number(b?.priority ?? 0);
    if (pa !== pb) return pa - pb; // deterministic: lower priority first
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
  return copy;
}

export class AutomationRuleEngine {
  matchEvent({ event, automationRuntime } = {}) {
    if (!event || typeof event !== "object") fail("event required.");
    if (!automationRuntime || typeof automationRuntime.getAutomations !== "function") fail("automationRuntime required.");
    requirePlainObject(event, "event");

    const eventType = String(event?.eventType ?? "");
    const autos = automationRuntime.getAutomations() ?? [];

    const activeAutomations = autos.filter((a) => String(a?.status ?? "") === "ACTIVE");

    const triggerCandidates = activeAutomations.filter((a) => {
      if (String(a?.trigger?.eventType ?? "") === eventType) return true;
      const extras = [
        ...(Array.isArray(a?.trigger?.metadata?.eventTypes) ? a.trigger.metadata.eventTypes : []),
        ...(Array.isArray(a?.metadata?.eventTypes) ? a.metadata.eventTypes : []),
      ].map(String);
      return extras.includes(eventType);
    });

    const ordered = toSortedByPriorityThenId(triggerCandidates);

    const matchedAutomations = [];
    const skippedAutomations = [];

    for (const automation of ordered) {
      const conditions = Array.isArray(automation?.conditions) ? automation.conditions : [];
      const conditionResults = [];

      for (const c of conditions) {
        const ok = Boolean(evaluateAutomationCondition({ condition: c, event }));
        conditionResults.push({ fieldPath: String(c?.fieldPath ?? ""), operator: String(c?.operator ?? ""), value: c?.value ?? null, result: ok });
      }

      const allMatch = conditionResults.every((r) => Boolean(r.result));

      if (allMatch) {
        matchedAutomations.push({
          automationId: String(automation.id),
          automation: automation,
          matchedConditions: deepFreezeConditionResults(conditionResults.filter((r) => r.result === true)),
        });
      } else {
        skippedAutomations.push(String(automation.id));
      }
    }

    return createAutomationMatchResult({ event, matchedAutomations, skippedAutomations });
  }
}

function deepFreezeConditionResults(arr) {
  // Local helper to keep match result immutable without pulling in global deepFreeze.
  // Conditions result objects are plain and small.
  const safe = Array.isArray(arr) ? arr : [];
  for (const r of safe) Object.freeze(r);
  return Object.freeze([...safe]);
}
