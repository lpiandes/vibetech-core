/**
 * VibeKeep post-pay onboarding: A2P brand fields, then signed engagement agreement.
 * Every book with dashboard access (including pre-Stripe “legacy” books) must complete this.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { readFeRetentionBilling } from "./FeRetentionBilling.js";

export const VIBEKEEP_OPS_EMAIL = "leopiandes@vtechdevelopment.com";
export const VIBEKEEP_OPS_PHONE_DISPLAY = "603-818-2383";
export const VIBEKEEP_OPS_PHONE_E164 = "+16038182383";
export const VIBEKEEP_AGREEMENT_VERSION = "2026-08-14";

export const FE_A2P_BUSINESS_TYPES = Object.freeze([
  "Limited Liability Corporation",
  "Corporation",
  "Sole Proprietorship",
  "Partnership",
  "Co-operative",
  "Non-profit Corporation",
]);

export const FE_A2P_INDUSTRIES = Object.freeze([
  "INSURANCE",
  "FINANCIAL",
  "PROFESSIONAL_SERVICES",
  "HEALTHCARE",
  "TECHNOLOGY",
  "OTHER",
]);

export const FE_A2P_JOB_POSITIONS = Object.freeze([
  "CEO",
  "CFO",
  "Director",
  "GM",
  "VP",
  "General Counsel",
  "Other",
]);

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function digitsOnly(v) {
  return safeString(v).replace(/\D/g, "");
}

export function emptyFeA2pProfile() {
  return {
    legalBusinessName: "",
    businessType: "",
    businessRegistrationIdType: "EIN",
    ein: "",
    businessIndustry: "INSURANCE",
    websiteUrl: "",
    regions: ["USA_AND_CANADA"],
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
    notifyEmail: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    businessTitle: "",
    contactPhone: "",
    jobPosition: "",
    preferredAreaCode: "",
  };
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

export function feA2pProfileIsComplete(profile = {}) {
  const p = { ...emptyFeA2pProfile(), ...(profile || {}) };
  const ein = digitsOnly(p.ein);
  const url = safeString(p.websiteUrl);
  const hasUrl = /^https?:\/\//i.test(url);
  return Boolean(
    safeString(p.legalBusinessName)
    && safeString(p.businessType)
    && ein.length >= 9
    && safeString(p.businessIndustry)
    && hasUrl
    && safeString(p.street)
    && safeString(p.city)
    && safeString(p.region)
    && safeString(p.postalCode)
    && safeString(p.notifyEmail).includes("@")
    && safeString(p.contactFirstName)
    && safeString(p.contactLastName)
    && safeString(p.contactEmail).includes("@")
    && safeString(p.businessTitle)
    && digitsOnly(p.contactPhone).length >= 10
    && safeString(p.jobPosition)
    && /^\d{3}$/.test(digitsOnly(p.preferredAreaCode)),
  );
}

export function normalizeFeA2pProfile(input = {}) {
  const base = emptyFeA2pProfile();
  const next = { ...base };
  for (const key of Object.keys(base)) {
    if (key === "regions") {
      const raw = Array.isArray(input.regions) ? input.regions : base.regions;
      next.regions = raw.map((r) => String(r)).filter(Boolean);
      if (!next.regions.length) next.regions = ["USA_AND_CANADA"];
      continue;
    }
    if (input[key] != null) next[key] = safeString(input[key]);
  }
  next.ein = digitsOnly(next.ein);
  next.contactPhone = digitsOnly(next.contactPhone);
  next.preferredAreaCode = digitsOnly(next.preferredAreaCode).slice(0, 3);
  next.postalCode = safeString(next.postalCode);
  return next;
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

export function feRetentionSetupPath(businessId) {
  return `/insurance/setup/${encodeURIComponent(String(businessId))}`;
}

export function feRetentionAgreementPath(businessId) {
  return `/insurance/setup/${encodeURIComponent(String(businessId))}/agreement`;
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

export function formatFeA2pProfileForOps(profile = {}) {
  const p = normalizeFeA2pProfile(profile);
  return [
    `Legal name: ${p.legalBusinessName}`,
    `Type: ${p.businessType}`,
    `EIN: ${p.ein}`,
    `Industry: ${p.businessIndustry}`,
    `Website: ${p.websiteUrl}`,
    `Regions: ${(p.regions || []).join(", ")}`,
    `Address: ${p.street}, ${p.city}, ${p.region} ${p.postalCode} ${p.country}`,
    `Notify email: ${p.notifyEmail}`,
    `Authorized rep: ${p.contactFirstName} ${p.contactLastName}`,
    `Title: ${p.businessTitle} (${p.jobPosition})`,
    `Rep email: ${p.contactEmail}`,
    `Rep phone: ${p.contactPhone}`,
    `Preferred area code: ${p.preferredAreaCode || "—"}`,
  ].join("\n");
}
