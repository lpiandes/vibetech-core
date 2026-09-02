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
 *
 * Campaign description must pass TCR 30886: who sends, who receives, why —
 * not just how consent is collected.
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
  const welcome = `${agency}: ${renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.welcome, sampleVars)} Reply HELP for help.`;
  const docs = `${agency}: ${renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.docsMail, sampleVars)} Reply HELP for help.`;
  const reminder = `${agency}: ${renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.paymentReminder, sampleVars)} Reply HELP for help.`;
  const lapse = `${agency}: ${renderFeTemplate(DEFAULT_FE_RETENTION_TEMPLATES.lapseRecovery, sampleVars)} Reply HELP for help.`;

  const privacy = safeString(p.privacyPolicyUrl) || VIBEKEEP_DEFAULT_PRIVACY_URL;
  const terms = safeString(p.termsUrl) || VIBEKEEP_DEFAULT_TERMS_URL;
  const website = safeString(p.websiteUrl);
  const keywords = safeString(p.optInKeywords);

  const consentUrl = website
    ? ` Clients may also review SMS disclosures on the agency website (${website}).`
    : "";

  const messageFlow = keywords
    ? `${agency} collects SMS consent when existing clients text ${keywords} to this number, or when an agent adds the client's mobile number to the agency book after the client agrees to receive policy-related texts. Consent is optional and not required to purchase or keep insurance. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Privacy Policy: ${privacy}. Terms: ${terms}.${consentUrl}`
    : `${agency} collects SMS consent when an insurance agent adds an existing client's mobile number to the agency book after the client agrees to receive policy-related texts (welcome, document notices, payment reminders, and lapse recovery). Consent is optional and not required to purchase or keep insurance. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Privacy Policy: ${privacy}. Terms: ${terms}.${consentUrl}`;

  return deepFreeze({
    legalBusinessName: agency,
    dba: agency,
    ein: safeString(p.ein),
    website,
    businessType: safeString(p.businessType),
    businessIndustry: safeString(p.businessIndustry || "INSURANCE"),
    contactFirstName: safeString(p.contactFirstName),
    contactLastName: safeString(p.contactLastName),
    contactEmail: safeString(p.contactEmail),
    contactPhone: safeString(p.contactPhone),
    contactTitle: safeString(p.businessTitle),
    // LOW_VOLUME fits small agencies sending mixed transactional care texts.
    campaignUseCase: "LOW_VOLUME",
    campaignDescription:
      `${agency} sends transactional customer-care SMS to its existing insurance policyholders who opted in. `
      + "Messages cover policy welcome notices, physical document delivery updates, upcoming payment reminders, "
      + "and lapse-recovery follow-ups when a payment may have been missed. "
      + "These texts are for policy servicing and client care only — not promotional marketing or lead generation.",
    messageFlow,
    messageSamples: [welcome, docs, reminder, lapse].filter(Boolean).slice(0, 5),
    messageSample1: welcome,
    messageSample2: lapse,
    privacyPolicyUrl: privacy,
    termsUrl: terms,
    hasEmbeddedLinks: false,
    hasEmbeddedPhone: false,
    optInMessage: safeString(p.optInMessage) || defaultFeA2pOptInMessage(agency),
    helpMessage:
      `${agency}: Reply STOP to unsubscribe, HELP for help. Msg & data rates may apply. `
      + "For assistance contact your agent or visit the agency website.",
  });
}
