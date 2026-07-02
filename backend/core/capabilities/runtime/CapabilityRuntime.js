import { buildCapabilityRuntimeSeed } from "./CapabilityBuilder.js";

import { CapabilityEventEngine } from "./CapabilityEventEngine.js";
import { validateCapabilityRuntime } from "./CapabilityRuntimeValidator.js";

export class CapabilityRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : buildCapabilityRuntimeSeed();
    validateCapabilityRuntime(this);
  }

  getCapabilities() {
    return this._state.capabilities;
  }

  getCapability(id) {
    const sid = String(id);
    return this._state.capabilities.find((c) => String(c.id) === sid) ?? null;
  }

  getCategories() {
    return this._state.categories;
  }

  getRequirements() {
    // Compatibility hook: requirements live inside capabilities.
    return [];
  }

  getMetrics() {
    return this._state.metrics;
  }

  applyEvent(event) {
    const engine = new CapabilityEventEngine({ runtime: this });
    engine.apply(event);
    validateCapabilityRuntime(this);
    return this._state;
  }
}

