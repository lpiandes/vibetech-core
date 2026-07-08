import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";
import { PROPERTY_MANAGEMENT_OPERATING_HOME_PRESENTATION } from "./PropertyManagementOperatingHomePresentation.js";
import { MCBRIDE_PEOPLE_FILTERS, relationshipLabelsFromRegistry } from "../config/mcbrideRelationshipRegistry.js";

/**
 * Property Management dashboard presentation — package-specific labels and pulse config.
 * Core reads this via installationResult / industry package executiveExperience.
 */
export const PROPERTY_MANAGEMENT_PORTFOLIO_SEMANTICS = deepFreeze({
  inquiryRequestTypes: ["PROSPECT_INQUIRY"],
  followUpWorkTypes: ["prospect_follow_up"],
});

export const PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION = deepFreeze({
  portfolioSemantics: PROPERTY_MANAGEMENT_PORTFOLIO_SEMANTICS,
  operatingHome: PROPERTY_MANAGEMENT_OPERATING_HOME_PRESENTATION,
  pulseMetrics: [
    { id: "new_inquiries", label: "New inquiries", source: "inbound_requests_open" },
    { id: "needs_attention", label: "Needs decision", source: "attention_count" },
    { id: "responses_sent", label: "Responses sent", source: "outbound_communications" },
    { id: "showings_active", label: "Showings active", source: "work_showing_open" },
    { id: "urgent_work", label: "Urgent work", source: "work_urgent_open" },
  ],
  requestTypeLabels: {
    PROSPECT_INQUIRY: "Inquiry",
    MAINTENANCE_REQUEST: "Maintenance request",
    OWNER_REQUEST: "Owner request",
  },
  workTypeLabels: {
    showing_coordination: "Showing coordination",
    maintenance_coordination: "Maintenance coordination",
    owner_response: "Owner approval",
    prospect_follow_up: "Prospect follow-up",
    vendor_follow_up: "Vendor follow-up",
    MAINTENANCE_REQUEST: "Maintenance request",
    OWNER_REQUEST: "Owner request",
    PROSPECT_INQUIRY: "Inquiry",
  },
  relationshipLabels: {
    ...relationshipLabelsFromRegistry(),
  },
  peopleFilters: MCBRIDE_PEOPLE_FILTERS,
  partyTypeLabels: {
    PERSON: "Person",
    ORGANIZATION: "Organization",
  },
  workStatusLabels: {
    new: "New",
    ready: "Ready",
    in_progress: "In progress",
    waiting: "Waiting",
    blocked: "Blocked",
    review_required: "Needs review",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  episodeTitleTemplates: {
    PROSPECT_INQUIRY: "Inquiry about {subject}",
    MAINTENANCE_REQUEST: "Maintenance at {subject}",
    OWNER_REQUEST: "Owner request — {party}",
    default: "{requestType} — {party}",
  },
  inboundSourceLabels: {
    website: "website",
    phone: "phone",
    form: "website form",
  },
  handledStepLabels: {
    party_identified: "Identified {party}",
    subject_matched: "Matched to {subject}",
    acknowledgment_sent: "Sent acknowledgment to {party}",
    qualification_captured: "Captured preferences from {party}",
    work_created: "Created {workType} work",
    work_assigned: "Assigned to {assignee}",
    audience_updated: "Updated relevant audiences",
  },
  businessStateHeadlines: {
    underControl: "Your business is operating",
    needsAttention: "Your business needs your attention",
  },
  businessControlLabels: {
    underControl: "Under control",
    needsAttention: "Needs your attention",
    atRisk: "At risk",
    setupIncomplete: "Setup incomplete",
  },
  operatingStateLabels: {
    new: "New",
    vibetechHandling: "In progress",
    waitingHuman: "Waiting on you",
    movingForward: "Moving forward",
    completed: "Completed today",
    blocked: "Blocked",
    handling: "In progress",
    monitoring: "Monitoring",
  },
  autonomousContinuationTitle: "VIBETech will keep moving",
  roleLabels: {
    resident_prospect_coordination: "Prospect & resident coordination",
    maintenance_coordination: "Maintenance coordination",
    owner_success: "Owner success",
  },
  workforceLabels: {
    ready: "READY",
    handling: "HANDLING",
    waitingOnYou: "WAITING ON YOU",
    blocked: "BLOCKED",
    openAssignments: "Open assignments",
    activeAutomations: "Active automations",
    nothingNeeded: "Nothing",
  },
  team: {
    pageDescription: "People and Digital Employees working in this business.",
    sections: {
      humanTeam: "Human team",
      pendingInvites: "Pending invitations",
      digitalWorkforce: "Digital workforce",
    },
    employeeDescriptions: {
      pm_resident_prospect_coordinator: "Handles prospect inquiries, follow-ups, and resident communication",
      pm_maintenance_coordinator: "Coordinates maintenance requests, vendors, and inspections",
      pm_owner_success_coordinator: "Supports owner communication, documents, and renewals",
    },
    statusLabels: {
      ACTIVE: "Ready",
      READY: "Ready",
      DEGRADED: "Needs setup",
      CONFIGURING: "Needs setup",
      UNAVAILABLE: "Blocked",
      BLOCKED: "Blocked",
      HANDLING: "Handling",
    },
    blockerLabels: {
      knowledge: "Upload required knowledge documents",
      connection: "Connect required business channels",
      capability: "Finish capability setup",
      integration_capability: "Connect external integration",
      approval: "Approval configuration needed",
    },
    emptyStates: {
      humanTeam: "Invite employees so they can access VIBETech and work with your digital employees.",
      digitalWorkforce: "Your digital employees will appear here once your business package is active.",
    },
  },
  knowledge: {
    pageDescription: "Documents and business instructions VIBETech uses to understand how this company works.",
    sections: {
      documents: "Business knowledge",
      helpsWith: "What this helps VIBETech do",
      setupNeeds: "Missing knowledge",
    },
    categoryLabels: {
      PM_LEASING: "Leasing",
      PM_RESIDENT_COMMUNICATION: "Resident communication",
      PM_MAINTENANCE: "Maintenance",
      PM_VENDORS: "Vendors",
      PM_OWNER_COMMUNICATION: "Owner communication",
      PM_RENEWALS: "Renewals",
      PM_COMPANY_POLICIES: "Company policies",
      PM_PROPERTIES_UNITS: "Properties and units",
      PM_INSPECTIONS: "Inspections",
      PM_APPLICATIONS: "Applications",
      PM_COMPLIANCE: "Compliance",
      PM_EMERGENCY: "Emergency procedures",
    },
    sourceTypeLabels: {
      PDF: "PDF",
      DOCX: "Word document",
      TXT: "Text file",
      MARKDOWN: "Markdown",
    },
    documentStatusLabels: {
      ready: "Ready",
      failed: "Needs attention",
    },
    extractionStatusLabels: {
      pending: "Extracting text",
      succeeded: "Text extracted",
      failed: "Extraction failed",
    },
    emptyStates: {
      documents: "Upload policies, procedures, and guides so VIBETech can support your Digital Employees.",
    },
    fallbackExplanation:
      "Uploaded documents are used to satisfy business knowledge setup for Digital Employees.",
    employeeHelpedLabel: "Knowledge requirements met",
    employeeNeedsLabel: "Still needs business knowledge",
  },
  integrations: {
    pageDescription: "Connect the systems VIBETech uses to operate this business.",
    sections: {
      required: "Required connections",
      connected: "Connected systems",
      available: "Available and coming soon",
    },
    connectionLabels: {
      business_email: {
        title: "Business email",
        purpose: "Send prospect acknowledgments and follow-up communication",
        unlocks: "Enables email for your Digital Employees",
        tier: "primary",
      },
      property_management_system: {
        title: "Property management software",
        purpose: "Sync properties, residents, leases, and work orders",
        unlocks: "Supports Maintenance Coordinator and property-aware workflows",
        tier: "primary",
        setupMode: "manual",
      },
      sms_channel: {
        title: "Text messaging",
        purpose: "Send and receive text messages with residents and prospects",
        unlocks: "Supports SMS for Maintenance Coordinator when available",
        tier: "coming_soon",
      },
      voice_channel: {
        title: "Phone",
        purpose: "Place and receive phone calls",
        unlocks: "Voice channel for future communication workflows",
        tier: "coming_soon",
      },
      calendar: {
        title: "Calendar",
        purpose: "Sync showings and appointments",
        unlocks: "Showing coordination and scheduling",
        tier: "coming_soon",
      },
      accounting: {
        title: "Accounting",
        purpose: "Connect accounting software",
        unlocks: "Financial record sync when available",
        tier: "coming_soon",
      },
      document_storage: {
        title: "Document storage",
        purpose: "Store leases, policies, and files",
        unlocks: "External document sync when available",
        tier: "coming_soon",
      },
    },
    statusLabels: {
      CONNECTED: "Connected",
      NOT_CONNECTED: "Not connected",
      CONFIGURING: "In progress",
      DEGRADED: "Needs attention",
      ERROR: "Needs attention",
      DISCONNECTED: "Disconnected",
    },
    requirementLabels: {
      required: "Required",
      recommended: "Recommended",
      optional: "Optional",
    },
    emptyStates: {
      required: "Required connections will appear here for your business package.",
      connected: "Connected systems will appear here once setup is complete.",
      available: "Additional integrations will appear here as they become available.",
    },
  },
  businessStateSummaryTemplates: {
    allInquiriesResponded: "VIBETech responded to all {inboundCount} new inquiries",
    partialInquiriesResponded: "VIBETech responded to {responsesCount} of {inboundCount} inquiries",
    showingsMoving: "{showingsActive} showings moving forward",
    showingMovingSingular: "1 showing moving forward",
    decisionsWaiting: "{decisionCount} decisions waiting on you",
    decisionWaitingSingular: "1 decision waiting on you",
    noUrgentOverdue: "no urgent work is overdue",
    overdueWork: "{overdueWork} overdue",
    workInProgress: "{movingWork} work item(s) in progress",
    monitoring: "VIBETech is monitoring your business. Activity will appear as operations run.",
    noExceptions: "No urgent exceptions.",
  },
});
