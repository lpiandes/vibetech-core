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
    description: "Highlight a listing.",
  },
  {
    id: "market_update",
    label: "Market update",
    fields: ["heading", "body"],
    description: "Market commentary.",
  },
  {
    id: "educational_content",
    label: "Extra note",
    fields: ["heading", "body"],
    description: "Optional tip or note.",
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
  const signature = "— The team";

  if (templateId === "property_announcement") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Property update",
        body: propertyName
          ? `Quick update on ${propertyName}.`
          : "Quick update on a property you asked about.",
      }),
      section("sec_property", "property_feature", 1, {
        heading: propertyName || "Featured property",
        body: propertyName
          ? `Here is what we can share about ${propertyName}.`
          : "Add the listing details you want to share.",
        subjectId: subject?.id ? String(subject.id) : null,
      }),
      section("sec_cta", "call_to_action", 2, { ctaText: cta, body: null, ctaUrl: null }),
      section("sec_signature", "contact_signature", 3, {
        heading: null,
        body: signature,
      }),
    ]);
  }

  if (templateId === "cma_home_value") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Home value",
        body: "Happy to walk through an informational home-value conversation if that would help.",
      }),
      section("sec_cma", "home_value_cma", 1, {
        heading: "Informational only",
        body: "This is not a formal appraisal — just a starting point for a conversation.",
        ctaText: cta,
      }),
      section("sec_signature", "contact_signature", 2, {
        heading: null,
        body: signature,
      }),
    ]);
  }

  if (templateId === "referral_outreach") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Checking in",
        body: "Hope you are doing well — we wanted to stay in touch.",
      }),
      section("sec_referral", "referral_request", 1, {
        heading: "Quick ask",
        body: "If someone you know could use a conversation with our team, we would welcome an introduction.",
        ctaText: cta,
      }),
      section("sec_signature", "contact_signature", 2, {
        heading: null,
        body: signature,
      }),
    ]);
  }

  if (templateId === "monthly_market_update") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: "Monthly update",
        body: "A short market note for you this month.",
      }),
      section("sec_market", "market_update", 1, {
        heading: "Market notes",
        body: "Add the market notes you want to share.",
      }),
      section("sec_cta", "call_to_action", 2, { ctaText: cta }),
      section("sec_signature", "contact_signature", 3, {
        heading: null,
        body: signature,
      }),
    ]);
  }

  if (templateId === "weekly_newsletter" || templateId === "past_client_reactivation") {
    return deepFreeze([
      section("sec_intro", "intro", 0, {
        heading: templateId === "past_client_reactivation" ? "Checking in" : "This week",
        body: templateId === "past_client_reactivation"
          ? "Hope you are doing well — a quick note from our team."
          : "Here is this week’s update.",
      }),
      section("sec_custom", "custom_text", 1, {
        heading: "Highlights",
        body: "Add what you want people to know.",
      }),
      section("sec_cta", "call_to_action", 2, { ctaText: cta }),
      section("sec_signature", "contact_signature", 3, {
        heading: null,
        body: signature,
      }),
    ]);
  }

  return deepFreeze([
    section("sec_intro", "intro", 0, {
      heading: String(template?.name ?? "Update"),
      body: "Here is a short update.",
    }),
    section("sec_custom", "custom_text", 1, {
      heading: null,
      body: "Add your message here.",
    }),
    section("sec_cta", "call_to_action", 2, { ctaText: cta }),
    section("sec_signature", "contact_signature", 3, {
      heading: null,
      body: signature,
    }),
  ]);
}

export function defaultSubjectLineForTemplate(template, subject = null) {
  if (subject?.displayName && String(template?.id) === "property_announcement") {
    return `${subject.displayName}: property update`;
  }
  return String(template?.defaultSubject ?? template?.name ?? "Business update");
}
