import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { InteractionEventEngine } from "./InteractionEventEngine.js";
import { validateInteractionRuntime } from "./InteractionValidator.js";

const DEFAULT_STATE = deepFreeze({
  interactions: deepFreeze([]),
  metrics: deepFreeze({ interactionCount: 0 }),
});

export class InteractionRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    this._state = deepFreeze(this._state);
    validateInteractionRuntime(this);
  }

  getInteractions() {
    return this._state.interactions;
  }

  getInteraction(id) {
    const sid = String(id);
    return this._state.interactions.find((i) => String(i.id) === sid) ?? null;
  }

  applyEvent(event) {
    const engine = new InteractionEventEngine({ runtime: this });
    engine.apply(event);
    validateInteractionRuntime(this);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}
