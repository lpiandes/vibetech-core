/**
 * Map VibeKeep A2P signup profile → Twilio brand/campaign payload.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  DEFAULT_FE_RETENTION_TEMPLATES,
  renderFeTemplate,
} from "./FeRetentionTemplates.js";
import {
  defaultFeA2pOptInMessage,
  normalizeFeA2pProfile,
  VIBEKEEP_DEFAULT_PRIVACY_URL,
  VIBEKEEP_DEFAULT_TERMS_URL,
} from "./FeRetentionOnboardingCatalog.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * Build Twilio A2P brand fields from a VibeKeep onboarding profile.
 */
export function mapFeA2pProfileToTwilioBrand(profile = {}) {
  const p = normalizeFeA2pProfile(profile);
  const agency = safeString(p.legalBusinessName) || "Agency";
  const sampleVars = {
    firstName: "Alex",
    carrier: "Carrier",
    reminderDays: 3,
    docsArriveDays: 10,
  };
  const welcome = renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.welcome, sampleVars);
  const lapse = renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.lapseRecovery, sampleVars);
  const reminder = renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.paymentReminder, sampleVars);

  const keywords = safeString(p.optInKeywords);
  const messageFlow = keywords
    ? `Customers opt in by texting ${keywords} to this number or by providing their mobile number when the agent adds them to the book with consent. They can reply STOP to opt out or HELP for help.`
    : "Customers opt in when the insurance agent adds their mobile number to VibeKeep with consent to receive policy-related texts (welcome, payment reminders, lapse recovery). They can reply STOP to opt out or HELP for help.";

  return deepFreeze({
    legalBusinessName: agency,
    dba: agency,
    ein: safeString(p.ein),
    website: safeString(p.websiteUrl),
    businessType: safeString(p.businessType),
    businessIndustry: safeString(p.businessIndustry || "INSURANCE"),
    contactFirstName: safeString(p.contactFirstName),
    contactLastName: safeString(p.contactLastName),
    contactEmail: safeString(p.contactEmail),
    contactPhone: safeString(p.contactPhone),
    contactTitle: safeString(p.businessTitle),
    campaignUseCase: "CUSTOMER_CARE",
    campaignDescription:
      `${agency} sends policy-related customer care texts to existing clients: welcome messages, payment reminders, birthday/holiday greetings, and lapse recovery when a payment is missed. Messages are not marketing blasts.`,
    messageFlow,
    messageSamples: [welcome, lapse, reminder].filter(Boolean),
    messageSample1: welcome,
    messageSample2: lapse,
    privacyPolicyUrl: safeString(p.privacyPolicyUrl) || VIBEKEEP_DEFAULT_PRIVACY_URL,
    termsUrl: safeString(p.termsUrl) || VIBEKEEP_DEFAULT_TERMS_URL,
    hasEmbeddedLinks: false,
    hasEmbeddedPhone: false,
    optInMessage: safeString(p.optInMessage) || defaultFeA2pOptInMessage(agency),
  });
}
