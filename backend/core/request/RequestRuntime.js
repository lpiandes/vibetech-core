import { buildDefaultRequestSeed } from "./RequestBuilder.js";
import { RequestEventEngine } from "./RequestEventEngine.js";

import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { validateRequestRuntime } from "./RequestRuntimeValidator.js";

export class RequestRuntime {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this._state = seed ? seed({ nowISO: this.nowISO }) : buildDefaultRequestSeed({ nowISO: this.nowISO });
    this._state = deepFreeze(this._state);
    validateRequestRuntime(this);
  }

  getRequests() {
    return this._state.requests;
  }

  getRequest(id) {
    const sid = String(id);
    return this._state.requests.find((r) => String(r.id) === sid) ?? null;
  }

  getMetrics() {
    return this._state.metrics;
  }

  applyEvent(event) {
    const engine = new RequestEventEngine({ runtime: this });
    engine.apply(event);
    // Engine deep-freezes next state; keep deterministic invariants + validate.
    this._state = deepFreeze(this._state);
    validateRequestRuntime(this);
    return this._state;
  }
}

