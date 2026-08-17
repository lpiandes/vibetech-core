/**
 * Browser-safe VibeKeep onboarding constants and A2P field helpers.
 * Keep Stripe/billing imports out of this file so client components can use it.
 */
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

export function feA2pProfileIsComplete(profile = {}) {
  const p = normalizeFeA2pProfile(profile);
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
  if (next.websiteUrl && !/^https?:\/\//i.test(next.websiteUrl)) {
    next.websiteUrl = `https://${next.websiteUrl}`;
  }
  return next;
}

export function feRetentionSetupPath(businessId) {
  return `/insurance/setup/${encodeURIComponent(String(businessId))}`;
}

export function feRetentionAgreementPath(businessId) {
  return `/insurance/setup/${encodeURIComponent(String(businessId))}/agreement`;
}

export function feRetentionAgreementPdfHref(businessId) {
  return `/api/insurance/${encodeURIComponent(String(businessId))}/agreement-pdf`;
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
