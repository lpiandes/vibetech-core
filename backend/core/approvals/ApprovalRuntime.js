import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { ApprovalEventEngine } from "./ApprovalEventEngine.js";
import { computeApprovalMetrics } from "./ApprovalMetrics.js";
import { validateApprovalRuntime } from "./ApprovalRuntimeValidator.js";

function buildDefaultApprovalRuntimeSeed() {
  const requests = [];
  return deepFreeze({
    requests,
    metrics: computeApprovalMetrics({ requests }),
  });
}

export class ApprovalRuntime {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this._state = seed ? seed({ nowISO: this.nowISO }) : buildDefaultApprovalRuntimeSeed();
    this._state = deepFreeze(this._state);
    validateApprovalRuntime(this);
  }

  getRequests() {
    return this._state.requests;
  }

  getMetrics() {
    return this._state.metrics;
  }

  getRequestById(id) {
    const sid = String(id);
    return this._state.requests.find((r) => String(r.id) === sid) ?? null;
  }

  applyEvent(event) {
    const engine = new ApprovalEventEngine({ runtime: this });
    engine.apply(event);
    validateApprovalRuntime(this);
    return this._state;
  }
}
