/**
 * Resolve who receives lapse/missed agent alerts for a VibeKeep book.
 * Defaults come from the A2P signup form; agency can override in Settings.
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

export function resolveFeBookAgentDisplayName({
  packageConfiguration = null,
  ownerMembership = null,
  businessName = "",
} = {}) {
  const profile = readFeRetentionOnboarding(packageConfiguration ?? {}).profile;
  const fromProfile = [profile.contactFirstName, profile.contactLastName]
    .map((part) => safeString(part))
    .filter(Boolean)
    .join(" ");
  if (fromProfile) return fromProfile;
  const ownerName = safeString(ownerMembership?.userName);
  if (ownerName) return ownerName;
  const ownerEmail = safeString(ownerMembership?.email);
  if (ownerEmail.includes("@")) return ownerEmail.split("@")[0];
  return safeString(businessName) || "Agency";
}

/**
 * Keep Settings notify email/phone synced with A2P signup until the agency edits them.
 * Overwrites stale platform-admin emails saved during early testing.
 */
export function seedFeAgentNotifySettings(state, packageConfiguration = {}) {
  const onboarding = readFeRetentionOnboarding(packageConfiguration);
  const fromProfile = agentNotifyFromOnboardingProfile(onboarding.profile);
  const customized = Boolean(state?.settings?.agentNotifyCustomized);
  if (customized || (!fromProfile.agentNotifyEmail && !fromProfile.agentNotifyPhone)) {
    return { state, seeded: false, patch: null };
  }
  const patch = {};
  if (fromProfile.agentNotifyEmail) patch.agentNotifyEmail = fromProfile.agentNotifyEmail;
  if (fromProfile.agentNotifyPhone) patch.agentNotifyPhone = fromProfile.agentNotifyPhone;
  if (!Object.keys(patch).length) {
    return { state, seeded: false, patch: null };
  }
  return {
    state: updateFeSettings(state, { ...patch, agentNotifyCustomized: false }),
    seeded: true,
    patch,
  };
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
