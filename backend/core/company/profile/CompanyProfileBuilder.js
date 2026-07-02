import { createCompanyProfileDefaults } from "./CompanyProfileDefaults.js";
import { CompanyProfileValidator } from "./CompanyProfileValidator.js";

function initialsFromName(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstTwo = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return firstTwo.join("");
}

function brandAbbreviationFromIndustry(industry) {
  const parts = String(industry ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.slice(0, 3).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function deriveSenderName({ companyName, primaryContact } = {}) {
  const contactName = String(primaryContact?.name ?? "").trim();
  if (contactName) return contactName;
  const base = String(companyName ?? "").trim();
  return base ? `${base} Team` : "Team";
}

function deriveEmailSignature({ senderName } = {}) {
  if (!senderName) return "";
  return `Thanks,\n${senderName}`;
}

function deriveEmailFooter({ companyName } = {}) {
  const name = String(companyName ?? "").trim();
  const year = new Date("2026-07-01T00:00:00.000Z").getUTCFullYear();
  return name ? `© ${year} ${name}. All rights reserved.` : "";
}

function deriveSmsSignature({ senderName } = {}) {
  if (!senderName) return "";
  return `${senderName}`;
}

function deriveDisplayTitle({ companyName, industry } = {}) {
  const cn = String(companyName ?? "").trim();
  const ind = String(industry ?? "").trim();
  return cn && ind ? `${cn} (${ind})` : cn || ind || "";
}

function buildProfile({ identity, profileOverrides } = {}) {
  const base = createCompanyProfileDefaults();

  const generalFromIdentity = {
    companyName: String(identity?.companyName ?? ""),
    industry: String(identity?.industry ?? ""),
    website: String(profileOverrides?.general?.website ?? ""),
    primaryContact: {
      name: String(profileOverrides?.general?.primaryContact?.name ?? ""),
      email: String(profileOverrides?.general?.primaryContact?.email ?? ""),
      phone: String(profileOverrides?.general?.primaryContact?.phone ?? ""),
    },
    address: {
      line1: String(profileOverrides?.general?.address?.line1 ?? ""),
      city: String(profileOverrides?.general?.address?.city ?? ""),
      state: String(profileOverrides?.general?.address?.state ?? ""),
      postalCode: String(profileOverrides?.general?.address?.postalCode ?? ""),
      country: String(profileOverrides?.general?.address?.country ?? ""),
    },
  };

  const senderName = deriveSenderName({
    companyName: generalFromIdentity.companyName,
    primaryContact: generalFromIdentity.primaryContact,
  });

  const emailSignature = deriveEmailSignature({ senderName });
  const emailFooter = deriveEmailFooter({ companyName: generalFromIdentity.companyName });
  const smsSignature = deriveSmsSignature({ senderName });

  const derived = {
    companyInitials: initialsFromName(generalFromIdentity.companyName),
    brandAbbreviation: brandAbbreviationFromIndustry(generalFromIdentity.industry),
    displayTitle: deriveDisplayTitle({
      companyName: generalFromIdentity.companyName,
      industry: generalFromIdentity.industry,
    }),
  };

  const built = {
    ...base,
    general: {
      ...base.general,
      ...generalFromIdentity,
    },
    communications: {
      ...base.communications,
      senderName,
      replyEmail: String(profileOverrides?.communications?.replyEmail ?? ""),
      emailSignature,
      emailFooter,
      smsSignature,
    },
    brand: {
      ...base.brand,
      logo: String(profileOverrides?.brand?.logo ?? ""),
      brandAssets: Array.isArray(profileOverrides?.brand?.brandAssets)
        ? profileOverrides.brand.brandAssets
        : base.brand.brandAssets,
      defaultLogoVariants: Array.isArray(profileOverrides?.brand?.defaultLogoVariants)
        ? profileOverrides.brand.defaultLogoVariants
        : base.brand.defaultLogoVariants,
      primaryColor: String(profileOverrides?.brand?.primaryColor ?? base.brand.primaryColor),
      secondaryColor: String(profileOverrides?.brand?.secondaryColor ?? base.brand.secondaryColor),
    },
    operations: {
      ...base.operations,
      timeZone: String(profileOverrides?.operations?.timeZone ?? base.operations.timeZone),
      businessHours: profileOverrides?.operations?.businessHours ?? base.operations.businessHours,
      officeLocations: Array.isArray(profileOverrides?.operations?.officeLocations)
        ? profileOverrides.operations.officeLocations
        : base.operations.officeLocations,
    },
    preferences: {
      ...base.preferences,
      defaultLanguage: String(profileOverrides?.preferences?.defaultLanguage ?? base.preferences.defaultLanguage),
      dateFormat: String(profileOverrides?.preferences?.dateFormat ?? base.preferences.dateFormat),
      timeFormat: String(profileOverrides?.preferences?.timeFormat ?? base.preferences.timeFormat),
      currency: String(profileOverrides?.preferences?.currency ?? base.preferences.currency),
    },
    derived,
  };

  const validation = CompanyProfileValidator.validate({ profile: built });

  return {
    ...built,
    metadata: {
      ...built.metadata,
      createdAtISO: String(profileOverrides?.metadata?.createdAtISO ?? built.metadata.createdAtISO ?? ""),
      updatedAtISO: String(profileOverrides?.metadata?.updatedAtISO ?? built.metadata.updatedAtISO ?? ""),
      version: Number(profileOverrides?.metadata?.version ?? built.metadata.version),
      completionStatus: validation.completionStatus,
      completionPercent: validation.completionPercent,
      validation: validation.validation,
    },
  };
}

export class CompanyProfileBuilder {
  /**
   * @param {object} params
   * @param {object} params.identity companyRuntime.getCompany() identity
   * @param {object=} params.profileOverrides optional partial overrides for future use
   */
  static build({ identity, profileOverrides } = {}) {
    if (!identity || typeof identity !== "object") {
      throw new Error("CompanyProfileBuilder.build requires `identity` object.");
    }
    return buildProfile({ identity, profileOverrides });
  }
}

