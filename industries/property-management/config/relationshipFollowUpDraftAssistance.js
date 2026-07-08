export const PM_RELATIONSHIP_FOLLOW_UP_DRAFT_ASSISTANCE = Object.freeze([
  {
    id: "pm_buyer_follow_up_email",
    relationshipTypes: ["BUYER"],
    channel: "email",
    knowledgeCategoryIds: ["PM_LEASING"],
    subjectTemplate: "Following up on {{propertyName}}",
    bodyTemplate:
      "Hi {{personName}},\n\nI wanted to follow up on your interest in {{propertyName}}. {{qualificationLine}}{{knowledgeLine}}\n\nWould you like us to help with the next step?\n\nThanks,\nMcBride Real Estate",
    guidance:
      "Keep the follow-up specific to the buyer relationship, property context, and any approved leasing guidance.",
  },
  {
    id: "pm_seller_prospect_follow_up_email",
    relationshipTypes: ["SELLER_PROSPECT"],
    channel: "email",
    knowledgeCategoryIds: ["PM_OWNER_COMMUNICATION"],
    subjectTemplate: "Following up on your real estate goals",
    bodyTemplate:
      "Hi {{personName}},\n\nI wanted to follow up on your selling timeline. {{qualificationLine}}{{knowledgeLine}}\n\nWould it be helpful to talk through next steps?\n\nThanks,\nMcBride Real Estate",
    guidance: "Use seller-prospect terminology and keep the message consultative.",
  },
  {
    id: "pm_investor_follow_up_email",
    relationshipTypes: ["INVESTOR"],
    channel: "email",
    knowledgeCategoryIds: ["PM_LEASING", "PM_OWNER_COMMUNICATION"],
    subjectTemplate: "Following up on investment property interest",
    bodyTemplate:
      "Hi {{personName}},\n\nI wanted to follow up on your investment property interest{{propertyClause}}. {{qualificationLine}}{{knowledgeLine}}\n\nWould you like to review options or criteria together?\n\nThanks,\nMcBride Real Estate",
    guidance: "Use investor terminology and include canonical property context when available.",
  },
  {
    id: "pm_prospect_follow_up_email",
    relationshipTypes: ["PROSPECT"],
    channel: "email",
    knowledgeCategoryIds: ["PM_LEASING"],
    subjectTemplate: "Following up with McBride Real Estate",
    bodyTemplate:
      "Hi {{personName}},\n\nI wanted to follow up and see how we can help. {{qualificationLine}}{{knowledgeLine}}\n\nWould you like to share what you are looking for next?\n\nThanks,\nMcBride Real Estate",
    guidance: "Use qualification context without overstating interest that is not canonical.",
  },
]);
