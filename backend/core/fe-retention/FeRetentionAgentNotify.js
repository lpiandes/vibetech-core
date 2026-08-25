/**
 * Resolve who receives lapse/missed agent alerts for a VibeKeep book.
 * Never fall back to the platform admin's session email.
 */
import { readFeRetentionOnboarding } from "./FeRetentionOnboarding.js";
import { normalizeFePhone, updateFeSettings } from "./FeRetentionStore.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function agentNotifyFromOnboardingProfile(profile = {}) {
  return {
    agentNotifyEmail: safeString(profile.notifyEmail),
    agentNotifyPhone: normalizeFePhone(profile.contactPhone),
  };
}

/** Copy A2P notify email/phone into book settings when still blank. */
export function seedFeAgentNotifySettings(state, packageConfiguration = {}) {
  const onboarding = readFeRetentionOnboarding(packageConfiguration);
  const fromProfile = agentNotifyFromOnboardingProfile(onboarding.profile);
  const patch = {};
  if (!safeString(state?.settings?.agentNotifyEmail) && fromProfile.agentNotifyEmail) {
    patch.agentNotifyEmail = fromProfile.agentNotifyEmail;
  }
  if (!safeString(state?.settings?.agentNotifyPhone) && fromProfile.agentNotifyPhone) {
    patch.agentNotifyPhone = fromProfile.agentNotifyPhone;
  }
  if (!Object.keys(patch).length) {
    return { state, seeded: false, patch: null };
  }
  return { state: updateFeSettings(state, patch), seeded: true, patch };
}

export async function resolveFeAgentNotifyContacts({
  platformStore = null,
  businessId = "",
  business = null,
  state = null,
} = {}) {
  const packageConfiguration = business?.packageConfiguration ?? {};
  const seeded = seedFeAgentNotifySettings(state ?? {}, packageConfiguration);
  let nextState = seeded.state;
  let email = safeString(nextState.settings?.agentNotifyEmail);
  let phone = normalizeFePhone(nextState.settings?.agentNotifyPhone);

  const id = safeString(businessId || business?.id);
  if (!email && platformStore?.getOwnerMembership && id) {
    const owner = await platformStore.getOwnerMembership(id).catch(() => null);
    email = safeString(owner?.email);
  }

  return {
    email,
    phone,
    state: nextState,
    seeded: seeded.seeded,
  };
}
