/**
 * Legacy ABC Property Group seed — test and demo fixture only.
 * Do not use as the default production company seed.
 */

import {
  createKnowledgeRepository,
} from "../../knowledge/KnowledgeRepository.js";
import { createBuiltInKnowledgeCategories } from "../../knowledge/categories/builtInCategories.js";
import { createCategoryRepository } from "../../knowledge/categories/CategoryRepository.js";
import { CompanyProfileBuilder } from "../profile/CompanyProfileBuilder.js";
import { createCompanyProfile } from "../profile/CompanyProfile.js";
import { BusinessProfileBuilder } from "../business-profile/BusinessProfileBuilder.js";
import { CommunicationSetupBuilder } from "../communication-setup/CommunicationSetupBuilder.js";
import { ConnectedSystemBuilder } from "../connected-systems/ConnectedSystemBuilder.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createABCPropertyGroupSeed() {
  /** @type {CompanyIdentity} */
  const identity = {
    companyName: "ABC Property Group",
    officeName: "Hartford Office",
    industry: "Property Management",
  };

  /** @type {CompanyEmployee[]} */
  const employees = [
    {
      employeeId: "emp_prop_interest",
      employeeName: "Property Interest Coordinator",
      role: "Buyer inquiry coordination",
      mission:
        "Recognize property inquiries, understand the property, prepare a recommendation, draft a buyer response, and create a review task.",
      status: "Working",
      statusQualifier: "Working through today’s buyer-ready drafts",
      todayCompletedCount: 4,
      todayAccomplishmentLine: "Prepared buyer response drafts for review.",
      approvalRatePercent: 92,
      approvalRateFootnote: "Based on recent approval outcomes.",
      currentWorkload: { inProgressCount: 2, waitingOnYouCount: 3 },
      capabilities: [
        "Property Summary",
        "Buyer Summary",
        "Draft responses",
        "Review buyer response",
      ],
      primaryActionLabel: "Open Employee",
      hoursSavedPerCompletedTask: 10.65,
    },
    {
      employeeId: "emp_marketing",
      employeeName: "Marketing Coordinator",
      role: "Buyer communication readiness",
      mission:
        "Prepare buyer-facing messaging that matches brand voice and keeps next steps clear and consistent.",
      status: "Working",
      statusQualifier: "Drafting future-ready messages",
      todayCompletedCount: 3,
      todayAccomplishmentLine: "Queued brand-ready messaging for review.",
      approvalRatePercent: 90,
      approvalRateFootnote: "Based on prior consistency checks.",
      currentWorkload: { inProgressCount: 1, waitingOnYouCount: 0 },
      capabilities: ["Brand voice", "Response preferences", "Scheduling guidance"],
      primaryActionLabel: "Open Employee",
      hoursSavedPerCompletedTask: 10.65,
    },
    {
      employeeId: "emp_leasing",
      employeeName: "Leasing Assistant",
      role: "Showing and follow-up coordination",
      mission:
        "Collect showing preferences and align next steps so buyers experience a smooth, guided timeline.",
      status: "Offline",
      statusQualifier: "Waiting on showing availability details",
      todayCompletedCount: 2,
      todayAccomplishmentLine: "Prepared follow-up prompts for later coordination.",
      approvalRatePercent: 88,
      approvalRateFootnote: "Based on successful follow-up outcomes.",
      currentWorkload: { inProgressCount: 0, waitingOnYouCount: 0 },
      capabilities: ["Showing rules", "Timing guidance", "Preference capture"],
      primaryActionLabel: "Open Employee",
      hoursSavedPerCompletedTask: 10.65,
    },
  ];

  /** @type {CompanyData} */
  const companyData = {
    properties: [
      {
        propertyId: "prop_68_mystic",
        address: "68 Mystic Meadow Lane",
        city: "Hartford",
        state: "CT",
        price: 615000,
        description:
          "A light-filled property with room to grow, ideally suited for buyers seeking a calm neighborhood and flexible layout.",
        highlights: [
          "Updated kitchen and open-plan living",
          "Natural light throughout",
          "Walkable to local amenities",
        ],
        considerations: [
          "Buyer may want to confirm closing timeline",
          "Potential HOA items require clarification",
          "Check zoning-related constraints for planned renovations",
        ],
      },
      {
        propertyId: "prop_15_oak",
        address: "15 Oak Street",
        city: "Hartford",
        state: "CT",
        price: 429000,
        description:
          "A quiet street setting with flexible layout options and a strong foundation for value-focused updates.",
        highlights: [
          "Quiet street setting",
          "Flexible layout for changing needs",
          "Strong potential for value-focused updates",
        ],
        considerations: [
          "Confirm buyer’s ideal move-in timeframe",
          "Clarify any questions on planned updates",
        ],
      },
      {
        propertyId: "prop_22_harbor_view",
        address: "22 Harbor View",
        city: "Hartford",
        state: "CT",
        price: 515000,
        description:
          "Comfortable living space with scenic views from key rooms and room to expand.",
        highlights: ["Scenic views from key rooms", "Comfortable living space with room to expand"],
        considerations: [
          "Confirm renovation goals and timing constraints",
          "Check whether external updates could affect next steps",
        ],
      },
    ],
    buyers: [
      {
        buyerId: "buyer_jordan",
        name: "John Smith",
        email: "jordan.lee@example.com",
        phone: "(555) 010-2211",
      },
      {
        buyerId: "buyer_sarah",
        name: "Sarah Johnson",
        email: "sarah.johnson@example.com",
        phone: "(555) 010-4422",
      },
      {
        buyerId: "buyer_michael",
        name: "Michael Davis",
        email: "michael.davis@example.com",
        phone: "(555) 010-7733",
      },
      {
        buyerId: "buyer_emily",
        name: "Emily Carter",
        email: "emily.carter@example.com",
        phone: "(555) 014-8872",
      },
      {
        buyerId: "buyer_olivia",
        name: "Olivia Chen",
        email: "olivia.chen@example.com",
        phone: "(555) 014-9931",
      },
    ],
    inquiries: [
      {
        inquiryId: "pm1",
        buyerId: "buyer_jordan",
        propertyId: "prop_68_mystic",
        message:
          "Hi team—I'm interested in the property and would love to discuss next steps today. Is there any urgent paperwork or timing I should know about?",
        submittedAtISO: "2026-06-25T12:15:00.000Z",
        status: "Needs Review",
        priority: "High",
        employeeName: "Property Interest Coordinator",
        createdTimeISO: "2026-06-25T13:15:00.000Z",
        queueVisible: true,
        draftResponseReady: true,
        responseTimeMinutes: 32,
      },
      {
        inquiryId: "pm2",
        buyerId: "buyer_sarah",
        propertyId: "prop_15_oak",
        message: "Thanks! I’d like to understand next steps and when we can schedule a walkthrough.",
        submittedAtISO: "2026-06-25T13:45:00.000Z",
        status: "Needs Review",
        priority: "High",
        employeeName: "Property Interest Coordinator",
        createdTimeISO: "2026-06-25T14:05:00.000Z",
        queueVisible: true,
        draftResponseReady: true,
        responseTimeMinutes: 44,
      },
      {
        inquiryId: "pm3",
        buyerId: "buyer_michael",
        propertyId: "prop_22_harbor_view",
        message: "Please share guidance on timing for a walkthrough and anything we should confirm upfront.",
        submittedAtISO: "2026-06-25T10:50:00.000Z",
        status: "Needs Review",
        priority: "Medium",
        employeeName: "Property Interest Coordinator",
        createdTimeISO: "2026-06-25T11:50:00.000Z",
        queueVisible: true,
        draftResponseReady: true,
        responseTimeMinutes: 51,
      },
      {
        inquiryId: "pm4",
        buyerId: "buyer_emily",
        propertyId: "prop_68_mystic",
        message: "We’re interested. Is there anything urgent we should know before making a decision?",
        submittedAtISO: "2026-06-25T09:30:00.000Z",
        status: "Approved",
        priority: "High",
        employeeName: "Property Interest Coordinator",
        createdTimeISO: "2026-06-25T10:10:00.000Z",
        queueVisible: false,
        draftResponseReady: true,
        responseTimeMinutes: 28,
      },
      {
        inquiryId: "pm5",
        buyerId: "buyer_olivia",
        propertyId: "prop_15_oak",
        message: "Could you confirm next steps and propose a day/time for a walkthrough?",
        submittedAtISO: "2026-06-25T08:20:00.000Z",
        status: "Completed",
        priority: "Low",
        employeeName: "Property Interest Coordinator",
        createdTimeISO: "2026-06-25T08:50:00.000Z",
        queueVisible: false,
        draftResponseReady: false,
        responseTimeMinutes: 37,
      },
    ],
  };

  const allEmployeeIds = employees.map((e) => e.employeeId);

  function normalizeKeywords(text) {
    return String(text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  const baseCreatedAtISO = "2026-06-20T00:00:00.000Z";
  const baseUpdatedAtISO = "2026-06-20T00:00:00.000Z";

  const companyProfile = createCompanyProfile(
    CompanyProfileBuilder.build({
      identity,
      profileOverrides: {
        metadata: {
          createdAtISO: baseCreatedAtISO,
          updatedAtISO: baseUpdatedAtISO,
          version: 1,
        },
      },
    }),
  );

  const businessProfile = BusinessProfileBuilder.build({
    companyProfile,
    overrides: { metadata: { createdAtISO: baseCreatedAtISO, updatedAtISO: baseUpdatedAtISO, version: 1 } },
    nowISO: baseUpdatedAtISO,
  });

  // Seed knowledge repository from the legacy compact knowledge values
  // so CompanyBrain and BrainSearch remain compatible.
  const knowledgeCategories = createCategoryRepository({
    items: createBuiltInKnowledgeCategories(),
  });

  const knowledgeRepository = createKnowledgeRepository({
    items: [
      {
        id: "kn_faq_respond_speed",
        title: "How quickly do you respond to inquiries?",
        description: "Draft responses are typically prepared within the same day window.",
        category: "FAQ",
        tags: ["faq"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.85,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("respond speed inquiries draft responses"),
        metadata: { legacyKey: "faqs[0]" },
      },
      {
        id: "kn_faq_walkthrough_confirmation",
        title: "What do you confirm before scheduling a walkthrough?",
        description:
          "We confirm key property details and the buyer’s preferred timing for next steps.",
        category: "FAQ",
        tags: ["faq"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.85,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("walkthrough confirmation confirm key property details timing next steps"),
        metadata: { legacyKey: "faqs[1]" },
      },

      {
        id: "kn_listing_policy_professional_structured",
        title: "Listing policy: professional and structured",
        description: "Keep responses professional and structured.",
        category: "POLICIES",
        tags: ["policy", "listing"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.8,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("listing policy professional structured"),
        metadata: { legacyKey: "listingPolicies[0]" },
      },
      {
        id: "kn_listing_policy_confirm_key_details",
        title: "Listing policy: confirm key property details",
        description: "Confirm key property details before moving into scheduling.",
        category: "POLICIES",
        tags: ["policy", "listing"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.8,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("listing policy confirm key property details scheduling"),
        metadata: { legacyKey: "listingPolicies[1]" },
      },

      {
        id: "kn_response_pref_calm_confident",
        title: "Response preference: calm and confident",
        description: "Use calm, confident language.",
        category: "POLICIES",
        tags: ["preference", "tone"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.8,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("response preference calm confident language"),
        metadata: { legacyKey: "responsePreferences[0]" },
      },
      {
        id: "kn_response_pref_next_step_choice",
        title: "Response preference: include next step the buyer can choose",
        description: "Always include the next step the buyer can choose.",
        category: "POLICIES",
        tags: ["preference", "next-step"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.8,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("response preference next step buyer choose"),
        metadata: { legacyKey: "responsePreferences[1]" },
      },

      {
        id: "kn_brand_voice_premium_calm_confident",
        title: "Brand voice: premium, calm, and confident",
        description: "Premium, calm, and confident guidance.",
        category: "BRAND_VOICE",
        tags: ["brand-voice"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.9,
        priority: "High",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("brand voice premium calm confident guidance"),
        metadata: { legacyKey: "brandVoice" },
      },

      {
        id: "kn_property_showing_confirm_windows",
        title: "Property showing rule: confirm preferred walkthrough windows",
        description: "Confirm preferred walkthrough windows before proposing times.",
        category: "PROPERTY_INFORMATION",
        tags: ["property", "showing"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.82,
        priority: "High",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("property showing rule confirm walkthrough windows proposing times"),
        metadata: { legacyKey: "propertyShowingRules[0]" },
      },

      {
        id: "kn_property_showing_brief_checklist",
        title: "Property showing rule: include a brief buyer checklist",
        description: "Include a brief checklist of what the buyer should prepare.",
        category: "PROPERTY_INFORMATION",
        tags: ["property", "showing", "checklist"],
        relationships: [],
        createdAt: baseCreatedAtISO,
        updatedAt: baseUpdatedAtISO,
        createdBy: "seed",
        updatedBy: "seed",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "industry_template:property-management",
        confidence: 0.82,
        priority: "Medium",
        industry: identity.industry,
        applicableEmployees: allEmployeeIds,
        searchKeywords: normalizeKeywords("property showing checklist buyer prepare"),
        metadata: { legacyKey: "propertyShowingRules[1]" },
      },
    ],
  });

  /** @type {CompanyIntegration[]} */
  const integrations = [
    { type: "website", connected: true, vendor: "Website Intake" },
    { type: "email", connected: false },
    { type: "crm", connected: false },
  ];

  /** @type {CompanyApprovalRule[]} */
  const approvalRules = [
    {
      ruleType: "outbound_buyer_communication_requires_approval",
      enabled: true,
      description:
        "Outbound buyer communication requires approval until governance confidence is established.",
    },
  ];

  const communicationSetup = CommunicationSetupBuilder.build({
    companyProfile,
    businessProfile,
    approvalRules,
    nowISO: baseUpdatedAtISO,
  });

  const connectedSystems = ConnectedSystemBuilder.buildSnapshot({
    integrations,
    knowledgeRepository,
    knowledgeCategories,
  });

  return deepFreeze({
    identity,
    employees,
    companyData,
    companyProfile,
    businessProfile,
    communicationSetup,
    connectedSystems,
    knowledgeRepository,
    knowledgeCategories,
    integrations,
    approvalRules,
    communications: [],
    customActivities: [],
  });
}
