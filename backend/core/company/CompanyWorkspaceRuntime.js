/**
 * CompanyWorkspaceRuntime
 *
 * SSOT for the Company Workspace UI.
 *
 * Constraints:
 * - In-memory only
 * - Deterministic business objects
 * - No network calls
 * - No APIs
 * - No provider/runtime pipeline changes
 */

import { CompanyEventEngine } from "./events/CompanyEventEngine.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function isoToDateKey(iso) {
  // Stable day key in UTC for deterministic “today” metrics.
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function minutesToMs(min) {
  return min * 60 * 1000;
}

function addMsToISO(iso, ms) {
  const d = new Date(iso);
  return new Date(d.getTime() + ms).toISOString();
}

/**
 * @typedef {object} CompanyIdentity
 * @property {string} companyName
 * @property {string=} officeName
 * @property {string} industry
 */

/**
 * @typedef {object} CompanyEmployee
 * @property {string} employeeId
 * @property {string} employeeName
 * @property {string} role
 * @property {string} mission
 * @property {"Working"|"Needs Review"|"Approved"|"Completed"|"Offline"} status
 * @property {string} statusQualifier
 * @property {number} todayCompletedCount
 * @property {string} todayAccomplishmentLine
 * @property {number} approvalRatePercent
 * @property {string} approvalRateFootnote
 * @property {{inProgressCount:number, waitingOnYouCount:number}} currentWorkload
 * @property {string[]} capabilities
 * @property {string} primaryActionLabel
 * @property {number=} hoursSavedPerCompletedTask
 */

/**
 * @typedef {object} CompanyData
 * @property {Array<{propertyId:string,address:string,city:string,state:string,price:number,description:string,highlights:string[],considerations:string[]}>} properties
 * @property {Array<{buyerId:string,name:string,email:string,phone:string}>} buyers
 * @property {Array<{
 *   inquiryId:string,
 *   buyerId:string,
 *   propertyId:string,
 *   message:string,
 *   submittedAtISO:string,
 *   status:"Needs Review"|"Approved"|"Completed",
 *   priority:"High"|"Medium"|"Low",
 *   employeeName:string,
 *   createdTimeISO:string,
 *   queueVisible:boolean,
 *   draftResponseReady:boolean,
 *   responseTimeMinutes?:number
 * }>} inquiries
 */

/**
 * @typedef {object} CompanyKnowledge
 * @property {Array<{question:string,answer:string}>} faqs
 * @property {string[]} listingPolicies
 * @property {string[]} responsePreferences
 * @property {string} brandVoice
 * @property {string[]} propertyShowingRules
 */

/**
 * @typedef {object} CompanyIntegration
 * @property {string} type
 * @property {boolean} connected
 * @property {string=} vendor
 */

/**
 * @typedef {object} CompanyApprovalRule
 * @property {string} ruleType
 * @property {boolean} enabled
 * @property {string} description
 */

function createABCPropertyGroupSeed() {
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

  /** @type {CompanyKnowledge} */
  const knowledge = {
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
  };

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

  return deepFreeze({
    identity,
    employees,
    companyData,
    knowledge,
    integrations,
    approvalRules,
    customActivities: [],
  });
}

export class CompanyWorkspaceRuntime {
  constructor({ seed = createABCPropertyGroupSeed } = {}) {
    this._state = seed();
    // Derived caches (still immutable) for determinism.
    this._workQueue = deepFreeze(this._deriveWorkQueue());
    this._activities = deepFreeze(this._deriveActivities());
    this._metrics = deepFreeze(this._deriveMetrics());
  }

  getCompany() {
    return this._state.identity;
  }

  getEmployees() {
    return this._state.employees;
  }

  getCompanyData() {
    return this._state.companyData;
  }

  getKnowledge() {
    return {
      faqs: this._state.knowledge.faqs,
      listingPolicies: this._state.knowledge.listingPolicies,
      responsePreferences: this._state.knowledge.responsePreferences,
      brandVoice: this._state.knowledge.brandVoice,
      propertyShowingRules: this._state.knowledge.propertyShowingRules,
    };
  }

  getIntegrations() {
    return this._state.integrations;
  }

  getApprovalRules() {
    return this._state.approvalRules;
  }

  getWorkQueue() {
    return this._workQueue;
  }

  getActivities() {
    return this._activities;
  }

  getMetrics() {
    return this._metrics;
  }

  _deriveWorkQueue() {
    const { buyers, properties, inquiries } = this._state.companyData;

    const buyerById = new Map(buyers.map((b) => [b.buyerId, b]));
    const propertyById = new Map(properties.map((p) => [p.propertyId, p]));

    /** @type {Array<{workItemId:string,title:string,clientName:string,matterType:string,priority:"High"|"Medium"|"Low",status:"Needs Review"|"Approved"|"Completed",assignedEmployeeName:string,createdTimeISO:string}>} */
    const items = inquiries
      .filter((i) => i.queueVisible)
      .map((i) => {
        const buyer = buyerById.get(i.buyerId);
        const property = propertyById.get(i.propertyId);

        const propertyLabel = property
          ? `${property.address} (${property.city}, ${property.state})`
          : "Property";

        return {
          workItemId: i.inquiryId,
          title: i.draftResponseReady ? "Draft response" : "Draft in progress",
          clientName: buyer?.name ?? "Buyer",
          matterType: propertyLabel,
          priority: i.priority,
          status: i.status,
          assignedEmployeeName: i.employeeName,
          createdTimeISO: i.createdTimeISO,
        };
      });

    // Deterministic ordering: newest first by createdTimeISO.
    items.sort(
      (a, b) => new Date(b.createdTimeISO).getTime() - new Date(a.createdTimeISO).getTime(),
    );

    return items;
  }

  _deriveActivities() {
    const { buyers, properties, inquiries } = this._state.companyData;
    const buyerById = new Map(buyers.map((b) => [b.buyerId, b]));
    const propertyById = new Map(properties.map((p) => [p.propertyId, p]));

    /** @type {Array<{timestampISO:string, employee:string, action:string, object:string, status:string}>} */
    const activities = [];

    const customActivities = Array.isArray(this._state.customActivities)
      ? this._state.customActivities
      : [];
    activities.push(...customActivities);

    for (const inquiry of inquiries) {
      const buyer = buyerById.get(inquiry.buyerId);
      const property = propertyById.get(inquiry.propertyId);
      const employee = inquiry.employeeName;

      const objectLabel = property
        ? property.address
        : "Property";

      activities.push({
        timestampISO: inquiry.submittedAtISO,
        employee,
        action: "Received Inquiry",
        object: buyer?.name ?? "Buyer",
        status: "Recorded",
      });

      activities.push({
        timestampISO: inquiry.createdTimeISO,
        employee,
        action: "Reviewed Property",
        object: objectLabel,
        status: "Reviewed",
      });

      if (inquiry.draftResponseReady) {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(1)),
          employee,
          action: "Prepared Draft",
          object: objectLabel,
          status: "Ready for review",
        });
      }

      if (inquiry.status === "Needs Review" && inquiry.draftResponseReady) {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(2)),
          employee,
          action: "Waiting For Approval",
          object: objectLabel,
          status: "Pending governance",
        });
      }

      if (inquiry.status === "Approved") {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(2)),
          employee,
          action: "Approved",
          object: objectLabel,
          status: "Approved",
        });

        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(3)),
          employee,
          action: "Email Sent",
          object: buyer?.name ?? "Buyer",
          status: "Delivered",
        });
      }

      if (inquiry.status === "Completed") {
        activities.push({
          timestampISO: addMsToISO(inquiry.createdTimeISO, minutesToMs(2)),
          employee,
          action: "Completed",
          object: objectLabel,
          status: "Done",
        });
      }
    }

    activities.sort(
      (a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime(),
    );

    return activities;
  }

  _deriveMetrics() {
    const { inquiries } = this._state.companyData;
    const employees = this._state.employees;

    const dayKey = (() => {
      const sorted = [...inquiries].sort(
        (a, b) => new Date(b.createdTimeISO).getTime() - new Date(a.createdTimeISO).getTime(),
      );
      return isoToDateKey(sorted[0]?.createdTimeISO ?? new Date().toISOString());
    })();

    const pendingReviews = inquiries.filter(
      (i) => i.status === "Needs Review" && i.draftResponseReady,
    ).length;

    const completedToday = inquiries.filter((i) => {
      const key = isoToDateKey(i.createdTimeISO);
      return key === dayKey && (i.status === "Approved" || i.status === "Completed");
    }).length;

    const activeEmployees = employees.filter(
      (e) => e.status === "Working" || e.status === "Needs Review",
    ).length;

    const hoursSavedToday = employees.reduce((sum, e) => {
      const rate = typeof e.hoursSavedPerCompletedTask === "number"
        ? e.hoursSavedPerCompletedTask
        : 0;
      return sum + e.todayCompletedCount * rate;
    }, 0);

    return {
      pendingReviews,
      completedToday,
      hoursSavedToday,
      activeEmployees,
    };
  }

  applyEvent(event) {
    // Delegation is the only permitted runtime mutation path.
    const engine = new CompanyEventEngine({ runtime: this });
    engine.apply(event);
  }
}

