export type CompanyIndustryId =
  | "Property Management"
  | "Dentist"
  | "Med Spa"
  | "HVAC"
  | "Roofing";

export type CompanyIntegrationType =
  | "website"
  | "email"
  | "calendar"
  | "crm"
  | "phone"
  | "documents"
  | "payments";

export type CompanyApprovalRuleType = "outbound_buyer_communication_requires_approval";

export type CompanyIdentity = {
  companyName: string;
  officeName?: string;
  industry: CompanyIndustryId;
};

export type CompanyEmployee = {
  employeeId: string;
  employeeName: string;
  role: string;
  mission: string;
  status: "Working" | "Needs Review" | "Approved" | "Completed" | "Offline";
  statusQualifier: string;

  todayCompletedCount: number;
  todayAccomplishmentLine: string;

  approvalRatePercent: number;
  approvalRateFootnote: string;

  workload: {
    inProgressCount: number;
    waitingOnYouCount: number;
  };

  capabilities: string[]; // 3-5 chips
  primaryActionLabel: string;
};

export type CompanyProperty = {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  price: number;
  description: string;
  highlights: string[];
  considerations: string[];
};

export type CompanyBuyer = {
  buyerId: string;
  name: string;
  email: string;
  phone: string;
};

export type CompanyInquiry = {
  inquiryId: string;
  buyerId: string;
  propertyId: string;
  message: string;
  submittedAtISO: string;
  status: "Needs Review" | "Approved" | "Completed";
  priority: "High" | "Medium" | "Low";
  employeeName: string;
  createdTimeISO: string;

  // Rendering helpers for the workspace (business-level only).
  queueVisible: boolean;
  draftResponseReady: boolean;
  responseTimeMinutes?: number;
};

export type CompanyData = {
  properties: CompanyProperty[];
  buyers: CompanyBuyer[];
  inquiries: CompanyInquiry[];

  hoursSavedToday: number;
};

export type CompanyKnowledge = {
  faqs: { question: string; answer: string }[];
  listingPolicies: string[];
  responsePreferences: string[];
  brandVoice: string;
  propertyShowingRules: string[];
};

export type CompanyIntegration = {
  type: CompanyIntegrationType;
  connected: boolean;
  vendor?: string; // friendly label, never required for employees to function
};

export type CompanyApprovalRule = {
  ruleType: CompanyApprovalRuleType;
  enabled: boolean;
  description: string;
};

export type Company = {
  identity: CompanyIdentity;
  employees: CompanyEmployee[];
  companyData: CompanyData;
  companyKnowledge: CompanyKnowledge;
  integrations: CompanyIntegration[];
  approvalRules: CompanyApprovalRule[];
};

