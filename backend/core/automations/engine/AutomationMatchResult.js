import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createAutomationMatchResult({
  event,
  matchedAutomations,
  skippedAutomations,
} = {}) {
  const res = deepFreeze({
    eventId: String(event?.eventId ?? ""),
    eventType: String(event?.eventType ?? ""),
    matchedAutomations: deepFreeze(Array.isArray(matchedAutomations) ? matchedAutomations : []),
    skippedAutomations: deepFreeze(Array.isArray(skippedAutomations) ? skippedAutomations : []),
  });
  return res;
}
