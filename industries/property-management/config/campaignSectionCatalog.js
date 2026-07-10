import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";
import { createCampaignSection } from "../../../backend/core/campaigns/CampaignDocument.js";

export const PM_CAMPAIGN_SECTION_TYPES = deepFreeze([
  {
    id: "intro",
    label: "Introduction",
    fields: ["heading", "body"],
    description: "Opening greeting and context.",
  },
  {
    id: "custom_text",
    label: "Custom text",
    fields: ["heading", "body"],
    description: "Freeform paragraph block.",
  },
  {
    id: "property_feature",
    label: "Property feature",
    fields: ["heading", "body", "subjectId"],
    description: "Highlight a canonical property or listing.",
  },
  {
    id: "market_update",
    label: "Market update",
    fields: ["heading", "body"],
    description: "Informational market commentary.",
  },
  {
    id: "educational_content",
    label: "Educational content",
    fields: ["heading", "body"],
    description: "Helpful guidance for clients.",
  },
  {
    id: "home_value_cma",
    label: "Home value / CMA",
    fields: ["heading", "body", "ctaText"],
    description: "Informational CMA conversation starter.",
  },
  {
    id: "referral_request",
    label: "Referral request",
    fields: ["heading", "body", "ctaText"],
    description: "Ask for introductions from qualifying relationships.",
  },
  {
    id: "call_to_action",
    label: "Call to action",
    fields: ["ctaText", "ctaUrl", "body"],
    description: "Primary reply or next-step prompt.",
  },
  {
    id: "contact_signature",
    label: "Contact signature",
    fields: ["heading", "body"],
    description: "Closing signature and contact details.",
  },
]);

const SECTION_TYPE_IDS = new Set(PM_CAMPAIGN_SECTION_TYPES.map((entry) => entry.id));

export function isSupportedCampaignSectionType(type) {
  return SECTION_TYPE_IDS.has(String(type ?? ""));
}

export function getCampaignSectionTypeDefinition(type) {
  return PM_CAMPAIGN_SECTION_TYPES.find((entry) => entry.id === String(type)) ?? null;
}

function section(id, type, order, fields) {
  return createCampaignSection({ id, type, order, fields });
}

/**
 * Immutable package recipes that seed editable CampaignDocuments.
 */
export function buildPackageCampaignSectionRecipe(template, { subject = null } = {}) {
  const templateId = String(template?.id ?? "");
  const cta = String(template?.cta ?? "Reply if you would like to talk through next steps.");
  const propertyName = subject?.displayName ? String(subject.displayName) : null;

  if (templateId === "property_announcement") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Property update",
        body: propertyName
          ? `You are receiving this draft because there is canonical interest linked to ${propertyName}.`
          : "You are receiving this draft because there is canonical property interest on record.",
      }),
      section("sec_property", "property_feature", 1, {
        heading: propertyName || "Featured property",
        body: propertyName
          ? `Details for ${propertyName} are based on the canonical BusinessSubject record.`
          : "Select a property to feature evidence-backed listing details.",
        subjectId: subject?.id ? String(subject.id) : null,
      }),
      section("sec_cta", "call_to_action", 2, { ctaText: cta, body: null, ctaUrl: null }),
      section("sec_signature", "contact_signature", 3, {
        heading: null,
        body: "— The McBride team",
      }),
    ]);
  }

  if (templateId === "cma_home_value") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Home value conversation",
        body: "The McBride team can prepare an informational CMA conversation if that would be useful.",
      }),
      section("sec_cma", "home_value_cma", 1, {
        heading: "Informational only",
        body: "This is not a guaranteed appraisal or valuation; it is a starting point for a real conversation using approved context.",
        ctaText: cta,
      }),
      section("sec_signature", "contact_signature", 2, {
        heading: null,
        body: "— The McBride team",
      }),
    ]);
  }

  if (templateId === "referral_outreach") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Checking in",
        body: "We are checking in with past clients and referral relationships where there is real relationship history in the business record.",
      }),
      section("sec_referral", "referral_request", 1, {
        heading: "Referral question",
        body: "If someone you know could use a conversation with the team, we would welcome an introduction.",
        ctaText: cta,
      }),
      section("sec_signature", "contact_signature", 2, {
        heading: null,
        body: "— The McBride team",
      }),
    ]);
  }

  if (templateId === "monthly_market_update") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Monthly market update",
        body: "Here is a draft informational update prepared from canonical relationship and business evidence.",
      }),
      section("sec_market", "market_update", 1, {
        heading: "Market notes",
        body: "Add approved market commentary before sending. Do not present unsupported market statistics.",
      }),
      section("sec_cta", "call_to_action", 2, { ctaText: cta }),
      section("sec_signature", "contact_signature", 3, {
        heading: null,
        body: "— The McBride team",
      }),
    ]);
  }

  if (templateId === "weekly_newsletter" || templateId === "past_client_reactivation") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: templateId === "past_client_reactivation" ? "Checking in" : "This week's update",
        body: "Here is a draft update prepared from canonical relationship and business evidence.",
      }),
      section("sec_custom", "custom_text", 1, {
        heading: "Highlights",
        body: "Add the relationship update you want recipients to review.",
      }),
      section("sec_edu", "educational_content", 2, {
        heading: "Helpful context",
        body: "Optional educational notes can be added here.",
      }),
      section("sec_cta", "call_to_action", 3, { ctaText: cta }),
      section("sec_signature", "contact_signature", 4, {
        heading: null,
        body: "— The McBride team",
      }),
    ]);
  }

  return deepFreeze([
    section("sec_intro", "intro", 0, {
      heading: String(template?.name ?? "Campaign"),
      body: "Here is a draft update prepared from canonical relationship and business evidence.",
    }),
    section("sec_custom", "custom_text", 1, {
      heading: null,
      body: "Add campaign content here.",
    }),
    section("sec_cta", "call_to_action", 2, { ctaText: cta }),
    section("sec_signature", "contact_signature", 3, {
      heading: null,
      body: "— The McBride team",
    }),
  ]);
}

export function defaultSubjectLineForTemplate(template, subject = null) {
  if (subject?.displayName && String(template?.id) === "property_announcement") {
    return `${subject.displayName}: property update`;
  }
  return String(template?.defaultSubject ?? template?.name ?? "Business update");
}
