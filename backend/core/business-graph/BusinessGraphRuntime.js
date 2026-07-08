import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { BusinessGraphEventEngine } from "./BusinessGraphEventEngine.js";
import { validateBusinessGraphRuntime } from "./BusinessGraphValidator.js";

const DEFAULT_STATE = deepFreeze({
  parties: deepFreeze([]),
  relationships: deepFreeze([]),
  metrics: deepFreeze({ partyCount: 0, relationshipCount: 0 }),
});

export class BusinessGraphRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    this._state = deepFreeze(this._state);
    validateBusinessGraphRuntime(this);
  }

  getParties() {
    return this._state.parties;
  }

  getRelationships() {
    return this._state.relationships;
  }

  getParty(id) {
    const sid = String(id);
    return this._state.parties.find((p) => String(p.id) === sid) ?? null;
  }

  getRelationship(id) {
    const sid = String(id);
    return this._state.relationships.find((r) => String(r.id) === sid) ?? null;
  }

  applyEvent(event) {
    const engine = new BusinessGraphEventEngine({ runtime: this });
    engine.apply(event);

    // Update simple derived metrics deterministically.
    const parties = this._state.parties ?? [];
    const relationships = this._state.relationships ?? [];
    this._state = deepFreeze({
      ...this._state,
      metrics: deepFreeze({
        partyCount: parties.length,
        relationshipCount: relationships.length,
      }),
    });
    validateBusinessGraphRuntime(this);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}
