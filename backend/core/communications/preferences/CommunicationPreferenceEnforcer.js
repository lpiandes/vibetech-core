import { PREFERENCE_STATUSES } from "./CommunicationPreference.js";

/**
 * Universal enforcement boundary — blocks outbound when party has opted out.
 */
export function checkCommunicationPermitted({
  preferenceRuntime,
  partyId,
  channel,
  scope = "all",
} = {}) {
  if (!partyId) return { permitted: true, reason: null };

  const prefs = preferenceRuntime?.getPreferencesForParty?.(partyId) ?? [];
  const relevant = prefs.filter(
    (p) => String(p.channel) === String(channel) && (String(p.scope) === String(scope) || String(p.scope) === "all"),
  );

  const blocked = relevant.find((p) => p.status === "opt_out" || p.status === "suppressed");
  if (blocked) {
    return { permitted: false, reason: `communication_not_permitted:${blocked.status}` };
  }

  const optedIn = relevant.find((p) => p.status === "opt_in");
  if (relevant.length > 0 && !optedIn && scope === "marketing") {
    return { permitted: false, reason: "communication_not_permitted:no_marketing_opt_in" };
  }

  return { permitted: true, reason: null };
}

export { PREFERENCE_STATUSES };
