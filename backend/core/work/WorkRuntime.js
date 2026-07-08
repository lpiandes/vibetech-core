import { buildDefaultWorkSeed } from "./WorkBuilder.js";
import { WorkEventEngine } from "./WorkEventEngine.js";

import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { validateWorkRuntime } from "./WorkRuntimeValidator.js";

export class WorkRuntime {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this._state = seed ? seed({ nowISO: this.nowISO }) : buildDefaultWorkSeed({ nowISO: this.nowISO });
    this._state = deepFreeze(this._state);
    validateWorkRuntime(this);
  }

  getWorkItems() {
    return this._state.workItems;
  }

  getWorkItem(id) {
    const sid = String(id);
    return this._state.workItems.find((w) => String(w.id) === sid) ?? null;
  }

  getStages() {
    return this._state.stages;
  }

  getQueues() {
    return this._state.queues;
  }

  getAssignments() {
    return this._state.assignments;
  }

  getMetrics() {
    return this._state.metrics;
  }

  applyEvent(event) {
    const engine = new WorkEventEngine({ runtime: this });
    engine.apply(event);
    // engine deep-freezes next state; keep deterministic invariants.
    this._state = deepFreeze(this._state);
    validateWorkRuntime(this);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}

