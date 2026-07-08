import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CommunicationPreferenceEventEngine } from "./CommunicationPreferenceEventEngine.js";

const DEFAULT_STATE = deepFreeze({ preferences: deepFreeze([]) });

export class CommunicationPreferenceRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : DEFAULT_STATE;
    this._state = deepFreeze(this._state);
  }

  getPreferences() {
    return this._state.preferences;
  }

  getPreferencesForParty(partyId) {
    const pid = String(partyId);
    return this._state.preferences.filter((p) => String(p.partyId) === pid);
  }

  applyEvent(event) {
    const engine = new CommunicationPreferenceEventEngine({ runtime: this });
    engine.apply(event);
    return this._state;
  }

  exportState() {
    return this._state;
  }
}
