/**
 * Browser-safe VibeKeep onboarding constants and A2P field helpers.
 * Keep Stripe/billing imports out of this file so client components can use it.
 */
export const VIBEKEEP_OPS_EMAIL = "leopiandes@vtechdevelopment.com";
export const VIBEKEEP_SUPPORT_FROM = "VIBETech Support <support@vtechdevelopment.com>";
export const VIBEKEEP_OPS_PHONE_DISPLAY = "603-818-2383";
export const VIBEKEEP_OPS_PHONE_E164 = "+16038182383";
export const VIBEKEEP_AGREEMENT_VERSION = "2026-08-14";

/** Defaults for 10DLC campaign URLs when the agency has no page of their own yet. */
export const VIBEKEEP_DEFAULT_PRIVACY_URL = "https://vtechdevelopment.com/privacy.html";
export const VIBEKEEP_DEFAULT_TERMS_URL = "https://vtechdevelopment.com/terms.html";

/**
 * VibeKeep does not use keyword subscribe by default — agents upload consented numbers.
 * Leave opt-in keywords blank in Twilio unless the agency supports text-to-join.
 */
export const VIBEKEEP_DEFAULT_OPT_IN_KEYWORDS = "";

/** Sample auto-reply if an agency later enables START/UNSTOP keyword opt-in. */
export const VIBEKEEP_DEFAULT_OPT_IN_MESSAGE =
  "You are opted in to policy reminders from {agency}. Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel.";

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
    privacyPolicyUrl: "",
    termsUrl: "",
    optInKeywords: "",
    optInMessage: "",
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

function normalizeHttpUrl(value) {
  const raw = safeString(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(safeString(value));
}

export function feA2pProfileIsComplete(profile = {}) {
  const p = normalizeFeA2pProfile(profile);
  const ein = digitsOnly(p.ein);
  const keywords = safeString(p.optInKeywords);
  const optInMessageOk = !keywords || (
    safeString(p.optInMessage).length >= 20
    && safeString(p.optInMessage).length <= 320
  );
  return Boolean(
    safeString(p.legalBusinessName)
    && safeString(p.businessType)
    && ein.length >= 9
    && safeString(p.businessIndustry)
    && isHttpUrl(p.websiteUrl)
    && isHttpUrl(p.privacyPolicyUrl)
    && isHttpUrl(p.termsUrl)
    && optInMessageOk
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
  next.websiteUrl = normalizeHttpUrl(next.websiteUrl);
  next.privacyPolicyUrl = normalizeHttpUrl(next.privacyPolicyUrl);
  next.termsUrl = normalizeHttpUrl(next.termsUrl);
  next.optInKeywords = safeString(next.optInKeywords);
  next.optInMessage = safeString(next.optInMessage);
  return next;
}

export function defaultFeA2pOptInMessage(agencyName = "") {
  const agency = safeString(agencyName) || "your agency";
  return VIBEKEEP_DEFAULT_OPT_IN_MESSAGE.replace("{agency}", agency);
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
    `Privacy policy: ${p.privacyPolicyUrl}`,
    `Terms: ${p.termsUrl}`,
    `Opt-in keywords: ${p.optInKeywords || "(none — clients opt in by consent when the agent adds them)"}`,
    `Opt-in message: ${p.optInMessage || "(n/a — no keyword opt-in)"}`,
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
