import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Map discovery integration needs onto post-install setup checklist step ids.
 */
export function deriveRequiredSetupSteps(integrationNeeds = []) {
  const needs = new Set((integrationNeeds ?? []).map((entry) => String(entry).toLowerCase()));
  const steps = [];

  if (needs.has("business_email") || needs.size === 0) {
    steps.push("email");
  }
  if (needs.has("calendar")) steps.push("calendar");
  if (needs.has("sms_channel") || needs.has("sms")) {
    steps.push("sms");
    steps.push("a2p_registration");
  }
  if (needs.has("voice_channel") || needs.has("voice") || needs.has("phone")) {
    steps.push("voice");
  }

  return deepFreeze([...new Set(steps)]);
}
