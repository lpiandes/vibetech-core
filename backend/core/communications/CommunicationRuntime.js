import { buildDefaultCommunicationSeed } from "./CommunicationBuilder.js";
import { CommunicationEventEngine } from "./CommunicationEventEngine.js";
import { validateCommunicationRuntime } from "./CommunicationRuntimeValidator.js";

import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export class CommunicationRuntime {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this._state = seed ? seed() : buildDefaultCommunicationSeed();
    this._state = deepFreeze(this._state);
    validateCommunicationRuntime(this);
  }

  getThreads() {
    return this._state.threads;
  }

  getThread(id) {
    const sid = String(id);
    return this._state.threads.find((t) => String(t.id) === sid) ?? null;
  }

  getMessages() {
    return this._state.messages;
  }

  getMessage(id) {
    const sid = String(id);
    return this._state.messages.find((m) => String(m.id) === sid) ?? null;
  }

  getMetrics() {
    return this._state.metrics;
  }

  applyEvent(event) {
    const engine = new CommunicationEventEngine({ runtime: this });
    engine.apply(event);
    this._state = deepFreeze(this._state);
    validateCommunicationRuntime(this);
    return this._state;
  }
}

