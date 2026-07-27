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
  if (needs.has("google_search_console") || needs.has("seo")) steps.push("google_search_console");
  if (needs.has("google_ads")) steps.push("google_ads");
  // One Meta account unlocks two distinct functions: campaign management and
  // lead-form intake. Show both functions in setup, never as two account picks.
  if (needs.has("meta_ads") || needs.has("facebook_ads") || needs.has("meta_platform")) steps.push("meta_ads");
  if (needs.has("meta_lead_ads") || needs.has("meta_platform")) steps.push("meta_lead_ads");

  return deepFreeze([...new Set(steps)]);
}
