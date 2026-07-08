import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { buildAnalyticsRuntimeSeed } from "./AnalyticsBuilder.js";
import { AnalyticsEventEngine } from "./AnalyticsEventEngine.js";
import { validateAnalyticsRuntime } from "./AnalyticsRuntimeValidator.js";

export class AnalyticsRuntime {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this._state = seed ? seed() : buildAnalyticsRuntimeSeed();
    this._state = deepFreeze(this._state);
    validateAnalyticsRuntime(this);
  }

  getMetrics() {
    return this._state.metrics;
  }

  getMetric(id) {
    const sid = String(id);
    return this._state.metrics.find((m) => String(m.id) === sid) ?? null;
  }

  getDataPoints() {
    return this._state.dataPoints;
  }

  getDataPointsByMetric(metricId) {
    const mid = String(metricId);
    return this._state.dataPoints.filter((d) => String(d.metricId) === mid);
  }

  getDerivedMetrics() {
    return this._state.derivedMetrics;
  }

  applyEvent(event) {
    const engine = new AnalyticsEventEngine({ runtime: this });
    engine.apply(event);
    this._state = deepFreeze(this._state);
    validateAnalyticsRuntime(this);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}

