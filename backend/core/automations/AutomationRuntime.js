import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { AutomationEventEngine } from "./AutomationEventEngine.js";
import { validateAutomationRuntime } from "./AutomationRuntimeValidator.js";
import { computeAutomationMetrics } from "./AutomationMetrics.js";

function deterministicISO(nowISO) {
  return String(nowISO ?? "2026-07-01T00:00:00.000Z");
}

function buildDefaultAutomationRuntimeSeed({ nowISO } = {}) {
  const automations = [];
  const runs = [];
  const metrics = computeAutomationMetrics({ automations, runs });
  return deepFreeze({ automations, runs, metrics });
}

export class AutomationRuntime {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = deterministicISO(nowISO);
    this._state = seed ? seed({ nowISO: this.nowISO }) : buildDefaultAutomationRuntimeSeed({ nowISO: this.nowISO });
    this._state = deepFreeze(this._state);
    validateAutomationRuntime(this);
  }

  getAutomations() {
    return this._state.automations;
  }

  getRuns() {
    return this._state.runs;
  }

  getMetrics() {
    return this._state.metrics;
  }

  getAutomationById(id) {
    const sid = String(id);
    return this._state.automations.find((a) => String(a.id) === sid) ?? null;
  }

  getRunById(id) {
    const sid = String(id);
    return this._state.runs.find((r) => String(r.id) === sid) ?? null;
  }

  applyEvent(event) {
    const engine = new AutomationEventEngine({ runtime: this });
    engine.apply(event);
    validateAutomationRuntime(this);
    return this._state;
  }
}
