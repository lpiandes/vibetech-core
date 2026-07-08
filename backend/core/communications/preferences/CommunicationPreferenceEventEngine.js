import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createCommunicationPreference } from "./CommunicationPreference.js";
import { PREFERENCE_EVENT_TYPES, SUPPORTED_PREFERENCE_EVENT_TYPES } from "./CommunicationPreferenceEventTypes.js";

export class CommunicationPreferenceEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("CommunicationPreferenceEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!SUPPORTED_PREFERENCE_EVENT_TYPES.includes(event.type)) {
      throw new Error(`CommunicationPreferenceEventEngine: unsupported: ${event.type}`);
    }
    const prev = this.runtime._state;
    const preferences = [...(prev.preferences ?? [])];
    const payload = event.payload ?? {};

    if (event.type === PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED) {
      const pref = createCommunicationPreference(payload.preference);
      const idx = preferences.findIndex(
        (p) =>
          String(p.partyId) === String(pref.partyId) &&
          String(p.channel) === String(pref.channel) &&
          String(p.scope) === String(pref.scope),
      );
      if (idx >= 0) preferences[idx] = pref;
      else preferences.push(pref);
    }

    if (event.type === PREFERENCE_EVENT_TYPES.PREFERENCE_REVOKED) {
      const { partyId, channel, scope } = payload;
      const idx = preferences.findIndex(
        (p) =>
          String(p.partyId) === String(partyId) &&
          String(p.channel) === String(channel) &&
          String(p.scope) === String(scope ?? "all"),
      );
      if (idx >= 0) {
        preferences[idx] = createCommunicationPreference({
          ...preferences[idx],
          status: "opt_out",
          recordedAt: event.timestampISO,
          source: payload.source ?? "revoked",
        });
      }
    }

    this.runtime._state = deepFreeze({ preferences: deepFreeze(preferences) });
    return this.runtime._state;
  }
}
