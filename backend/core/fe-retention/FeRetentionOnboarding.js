/**
 * VibeKeep post-pay onboarding: A2P brand fields, then signed engagement agreement.
 * Every book with dashboard access (including pre-Stripe “legacy” books) must complete this.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { readFeRetentionBilling } from "./FeRetentionBilling.js";
import {
  VIBEKEEP_AGREEMENT_VERSION,
  emptyFeA2pProfile,
  feA2pProfileIsComplete,
  feRetentionAgreementPath,
  feRetentionSetupPath,
  normalizeFeA2pProfile,
} from "./FeRetentionOnboardingCatalog.js";

export {
  FE_A2P_BUSINESS_TYPES,
  FE_A2P_INDUSTRIES,
  FE_A2P_JOB_POSITIONS,
  VIBEKEEP_AGREEMENT_VERSION,
  VIBEKEEP_OPS_EMAIL,
  VIBEKEEP_SUPPORT_FROM,
  VIBEKEEP_OPS_PHONE_DISPLAY,
  VIBEKEEP_OPS_PHONE_E164,
  emptyFeA2pProfile,
  feA2pProfileIsComplete,
  feRetentionAgreementPath,
  feRetentionSetupPath,
  formatFeA2pProfileForOps,
  normalizeFeA2pProfile,
  feRetentionAgreementPdfHref,
} from "./FeRetentionOnboardingCatalog.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function readFeRetentionOnboarding(packageConfiguration = {}) {
  const raw = packageConfiguration?.feRetentionOnboarding;
  if (!raw || typeof raw !== "object") {
    return deepFreeze({
      skipsGate: false,
      profile: emptyFeA2pProfile(),
      profileCompletedAt: null,
      agreement: null,
      completedAt: null,
      profileComplete: false,
      agreementComplete: false,
      onboardingComplete: false,
    });
  }
  const profile = { ...emptyFeA2pProfile(), ...(raw.profile && typeof raw.profile === "object" ? raw.profile : {}) };
  const profileComplete = feA2pProfileIsComplete(profile);
  const signedName = safeString(raw.agreement?.signedName);
  const signedAt = safeString(raw.agreement?.signedAt);
  const agreementComplete = Boolean(signedName && signedAt);
  return deepFreeze({
    skipsGate: false,
    profile,
    profileCompletedAt: raw.profileCompletedAt ? String(raw.profileCompletedAt) : null,
    agreement: raw.agreement && typeof raw.agreement === "object" ? {
      signedName,
      signedAt,
      signerIp: safeString(raw.agreement.signerIp) || null,
      documentVersion: safeString(raw.agreement.documentVersion) || VIBEKEEP_AGREEMENT_VERSION,
    } : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    profileComplete,
    agreementComplete,
    onboardingComplete: profileComplete && agreementComplete,
  });
}

export function writeFeRetentionOnboarding(packageConfiguration = {}, patch = {}) {
  const prev = readFeRetentionOnboarding(packageConfiguration);
  const nextProfile = patch.profile
    ? normalizeFeA2pProfile({ ...prev.profile, ...patch.profile })
    : prev.profile;
  const profileComplete = feA2pProfileIsComplete(nextProfile);
  const nextAgreement = patch.agreement !== undefined ? patch.agreement : prev.agreement;
  const agreementComplete = Boolean(nextAgreement?.signedName && nextAgreement?.signedAt);
  const completedAt = (profileComplete && agreementComplete)
    ? (prev.completedAt || new Date().toISOString())
    : null;
  return {
    ...(packageConfiguration && typeof packageConfiguration === "object" ? packageConfiguration : {}),
    feRetentionOnboarding: {
      profile: nextProfile,
      profileCompletedAt: profileComplete
        ? (prev.profileCompletedAt || new Date().toISOString())
        : null,
      agreement: nextAgreement,
      completedAt,
    },
  };
}

export function feRetentionMayProvisionSms(packageConfiguration = {}) {
  const billing = readFeRetentionBilling(packageConfiguration);
  if (!billing.allowsDashboard) return false;
  return readFeRetentionOnboarding(packageConfiguration).onboardingComplete;
}

export function resolveFeRetentionContinuePath({ businessId, packageConfiguration } = {}) {
  const id = String(businessId || "");
  const billing = readFeRetentionBilling(packageConfiguration);
  if (!billing.allowsDashboard) {
    return `/insurance/billing?businessId=${encodeURIComponent(id)}`;
  }
  const onboarding = readFeRetentionOnboarding(packageConfiguration);
  if (onboarding.onboardingComplete) {
    return `/insurance/${id}`;
  }
  if (!onboarding.profileComplete) return feRetentionSetupPath(id);
  return feRetentionAgreementPath(id);
}
