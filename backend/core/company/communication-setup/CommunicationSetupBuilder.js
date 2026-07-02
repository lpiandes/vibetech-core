import { createCommunicationSetupDefaults } from "./CommunicationSetupDefaults.js";
import { validateCommunicationSetup } from "./CommunicationSetupValidator.js";
import { createCommunicationSetup } from "./CommunicationSetup.js";

function normalizeStr(v) {
  return String(v ?? "").trim();
}

function buildSenderIdentity({ companyProfile } = {}) {
  const senderName = normalizeStr(companyProfile?.communications?.senderName);
  const replyEmail = normalizeStr(companyProfile?.communications?.replyEmail);
  const senderEmail = replyEmail; // current sprint uses replyEmail as senderEmail until separate identity exists.
  const displayName = senderName;
  return {
    senderName,
    replyEmail,
    senderEmail,
    displayName,
  };
}

function buildEmailBranding({ companyProfile } = {}) {
  const logo = normalizeStr(companyProfile?.brand?.logo);
  const primaryColor = normalizeStr(companyProfile?.brand?.primaryColor);
  const secondaryColor = normalizeStr(companyProfile?.brand?.secondaryColor);
  const emailSignature = normalizeStr(companyProfile?.communications?.emailSignature);
  const emailFooter = normalizeStr(companyProfile?.communications?.emailFooter);
  return {
    logo,
    primaryColor,
    secondaryColor,
    emailSignature,
    emailFooter,
    brandedHeaderEnabled: Boolean(logo) && Boolean(primaryColor) && Boolean(secondaryColor),
  };
}

function buildSmsIdentity({ companyProfile, businessProfile, communicationDefaults } = {}) {
  const senderName = normalizeStr(companyProfile?.communications?.senderName);
  const smsSignature = normalizeStr(companyProfile?.communications?.smsSignature);
  const businessName = normalizeStr(companyProfile?.general?.companyName);
  const optOutLanguage = normalizeStr(businessProfile?.languagesSupported?.[0]) || normalizeStr(communicationDefaults?.defaultLanguage);

  return {
    smsSignature,
    businessName,
    optOutLanguage,
    quietHours: communicationDefaults?.quietHours,
  };
}

function buildApprovalPolicy({ approvalRules } = {}) {
  const rule = Array.isArray(approvalRules)
    ? approvalRules.find(
        (r) =>
          r &&
          r.ruleType === "outbound_buyer_communication_requires_approval" &&
          r.enabled === true,
      )
    : null;

  return {
    approvalRequiredForFirstContact: Boolean(rule),
    rulePresent: Boolean(rule),
    ruleType: rule?.ruleType ? String(rule.ruleType) : "",
    ruleDescription: rule?.description ? String(rule.description) : "",
  };
}

function deterministicISO(nowISO) {
  return typeof nowISO === "string" ? new Date(nowISO).toISOString() : new Date().toISOString();
}

export class CommunicationSetupBuilder {
  static build({ companyProfile, businessProfile, approvalRules = [], nowISO } = {}) {
    if (!companyProfile || typeof companyProfile !== "object") {
      throw new Error("CommunicationSetupBuilder.build requires companyProfile.");
    }
    if (!businessProfile || typeof businessProfile !== "object") {
      throw new Error("CommunicationSetupBuilder.build requires businessProfile.");
    }
    if (!nowISO) throw new Error("CommunicationSetupBuilder.build requires deterministic nowISO.");

    const defaultsBase = createCommunicationSetupDefaults({
      businessHours: companyProfile?.operations?.businessHours,
      timeZone: companyProfile?.operations?.timeZone,
    });

    const approvalPolicy = buildApprovalPolicy({ approvalRules });

    const communicationDefaults = {
      defaultTone: defaultsBase.defaultTone,
      defaultLanguage: String(businessProfile?.languagesSupported?.[0] ?? companyProfile?.preferences?.defaultLanguage ?? ""),
      timeZone: String(companyProfile?.operations?.timeZone ?? ""),
      businessHours: companyProfile?.operations?.businessHours ?? {},
      approvalRequiredForFirstContact: approvalPolicy.approvalRequiredForFirstContact,
      preferredChannels: defaultsBase.preferredChannels,
      quietHours: defaultsBase.quietHours,
    };

    const sender = buildSenderIdentity({ companyProfile });
    const emailBranding = buildEmailBranding({ companyProfile });

    const smsIdentity = buildSmsIdentity({
      companyProfile,
      businessProfile,
      communicationDefaults,
    });

    const quietHours = defaultsBase.quietHours;

    const metadata = deepFreeze({
      version: 1,
      generatedAt: deterministicISO(nowISO),
      approvalPolicy,
      validation: null,
      completionPercent: 0,
    });

    const rawSetup = {
      version: "1",
      sender,
      emailBranding,
      smsIdentity,
      communicationDefaults,
      quietHours,
      readiness: {
        emailReady: false,
        smsReady: false,
        brandReady: false,
        quietHoursReady: false,
        approvalPolicyReady: false,
      },
      metadata: {
        generatedAt: deterministicISO(nowISO),
        version: 1,
        validation: { ok: false, issues: [] },
        completionPercent: 0,
        approvalPolicy,
      },
    };

    const { validation, readiness, completionPercent, completionStatus } = validateCommunicationSetup({
      setup: {
        ...rawSetup,
        metadata: { ...(rawSetup.metadata ?? {}), approvalPolicy },
      },
    });

    const finalSetup = {
      ...rawSetup,
      readiness,
      metadata: {
        ...rawSetup.metadata,
        generatedAt: deterministicISO(nowISO),
        validation: validation,
        completionPercent,
        completionStatus,
      },
    };

    return createCommunicationSetup({
      ...finalSetup,
      metadata: finalSetup.metadata,
      quietHours: finalSetup.quietHours,
      readiness,
      emailBranding: finalSetup.emailBranding,
      sender,
      smsIdentity: finalSetup.smsIdentity,
      communicationDefaults: finalSetup.communicationDefaults,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

