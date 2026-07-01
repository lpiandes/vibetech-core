import type { Company } from "./companyTypes";

export const demoCompany: Company = {
  identity: {
    companyName: "ABC Property Group",
    officeName: "Hartford Office",
    industry: "Property Management",
  },
  employees: [
    {
      employeeId: "emp_prop_interest",
      employeeName: "Property Interest Coordinator",
      role: "Buyer inquiry coordination",
      mission:
        "Recognize property inquiries, understand the property, prepare a recommendation, draft a buyer response, and create a review task.",
      status: "Working",
      statusQualifier: "Working through today’s buyer-ready drafts",
      todayCompletedCount: 4,
      todayAccomplishmentLine:
        "Prepared buyer response drafts for governance review.",
      approvalRatePercent: 92,
      approvalRateFootnote: "Based on recent approval outcomes.",
      workload: {
        inProgressCount: 2,
        waitingOnYouCount: 3,
      },
      capabilities: [
        "Property Summary",
        "Buyer Summary",
        "Draft responses",
        "Review buyer response",
      ],
      primaryActionLabel: "Open Employee",
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
      workload: { inProgressCount: 1, waitingOnYouCount: 0 },
      capabilities: ["Brand voice", "Response preferences", "Scheduling guidance"],
      primaryActionLabel: "Open Employee",
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
      workload: { inProgressCount: 0, waitingOnYouCount: 0 },
      capabilities: ["Showing rules", "Timing guidance", "Preference capture"],
      primaryActionLabel: "Open Employee",
    },
  ],
  companyData: {
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
        highlights: [
          "Scenic views from key rooms",
          "Comfortable living space with room to expand",
        ],
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
        message:
          "Thanks! I’d like to understand next steps and when we can schedule a walkthrough.",
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
        message:
          "Please share guidance on timing for a walkthrough and anything we should confirm upfront.",
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
        message:
          "We’re interested. Is there anything urgent we should know before making a decision?",
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
        message:
          "Could you confirm next steps and propose a day/time for a walkthrough?",
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
    hoursSavedToday: 42.6,
  },
  companyKnowledge: {
    faqs: [
      {
        question: "How quickly do you respond to inquiries?",
        answer: "Draft responses are typically prepared within the same day window.",
      },
      {
        question: "What do you confirm before scheduling a walkthrough?",
        answer:
          "We confirm key property details and the buyer’s preferred timing for next steps.",
      },
    ],
    listingPolicies: [
      "Keep responses professional and structured.",
      "Confirm key property details before moving into scheduling.",
    ],
    responsePreferences: [
      "Use calm, confident language.",
      "Always include the next step the buyer can choose.",
    ],
    brandVoice: "Premium, calm, and confident guidance.",
    propertyShowingRules: [
      "Confirm preferred walkthrough windows before proposing times.",
      "Include a brief checklist of what the buyer should prepare.",
    ],
  },
  integrations: [
    { type: "website", connected: true, vendor: "Website Intake" },
    { type: "email", connected: false, vendor: undefined },
    { type: "crm", connected: false, vendor: undefined },
  ],
  approvalRules: [
    {
      ruleType: "outbound_buyer_communication_requires_approval",
      enabled: true,
      description:
        "Outbound buyer communication requires approval until governance confidence is established.",
    },
  ],
};

