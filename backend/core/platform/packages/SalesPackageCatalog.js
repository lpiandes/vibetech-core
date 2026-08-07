import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  buildDefaultLeadFollowUpEmployee,
  buildDefaultAppointmentSetterEmployee,
  buildDefaultSalesAssistantEmployee,
  buildDefaultCrmAutomationEmployee,
  buildDefaultReceptionistEmployee,
  buildDefaultSupportVoiceEmployee,
  buildDefaultSchedulingVoiceEmployee,
  buildDefaultSocialScreenerEmployee,
} from "./thinSkuDefaultEmployees.js";

/**
 * Commercial sales-sheet packages (à la carte SKUs).
 * Checked at Create & invite; scopes discovery, install modules, and nav.
 *
 * Empty / missing purchasedPackages = full OS behavior (legacy businesses).
 */

/** Topics every scoped build still needs so the LLM can personalize. */
export const SALES_PACKAGE_ALWAYS_TOPICS = Object.freeze([
  "identity",
  "industry",
  "services",
  "outcomes",
]);

/**
 * Vertical / alias module ids that satisfy a catalog entitlement.
 * Catalog id → installed module ids that count as that entitlement.
 */
const MODULE_ALIAS_GROUPS = Object.freeze({
  people: Object.freeze(["people", "players"]),
  for_you: Object.freeze(["for_you", "intelligence", "needs_attention"]),
  schedule: Object.freeze(["schedule", "appointments", "calendar"]),
  digital_workforce: Object.freeze(["digital_workforce", "team"]),
  pipelines: Object.freeze(["pipelines"]),
  automations: Object.freeze(["automations"]),
  integrations: Object.freeze(["integrations"]),
  work: Object.freeze(["work"]),
  knowledge: Object.freeze(["knowledge"]),
  inbox: Object.freeze(["inbox"]),
  home: Object.freeze(["home"]),
  settings: Object.freeze(["settings"]),
  performance: Object.freeze(["performance", "reports"]),
});

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   description: string,
 *   fullOs?: boolean,
 *   moduleIds: string[] | null,
 *   canonicalNavIds: string[] | null,
 *   discoveryTopics: string[] | null,
 *   packageAskQuestionIds?: string[] | null,
 *   packageAskConnectionOptions?: string[] | null,
 *   launchMissionIds?: string[] | null,
 *   honestyNote?: string | null,
 *   commercialStatus?: "product" | "managed_product" | "roadmap" | "human_service",
 *   sellable?: boolean,
 *   maxWorkers?: number | null,
 *   maxWorkflows?: number | null,
 * }} SalesPackage
 */

/** @type {SalesPackage[]} */
export const SALES_PACKAGE_CATALOG = Object.freeze([
  {
    id: "ai_business_os",
    label: "AI Business Operating System",
    description: "Full Architect → pack → Launch. Entire workspace.",
    fullOs: true,
    moduleIds: null,
    canonicalNavIds: null,
    discoveryTopics: null,
    launchMissionIds: null,
    honestyNote: "Engine entitlement only — not sold as the customer-facing product. Use Managed Revenue Follow-Through for design partners.",
    commercialStatus: "product",
    sellable: false,
  },
  {
    id: "managed_revenue_follow_through",
    label: "Managed Revenue Follow-Through",
    description: "Primary beachhead offer — VIBETech owns follow-through ops with evidence-backed outcomes. Includes Today, Decisions, Outcomes, Company Rules, and minimum integrations.",
    moduleIds: ["home", "for_you", "work", "knowledge", "integrations", "settings", "schedule"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "outcomes",
      "knowledge",
      "work",
      "calendar",
      "integrations",
      "settings",
    ],
    discoveryTopics: [
      "identity",
      "industry",
      "services",
      "customers",
      "communications",
      "integrations",
      "outcomes",
    ],
    launchMissionIds: [
      "customer_email_send",
      "knowledge_consult",
      "outbound_approvals",
      "website_forms",
    ],
    honestyNote: "Managed ops retainer delivering Revenue Follow-Through — not à-la-carte module shopping.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkers: 3,
    maxWorkflows: 5,
  },
  {
    id: "ai_receptionist",
    label: "AI Receptionist",
    description: "Inbound phone answers from Knowledge; call notes in People. Booking requests create appointment Work and a calendar HOLD when Calendar is connected.",
    moduleIds: ["home", "knowledge", "integrations", "people", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "automations", "integrations", "settings"],
    discoveryTopics: [
      "identity",
      "industry",
      "services",
      "operations",
      "communications",
      "integrations",
      "outcomes",
    ],
    packageAskQuestionIds: ["q_communications", "q_integrations", "q_desired_outcomes"],
    packageAskConnectionOptions: ["twilio_voice"],
    launchMissionIds: ["knowledge_consult", "voice_calls", "outbound_approvals"],
    honestyNote: "Knowledge-backed inbound. Booking → appointment Work + calendar HOLD when Google Calendar is connected (team confirms).",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "voice_inbound_agent",
    label: "AI Inbound Call Agent",
    description: "Specialized inbound voice scripts (sales / support / scheduling intents).",
    moduleIds: ["home", "knowledge", "integrations", "people", "work", "settings"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "automations", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "integrations", "outcomes"],
    packageAskConnectionOptions: ["twilio_voice"],
    launchMissionIds: ["voice_calls", "knowledge_consult", "outbound_approvals"],
    honestyNote: "Inbound voice specialization of receptionist with Knowledge + approvals.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "voice_outbound_agent",
    label: "AI Outbound Call Agent",
    description: "Approved outbound calling campaigns with GRANT before customer dials.",
    moduleIds: ["home", "knowledge", "integrations", "people", "work", "settings"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "approvals", "integrations", "outcomes"],
    packageAskConnectionOptions: ["twilio_voice"],
    launchMissionIds: ["voice_calls", "outbound_approvals", "knowledge_consult"],
    honestyNote: "Campaign dialer with owner GRANT before each customer dial; usage meters outbound minutes.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "voice_scheduling_agent",
    label: "Appointment Scheduling Voice Agent",
    description: "Voice-driven calendar slot search and book with owner-visible Work.",
    moduleIds: ["home", "knowledge", "integrations", "people", "work", "settings", "schedule"],
    canonicalNavIds: ["home", "needs_attention", "calendar", "people", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "operations", "integrations", "outcomes"],
    packageAskConnectionOptions: ["twilio_voice", "google_calendar"],
    launchMissionIds: ["voice_calls", "calendar_scheduling", "outbound_approvals"],
    honestyNote: "Live Google Calendar slot book prove + voice scheduling worker. Not a public self-serve booking page.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "voice_support_agent",
    label: "Customer Support Voice Agent",
    description: "Support-scoped Knowledge answers with Work/ticket routing.",
    moduleIds: ["home", "knowledge", "integrations", "people", "work", "settings"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "integrations", "outcomes"],
    packageAskConnectionOptions: ["twilio_voice"],
    launchMissionIds: ["voice_calls", "knowledge_consult", "outbound_approvals"],
    honestyNote: "Support-scoped inbound voice worker with Knowledge + support Work routing.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "voice_custom_agent",
    label: "Custom Voice Agent",
    description: "Custom operating contract + human services wrapper.",
    moduleIds: ["home", "knowledge", "integrations", "people", "work", "settings"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "integrations", "outcomes"],
    packageAskConnectionOptions: ["twilio_voice"],
    launchMissionIds: ["voice_calls", "knowledge_consult", "outbound_approvals"],
    honestyNote: "Human + platform services engagement — not a one-click install.",
    commercialStatus: "human_service",
    sellable: false,
  },
  {
    id: "lead_follow_up",
    label: "Lead qualification & follow-up",
    description: "Forms/Meta intake → People → draft follow-ups with approvals.",
    moduleIds: ["home", "for_you", "people", "work", "inbox", "integrations", "settings", "knowledge"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "work",
      "inbox",
      "automations",
      "knowledge",
      "integrations",
      "settings",
    ],
    discoveryTopics: [
      "identity",
      "industry",
      "customers",
      "communications",
      "integrations",
      "approvals",
      "outcomes",
    ],
    launchMissionIds: [
      "customer_email_send",
      "sms_send",
      "voice_calls",
      "meta_lead_intake",
      "website_forms",
      "outbound_approvals",
      "knowledge_consult",
    ],
    packageAskQuestionIds: ["q_customers", "q_lead_sources", "q_communications", "q_integrations"],
    packageAskConnectionOptions: ["meta_platform", "gmail", "twilio_sms", "twilio_voice"],
    honestyNote: "Intake + approved drafts — not a scored lead engine.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "appointment_setter",
    label: "Lead Appointment Setting",
    description: "VIBETech runs Meta/TikTok lead ads + an SMS setter that instantly qualifies leads and auto-books appointments onto teammate availability (Scale-style setter).",
    moduleIds: ["home", "for_you", "people", "pipelines", "work", "inbox", "integrations", "settings", "knowledge", "schedule", "digital_workforce"],
    canonicalNavIds: ["home", "needs_attention", "people", "pipelines", "work", "inbox", "knowledge", "calendar", "team", "automations", "ads", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "communications", "operations", "integrations", "outcomes"],
    packageAskQuestionIds: ["q_customers", "q_lead_sources", "q_communications", "q_integrations", "q_scheduling"],
    packageAskConnectionOptions: ["meta_platform", "twilio_sms", "twilio_voice", "google_calendar"],
    launchMissionIds: ["meta_lead_intake", "website_forms", "sms_send", "voice_calls", "calendar_scheduling", "outbound_approvals", "knowledge_consult"],
    honestyNote: "Live today: first-touch SMS sends automatically when Twilio SMS is connected (TCPA: include opt-out), durable across restarts; confirmed appointments auto-book onto teammate availability (real Google Calendar event when connected) with no manual HOLD step; Twilio white-glove provisioning (VIBETech buys the number + auto-configures the inbound webhook); Meta lead-form ingest. Rolling out: VIBETech-managed Meta paused-campaign scaffolding (ad set + creative) and TikTok lead ads (platform credentials required, honest not_configured until then). Meta Lead Ads + Calendar are required for the full loop. Not a self-serve ad creative builder.",
    commercialStatus: "product",
    sellable: false,
  },
  {
    id: "crm_automation",
    label: "CRM updates",
    description: "Follow-through work and contact evidence updates — not a People/pipelines CRM product.",
    moduleIds: ["home", "for_you", "people", "pipelines", "work", "settings", "knowledge", "integrations"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "pipelines",
      "work",
      "automations",
      "knowledge",
      "integrations",
      "settings",
    ],
    discoveryTopics: [
      "identity",
      "industry",
      "customers",
      "operations",
      "approvals",
      "integrations",
      "outcomes",
    ],
    launchMissionIds: ["outbound_approvals", "customer_email_send", "website_forms", "knowledge_consult"],
    packageAskQuestionIds: ["q_customers", "q_desired_workflows", "q_approvals", "q_integrations"],
    packageAskConnectionOptions: ["gmail"],
    honestyNote: "In-platform contacts and work — not HubSpot/Salesforce sync. External CRM sync is crm_external_integration.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "sales_assistant",
    label: "AI Sales Assistant",
    description: "One sales worker + Knowledge + draft outreach approvals.",
    moduleIds: ["home", "for_you", "digital_workforce", "knowledge", "people", "inbox", "settings", "work"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "work",
      "inbox",
      "knowledge",
      "team",
      "integrations",
      "settings",
    ],
    discoveryTopics: ["identity", "industry", "customers", "services", "communications", "approvals", "outcomes"],
    launchMissionIds: ["knowledge_consult", "customer_email_send", "outbound_approvals"],
    packageAskQuestionIds: ["q_customers", "q_communications", "q_desired_outcomes"],
    packageAskConnectionOptions: ["gmail"],
    honestyNote: "Draft + approve outreach — not a full sales CRM suite.",
    commercialStatus: "product",
    sellable: true,
    maxWorkers: 2,
  },
  {
    id: "website_chatbot",
    label: "Website lead capture (forms)",
    description: "Website form embed → People. Native chat widget is a separate SKU (website_native_chat).",
    moduleIds: ["home", "people", "integrations", "knowledge", "settings"],
    canonicalNavIds: ["home", "people", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "communications", "integrations", "outcomes"],
    launchMissionIds: ["website_forms", "knowledge_consult"],
    packageAskQuestionIds: ["q_customers", "q_integrations"],
    packageAskConnectionOptions: ["none_yet"],
    honestyNote: "Forms embed → People until native website chat ships.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "ai_prospecting",
    label: "AI Prospecting",
    description: "Research agent: industry/criteria → company + decision-maker leads in People, onto a pipeline stage you choose.",
    moduleIds: ["home", "people", "integrations", "knowledge", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "automations", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "services", "integrations", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    packageAskQuestionIds: ["q_customers", "q_integrations", "q_desired_outcomes"],
    packageAskConnectionOptions: ["prospecting_enrichment", "none_yet"],
    honestyNote: "Public web research only. Every lead must include a phone + name + short brief; email only when found free in search snippets. No paid enrichment. Candidates without a public phone are dropped.",
    commercialStatus: "product",
    sellable: false,
    maxProspectingRunsPerDay: 5,
    maxProspectingLeadsPerRun: 25,
  },
  {
    id: "website_native_chat",
    label: "Website Chatbot (native)",
    description: "Real-time website chat widget with Knowledge answers and lead capture.",
    moduleIds: ["home", "people", "integrations", "knowledge", "settings", "inbox"],
    canonicalNavIds: ["home", "people", "inbox", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "communications", "integrations", "outcomes"],
    launchMissionIds: ["knowledge_consult", "website_forms", "website_chat"],
    honestyNote: "Native website chat widget with Knowledge answers and lead capture.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "scheduling",
    label: "Scheduling automation",
    description: "Calendar bookings and reminder drafts.",
    moduleIds: ["home", "for_you", "knowledge", "integrations", "people", "settings", "schedule"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "calendar",
      "people",
      "knowledge",
      "integrations",
      "settings",
    ],
    discoveryTopics: ["identity", "industry", "services", "operations", "integrations", "outcomes"],
    launchMissionIds: ["calendar_scheduling", "knowledge_consult", "outbound_approvals"],
    packageAskQuestionIds: ["q_scheduling", "q_integrations"],
    packageAskConnectionOptions: ["google_calendar"],
    honestyNote: "Org calendar + live slot book prove (Google Calendar). Website/intake can request appointment. Not a public self-serve booking page.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "knowledge_assistant",
    label: "Knowledge assistant",
    description: "Ask against uploaded playbooks and FAQs.",
    moduleIds: ["home", "knowledge", "settings"],
    canonicalNavIds: ["home", "knowledge", "settings"],
    discoveryTopics: ["identity", "industry", "services", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    packageAskQuestionIds: ["q_documents", "q_desired_outcomes"],
    packageAskConnectionOptions: null,
    honestyNote: "Ask cites uploaded playbooks/FAQs only — never invents. Not a public website bot.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "email_sms_marketing",
    label: "Email / SMS marketing",
    description: "Campaign-lite: audience + template + owner approve before send.",
    moduleIds: ["home", "for_you", "inbox", "people", "integrations", "knowledge", "settings", "work"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "work",
      "inbox",
      "campaigns",
      "ads",
      "knowledge",
      "integrations",
      "settings",
    ],
    discoveryTopics: ["identity", "industry", "customers", "communications", "approvals", "integrations", "outcomes"],
    launchMissionIds: ["customer_email_send", "sms_send", "outbound_approvals", "knowledge_consult"],
    packageAskQuestionIds: ["q_communications", "q_integrations", "q_approvals"],
    packageAskConnectionOptions: ["gmail", "twilio_sms"],
    honestyNote: "Approve-first campaign-lite on Campaigns: save template → Prepare & review → Work approve → send.",
    commercialStatus: "product",
    sellable: false,
  },
  {
    id: "social_background_screening",
    label: "Social Background Screening",
    description: "Public social media search → FCRA-filtered background report for owner review (approve-first). Not a licensed CRA substitute.",
    moduleIds: ["home", "knowledge", "integrations", "people", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "people", "work", "knowledge", "automations", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "operations", "integrations", "outcomes"],
    packageAskQuestionIds: ["q_integrations", "q_desired_outcomes"],
    packageAskConnectionOptions: ["social_screening"],
    launchMissionIds: ["knowledge_consult", "social_screen_prove", "outbound_approvals"],
    honestyNote: "Public-web social search (Serper + ScrapingBee) + AI filter for protected characteristics. Employer remains responsible for FCRA adverse-action process. No private/authenticated scraping.",
    commercialStatus: "product",
    sellable: false,
  },
  {
    id: "social_content_automation",
    label: "Social Media Content Automation",
    description: "Draft social posts for approval across connected channels.",
    moduleIds: ["home", "knowledge", "integrations", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "integrations", "outcomes"],
    launchMissionIds: ["knowledge_consult", "outbound_approvals"],
    honestyNote: "Draft → approve → Meta publish when connected, else honest manual queue.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "marketing_content_engine",
    label: "Marketing Content Engine",
    description: "Brief → draft assets → approve publish.",
    moduleIds: ["home", "knowledge", "integrations", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "outcomes"],
    launchMissionIds: ["knowledge_consult", "outbound_approvals"],
    honestyNote: "Brief → email + SMS + social drafts for owner approval.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "sales_analytics",
    label: "Sales Analytics Dashboard",
    description: "Pipeline and conversion KPIs beyond Home metrics.",
    moduleIds: ["home", "people", "pipelines", "performance", "settings"],
    canonicalNavIds: ["home", "people", "pipelines", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Pipeline/contact/proof dashboard composed from live CRM + capability proofs.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "document_processing",
    label: "Document Processing Automation",
    description: "Structured extract from documents into Work/CRM.",
    moduleIds: ["home", "knowledge", "people", "work", "settings"],
    canonicalNavIds: ["home", "people", "work", "knowledge", "settings"],
    discoveryTopics: ["identity", "industry", "services", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Extract name/email/phone/company from documents into People.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "reporting_automation",
    label: "Reporting and Dashboard Automation",
    description: "Scheduled owner digests and automated reports.",
    moduleIds: ["home", "performance", "settings", "knowledge"],
    canonicalNavIds: ["home", "settings"],
    discoveryTopics: ["identity", "industry", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Owner digest from sales analytics (weekly cadence config).",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "basic_integration",
    label: "Basic integration",
    description: "One connection + prove. Minimal workspace.",
    moduleIds: ["home", "integrations", "settings", "knowledge"],
    canonicalNavIds: ["home", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "software", "integrations", "outcomes"],
    launchMissionIds: ["customer_email_send", "calendar_scheduling", "sms_send", "knowledge_consult"],
    packageAskQuestionIds: ["q_integrations"],
    packageAskConnectionOptions: ["gmail", "google_calendar", "twilio_sms"],
    honestyNote: "Prove whichever connection they buy — email, calendar, or SMS.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "crm_external_integration",
    label: "CRM Integration (external)",
    description: "HubSpot / Salesforce sync with in-platform People.",
    moduleIds: ["home", "people", "pipelines", "integrations", "settings"],
    canonicalNavIds: ["home", "people", "pipelines", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "integrations", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "HubSpot/HighLevel connect, prove contact, and push/pull People sync.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "multi_system_integration",
    label: "Multi-System Integration",
    description: "Multiple live adapters beyond Google/Twilio/Meta.",
    moduleIds: ["home", "integrations", "settings", "knowledge"],
    canonicalNavIds: ["home", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "integrations", "outcomes"],
    launchMissionIds: ["customer_email_send", "calendar_scheduling", "sms_send"],
    honestyNote: "Google + Twilio + Meta (+ Microsoft when configured) multi-adapter path.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "essential_managed",
    label: "Essential (managed)",
    description: "Managed starter bundle — soft caps: 3 AI workers, 5 workflows.",
    moduleIds: ["home", "for_you", "people", "work", "knowledge", "integrations", "settings", "inbox"],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "work",
      "inbox",
      "knowledge",
      "integrations",
      "settings",
    ],
    discoveryTopics: [
      "identity",
      "industry",
      "services",
      "customers",
      "communications",
      "integrations",
      "outcomes",
    ],
    launchMissionIds: [
      "customer_email_send",
      "knowledge_consult",
      "outbound_approvals",
      "website_forms",
      "sms_send",
    ],
    honestyNote: "Includes product scope plus VIBETech managed ops retainer. Soft caps enforced at install.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkers: 3,
    maxWorkflows: 5,
  },
  {
    id: "growth_managed",
    label: "Growth (managed)",
    description: "Managed growth bundle — soft caps: 8 AI workers, 15 workflows. Not full OS.",
    moduleIds: [
      "home",
      "for_you",
      "people",
      "work",
      "inbox",
      "digital_workforce",
      "knowledge",
      "integrations",
      "settings",
      "performance",
      "pipelines",
      "schedule",
    ],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "pipelines",
      "work",
      "inbox",
      "knowledge",
      "team",
      "automations",
      "calendar",
      "ads",
      "integrations",
      "settings",
    ],
    discoveryTopics: [
      "identity",
      "industry",
      "services",
      "customers",
      "communications",
      "integrations",
      "approvals",
      "outcomes",
    ],
    launchMissionIds: [
      "customer_email_send",
      "sms_send",
      "website_forms",
      "outbound_approvals",
      "knowledge_consult",
      "voice_calls",
      "calendar_scheduling",
    ],
    honestyNote: "Includes product scope plus VIBETech managed ops retainer. Soft caps enforced at install.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkers: 8,
    maxWorkflows: 15,
  },
  {
    id: "professional_managed",
    label: "Professional (managed)",
    description: "Higher caps, priority support flag, broader Launch surface.",
    moduleIds: [
      "home",
      "for_you",
      "people",
      "work",
      "inbox",
      "digital_workforce",
      "knowledge",
      "integrations",
      "settings",
      "performance",
      "pipelines",
      "schedule",
    ],
    canonicalNavIds: [
      "home",
      "needs_attention",
      "people",
      "pipelines",
      "work",
      "inbox",
      "knowledge",
      "team",
      "automations",
      "calendar",
      "integrations",
      "settings",
    ],
    discoveryTopics: [
      "identity",
      "industry",
      "services",
      "customers",
      "communications",
      "integrations",
      "approvals",
      "outcomes",
    ],
    launchMissionIds: [
      "customer_email_send",
      "sms_send",
      "website_forms",
      "outbound_approvals",
      "knowledge_consult",
      "voice_calls",
      "calendar_scheduling",
    ],
    fullOs: false,
    honestyNote: "Managed Professional retainer — higher soft caps (25 workers / 50 workflows) on full OS modules.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkers: 25,
    maxWorkflows: 50,
  },
  {
    id: "enterprise_managed",
    label: "Enterprise (managed)",
    description: "Enterprise entitlements, dedicated advisor metadata, highest caps.",
    moduleIds: null,
    canonicalNavIds: null,
    discoveryTopics: [
      "identity",
      "industry",
      "services",
      "customers",
      "communications",
      "integrations",
      "approvals",
      "outcomes",
    ],
    launchMissionIds: [
      "customer_email_send",
      "sms_send",
      "website_forms",
      "outbound_approvals",
      "knowledge_consult",
      "voice_calls",
      "calendar_scheduling",
    ],
    fullOs: true,
    honestyNote: "Managed Enterprise retainer — uncapped workers/workflows; operator-led deployment.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkers: null,
    maxWorkflows: null,
  },
  {
    id: "addon_additional_ai_agent",
    label: "Add-on: Additional AI Agent",
    description: "+1 AI worker entitlement.",
    moduleIds: ["home", "digital_workforce", "knowledge", "settings"],
    canonicalNavIds: ["home", "team", "knowledge", "settings"],
    discoveryTopics: ["identity", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Adds +1 to maxWorkers soft cap when purchased with a managed package.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkers: 1,
  },
  {
    id: "addon_additional_workflow",
    label: "Add-on: Additional Workflow",
    description: "+1 automation path entitlement.",
    moduleIds: ["home", "settings"],
    canonicalNavIds: ["home", "automations", "settings"],
    discoveryTopics: ["identity", "outcomes"],
    launchMissionIds: ["outbound_approvals"],
    honestyNote: "Adds +1 to maxWorkflows soft cap when purchased with a managed package.",
    commercialStatus: "managed_product",
    sellable: true,
    maxWorkflows: 1,
  },
  {
    id: "addon_additional_integration",
    label: "Add-on: Additional Integration",
    description: "Extra connection slot beyond package defaults.",
    moduleIds: ["home", "integrations", "settings"],
    canonicalNavIds: ["home", "integrations", "settings"],
    discoveryTopics: ["identity", "integrations", "outcomes"],
    launchMissionIds: ["customer_email_send"],
    honestyNote: "Extra connection entitlement flag for managed packages.",
    commercialStatus: "managed_product",
    sellable: true,
  },
  {
    id: "addon_priority_support",
    label: "Add-on: Priority Support",
    description: "Priority support flag on the business.",
    moduleIds: ["home", "settings"],
    canonicalNavIds: ["home", "settings"],
    discoveryTopics: ["identity", "outcomes"],
    launchMissionIds: null,
    honestyNote: "Commercial flag — Settings shows priority support instructions + contact path. Human SLA, not an in-app ticket queue.",
    commercialStatus: "managed_product",
    sellable: false,
  },
]);

const BY_ID = new Map(SALES_PACKAGE_CATALOG.map((pkg) => [pkg.id, pkg]));

export function getSalesPackage(id) {
  return BY_ID.get(String(id ?? "").trim()) ?? null;
}

export function listSalesPackagesForAdmin({ includeRoadmap = true } = {}) {
  return deepFreeze(
    SALES_PACKAGE_CATALOG
      .filter((pkg) => includeRoadmap || pkg.sellable !== false)
      .map((pkg) => ({
        id: pkg.id,
        label: pkg.label,
        description: pkg.description,
        fullOs: Boolean(pkg.fullOs),
        honestyNote: pkg.honestyNote ?? null,
        commercialStatus: pkg.commercialStatus ?? "product",
        sellable: pkg.sellable !== false,
        maxWorkers: pkg.maxWorkers ?? null,
        maxWorkflows: pkg.maxWorkflows ?? null,
        maxProspectingRunsPerDay: pkg.maxProspectingRunsPerDay ?? null,
        maxProspectingLeadsPerRun: pkg.maxProspectingLeadsPerRun ?? null,
      })),
  );
}

/**
 * Commercial Offer Matrix for admin Can-we-sell flows.
 * Re-exported helpers live in platform/commercial — kept here for discoverability.
 */
export {
  listCommercialOffers,
  listOfferableOffers,
  getCommercialOffer,
  presentOfferMatrixSummary,
  canOfferLine,
} from "../commercial/CommercialOfferMatrix.js";

export { canSellOffer } from "../commercial/CanSellOffer.js";


/**
 * Packages offered on Create & invite (live sales sheet).
 * Wave A sellable products + RFT. RFT always leads.
 */
export const WAVE_A_SELLABLE_PACKAGE_IDS = Object.freeze([
  "managed_revenue_follow_through",
  "ai_receptionist",
  "lead_follow_up",
  "website_chatbot",
  "knowledge_assistant",
  "basic_integration",
]);

/** Wave B Ready product SKUs (installable once sellable + prove paths exist). */
export const WAVE_B_SELLABLE_PACKAGE_IDS = Object.freeze([
  "sales_assistant",
  "crm_automation",
  "scheduling",
]);

export function listSellableSalesPackagesForAdmin() {
  const waveA = new Set(WAVE_A_SELLABLE_PACKAGE_IDS);
  const waveB = new Set(WAVE_B_SELLABLE_PACKAGE_IDS);
  const rows = listSalesPackagesForAdmin({ includeRoadmap: true }).filter((row) => (
    (waveA.has(row.id) && row.sellable !== false)
    || (waveB.has(row.id) && row.sellable !== false)
    || (row.commercialStatus === "managed_product" && row.sellable !== false)
    || (row.commercialStatus === "product" && row.sellable === true && !waveA.has(row.id) && !waveB.has(row.id))
  ));
  const rft = rows.filter((row) => row.id === "managed_revenue_follow_through");
  const rest = rows.filter((row) => row.id !== "managed_revenue_follow_through");
  return [...rft, ...rest];
}

/**
 * Soft caps from purchased managed packages (union of maxWorkers / maxWorkflows).
 * Billable add-ons ADD to base caps (not max-only) so purchasing +1 agent raises the ceiling.
 */
export function resolvePackageSoftCaps(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length || isFullOsPurchasedScope(packages)) {
    return deepFreeze({
      maxWorkers: null,
      maxWorkflows: null,
      maxProspectingRunsPerDay: null,
      maxProspectingLeadsPerRun: null,
    });
  }
  let maxWorkers = null;
  let maxWorkflows = null;
  let maxProspectingRunsPerDay = null;
  let maxProspectingLeadsPerRun = null;
  let addonWorkers = 0;
  let addonWorkflows = 0;
  for (const id of packages) {
    const pkg = BY_ID.get(id);
    if (!pkg) continue;
    if (id === "addon_additional_ai_agent" || id === "addon_additional_agent") {
      addonWorkers += Number.isFinite(pkg.maxWorkers) ? pkg.maxWorkers : 1;
      continue;
    }
    if (id === "addon_additional_workflow") {
      addonWorkflows += Number.isFinite(pkg.maxWorkflows) ? pkg.maxWorkflows : 1;
      continue;
    }
    if (Number.isFinite(pkg.maxWorkers)) {
      maxWorkers = maxWorkers == null ? pkg.maxWorkers : Math.max(maxWorkers, pkg.maxWorkers);
    }
    if (Number.isFinite(pkg.maxWorkflows)) {
      maxWorkflows = maxWorkflows == null ? pkg.maxWorkflows : Math.max(maxWorkflows, pkg.maxWorkflows);
    }
    if (Number.isFinite(pkg.maxProspectingRunsPerDay)) {
      maxProspectingRunsPerDay = maxProspectingRunsPerDay == null
        ? pkg.maxProspectingRunsPerDay
        : Math.max(maxProspectingRunsPerDay, pkg.maxProspectingRunsPerDay);
    }
    if (Number.isFinite(pkg.maxProspectingLeadsPerRun)) {
      maxProspectingLeadsPerRun = maxProspectingLeadsPerRun == null
        ? pkg.maxProspectingLeadsPerRun
        : Math.max(maxProspectingLeadsPerRun, pkg.maxProspectingLeadsPerRun);
    }
  }
  if (addonWorkers > 0) {
    maxWorkers = (maxWorkers == null ? 0 : maxWorkers) + addonWorkers;
  }
  if (addonWorkflows > 0) {
    maxWorkflows = (maxWorkflows == null ? 0 : maxWorkflows) + addonWorkflows;
  }
  return deepFreeze({
    maxWorkers,
    maxWorkflows,
    maxProspectingRunsPerDay,
    maxProspectingLeadsPerRun,
  });
}

/**
 * AI Prospecting unlocks when explicitly purchased OR when the workspace is Full OS
 * (ai_business_os / empty purchasedPackages legacy = full product).
 */
export function businessHasAiProspecting(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (packages.includes("ai_prospecting")) return true;
  return isFullOsPurchasedScope(packages);
}

export function businessHasManagedRevenueFollowThrough(purchasedPackages = []) {
  const list = Array.isArray(purchasedPackages) ? purchasedPackages : [];
  return list.some((p) => String(p?.id ?? p) === "managed_revenue_follow_through");
}

/**
 * Soft-cap desired workflows for managed / thin SKUs with maxWorkflows.
 */
export function filterWorkflowsForPurchasedPackages(workflows = [], purchasedPackages = []) {
  const rows = Array.isArray(workflows) ? workflows : [];
  const caps = resolvePackageSoftCaps(purchasedPackages);
  if (!Number.isFinite(caps.maxWorkflows)) return rows;
  return rows.slice(0, Math.max(0, caps.maxWorkflows));
}

/**
 * Owner-safe package summary for invitation and workspace surfaces.
 * Labels and descriptions always come from the catalog, never UI hardcoding.
 */
export function presentPurchasedPackages(raw) {
  return deepFreeze(
    normalizePurchasedPackages(raw).map((id) => {
      const pkg = BY_ID.get(id);
      return {
        id: pkg.id,
        label: pkg.label,
        description: pkg.description,
      };
    }),
  );
}

/**
 * Normalize invite checkbox ids. Drops unknowns. Dedupes.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizePurchasedPackages(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    const id = String(entry ?? "").trim();
    if (!id || seen.has(id) || !BY_ID.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function readPurchasedPackagesFromConfig(packageConfiguration = {}) {
  return normalizePurchasedPackages(packageConfiguration?.purchasedPackages);
}

export function mergePurchasedPackagesIntoConfig(packageConfiguration = {}, purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  const base = packageConfiguration && typeof packageConfiguration === "object"
    ? { ...packageConfiguration }
    : {};
  if (!packages.length) {
    delete base.purchasedPackages;
    return base;
  }
  return { ...base, purchasedPackages: packages };
}

/** Keep commercial scope when industry package sync clears other config. */
export function preservePurchasedPackagesConfig(packageConfiguration = {}) {
  const packages = readPurchasedPackagesFromConfig(packageConfiguration);
  const pending = readPendingPackageAsk(packageConfiguration);
  return {
    ...(packages.length ? { purchasedPackages: packages } : {}),
    ...(pending ? { pendingPackageAsk: pending } : {}),
  };
}

/**
 * Newly added packages that still need owner discovery questions.
 * @returns {{ status: "required", packages: string[], createdAt: string, sessionId?: string|null } | null}
 */
export function readPendingPackageAsk(packageConfiguration = {}) {
  const raw = packageConfiguration?.pendingPackageAsk;
  if (!raw || typeof raw !== "object") return null;
  if (String(raw.status ?? "") !== "required") return null;
  const packages = normalizePurchasedPackages(raw.packages);
  if (!packages.length) return null;
  return deepFreeze({
    status: "required",
    packages,
    createdAt: String(raw.createdAt ?? ""),
    sessionId: raw.sessionId ? String(raw.sessionId) : null,
  });
}

/**
 * Diff previous vs next packages. Only newly added SKUs require Ask.
 * Removals drop pending Ask entries that are no longer purchased.
 * Re-saving the same package set MUST keep an existing pending Ask (do not clear).
 */
export function applyPurchasedPackagesChange(packageConfiguration = {}, nextPurchasedPackages = []) {
  const previous = readPurchasedPackagesFromConfig(packageConfiguration);
  const next = normalizePurchasedPackages(nextPurchasedPackages);
  const prevSet = new Set(previous);
  const added = next.filter((id) => !prevSet.has(id));
  let base = mergePurchasedPackagesIntoConfig(packageConfiguration, next);

  if (added.length) {
    // Merge newly added into any existing pending Ask (don't drop earlier unfinished asks).
    const existingPending = readPendingPackageAsk(packageConfiguration);
    const pendingPackages = normalizePurchasedPackages([
      ...(existingPending?.packages ?? []),
      ...added,
    ]).filter((id) => next.includes(id));
    base = {
      ...base,
      pendingPackageAsk: {
        status: "required",
        packages: pendingPackages,
        createdAt: existingPending?.createdAt || new Date().toISOString(),
        sessionId: existingPending?.sessionId ?? null,
      },
    };
  } else {
    const existingPending = readPendingPackageAsk(packageConfiguration);
    if (existingPending) {
      const stillRelevant = existingPending.packages.filter((id) => next.includes(id));
      if (stillRelevant.length) {
        base = {
          ...base,
          pendingPackageAsk: {
            ...existingPending,
            packages: stillRelevant,
          },
        };
      } else {
        delete base.pendingPackageAsk;
      }
    } else {
      delete base.pendingPackageAsk;
    }
  }
  return deepFreeze(base);
}

export function clearPendingPackageAsk(packageConfiguration = {}) {
  const base = packageConfiguration && typeof packageConfiguration === "object"
    ? { ...packageConfiguration }
    : {};
  delete base.pendingPackageAsk;
  return base;
}

export function attachPendingPackageAskSession(packageConfiguration = {}, sessionId = null) {
  const pending = readPendingPackageAsk(packageConfiguration);
  if (!pending) return packageConfiguration;
  return {
    ...packageConfiguration,
    pendingPackageAsk: {
      ...pending,
      sessionId: sessionId ? String(sessionId) : null,
    },
  };
}

export function isFullOsPurchasedScope(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length) return true;
  return packages.some((id) => BY_ID.get(id)?.fullOs);
}

/**
 * @returns {{ packages: string[], topics: Set<string>|null, moduleIds: Set<string>|null, launchMissionIds: Set<string>|null, canonicalNavIds: Set<string>|null, fullOs: boolean }}
 */
export function resolvePurchasedPackageScope(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length || isFullOsPurchasedScope(packages)) {
    return deepFreeze({
      packages,
      topics: null,
      moduleIds: null,
      launchMissionIds: null,
      canonicalNavIds: null,
      fullOs: true,
    });
  }

  const topics = new Set(SALES_PACKAGE_ALWAYS_TOPICS);
  const moduleIds = new Set(["home", "settings"]);
  const launchMissionIds = new Set();
  const canonicalNavIds = new Set(["home", "settings"]);
  let unrestrictedTopics = false;
  let unrestrictedModules = false;
  let unrestrictedMissions = false;
  let unrestrictedNav = false;
  for (const id of packages) {
    const pkg = BY_ID.get(id);
    if (!pkg) continue;
    if (pkg.discoveryTopics == null) unrestrictedTopics = true;
    else for (const topic of pkg.discoveryTopics) topics.add(topic);
    if (pkg.moduleIds == null) unrestrictedModules = true;
    else for (const moduleId of pkg.moduleIds) moduleIds.add(moduleId);
    if (pkg.launchMissionIds == null) unrestrictedMissions = true;
    else for (const missionId of pkg.launchMissionIds) launchMissionIds.add(missionId);
    if (pkg.canonicalNavIds == null) unrestrictedNav = true;
    else for (const navId of pkg.canonicalNavIds) canonicalNavIds.add(navId);
  }

  return deepFreeze({
    packages,
    topics: unrestrictedTopics ? null : topics,
    moduleIds: unrestrictedModules ? null : moduleIds,
    launchMissionIds: unrestrictedMissions ? null : launchMissionIds,
    canonicalNavIds: unrestrictedNav ? null : canonicalNavIds,
    fullOs: false,
  });
}

/**
 * Shell nav ids entitled by purchased packages. null = full unfiltered shell.
 * @returns {Set<string>|null}
 */
export function resolveCanonicalNavIdsForPackages(purchasedPackages = []) {
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (scope.fullOs || !scope.canonicalNavIds) return null;
  const ids = new Set(scope.canonicalNavIds);
  // Plan 3 primary IA: Outcomes ships with Today/Decisions for every entitled workspace.
  if (ids.has("home") || ids.has("needs_attention")) {
    ids.add("outcomes");
  }
  return ids;
}

/**
 * Filter canonical shell nav items by purchased packages.
 * @template {{ id: string }} T
 * @param {T[]} items
 * @param {string[]} purchasedPackages
 * @returns {T[]}
 */
export function filterCanonicalNavForPurchasedPackages(items = [], purchasedPackages = []) {
  const allowed = resolveCanonicalNavIdsForPackages(purchasedPackages);
  if (!allowed) return items;
  return (items ?? []).filter((item) => allowed.has(String(item?.id ?? "")));
}

export function questionMatchesPurchasedPackages(question, purchasedPackages = []) {
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (scope.fullOs || !scope.topics) return true;
  const topic = String(question?.topic ?? "");
  if (!topic) return true;
  return scope.topics.has(topic);
}

/**
 * Resolve focus question IDs for a package-add Ask (admin added SKUs).
 * Returns null when packages have no focus list (fall back to topic filter).
 * @param {string[]} purchasedPackages
 * @returns {Set<string> | null}
 */
export function resolvePackageAskQuestionIds(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  const focus = new Set();
  let anyFocus = false;
  for (const id of packages) {
    const pkg = getSalesPackage(id);
    if (!pkg || pkg.fullOs) continue;
    const ids = pkg.packageAskQuestionIds;
    if (!Array.isArray(ids) || ids.length === 0) continue;
    anyFocus = true;
    for (const questionId of ids) focus.add(String(questionId));
  }
  return anyFocus ? focus : null;
}

const CONNECTION_OPTION_LABELS = Object.freeze({
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  twilio_sms: "Text messaging",
  twilio_voice: "Voice calling",
  social_screening: "Social screening",
  google_ads: "Google Ads",
  google_search_console: "Google Search Console",
  meta_platform: "Meta lead forms",
  prospecting_enrichment: "Prospecting enrichment",
  none_yet: "None yet",
});

/** Discovery multi-choice id → ConnectionRuntime / Launch connection type id. */
export const PACKAGE_ASK_OPTION_TO_CONNECTION = Object.freeze({
  gmail: "business_email",
  google_calendar: "calendar",
  twilio_sms: "sms_channel",
  twilio_voice: "voice_channel",
  google_ads: "google_ads",
  google_search_console: "google_search_console",
  meta_platform: "meta_lead_ads",
  social_screening: "social_screening",
  prospecting_enrichment: "prospecting_enrichment",
});

/**
 * Connection option ids entitled by newly added packages (for q_integrations).
 * @param {string[]} packageAskPackages
 * @returns {string[] | null} null = do not narrow options
 */
export function resolvePackageAskConnectionOptions(packageAskPackages = []) {
  const packages = normalizePurchasedPackages(packageAskPackages);
  const options = [];
  const seen = new Set();
  let anyDefined = false;
  for (const id of packages) {
    const pkg = getSalesPackage(id);
    if (!pkg || pkg.fullOs) continue;
    const list = pkg.packageAskConnectionOptions;
    if (list == null) continue;
    anyDefined = true;
    for (const option of list) {
      const key = String(option);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(key);
    }
  }
  if (!anyDefined) return null;
  if (!options.includes("none_yet")) options.push("none_yet");
  return options;
}

/**
 * Options still needed after removing already-connected accounts.
 * @param {string[]} options
 * @param {Iterable<string>} connectedConnectionIds connection type ids (calendar, business_email, …)
 */
export function filterPackageAskOptionsByConnected(options = [], connectedConnectionIds = []) {
  const connected = new Set(
    [...(connectedConnectionIds ?? [])].map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  if (!connected.size) return options;
  return (options ?? []).filter((option) => {
    if (option === "none_yet") return true;
    const connectionId = PACKAGE_ASK_OPTION_TO_CONNECTION[option];
    if (!connectionId) return true;
    return !connected.has(connectionId);
  });
}

/**
 * Build a seed answer for q_integrations when every required connection is already live.
 * @returns {{ questionId: string, answer: string, skipped: boolean, unknown: boolean, evidenceSource: string } | null}
 */
export function seedIntegrationsAnswerIfAlreadyConnected({
  packageAskPackages = [],
  connectedConnectionIds = [],
  nowISO = new Date().toISOString(),
} = {}) {
  const narrowed = resolvePackageAskConnectionOptions(packageAskPackages);
  if (!narrowed) return null;
  const liveNeeded = narrowed.filter((id) => id !== "none_yet");
  if (!liveNeeded.length) return null;
  const connected = new Set(
    [...(connectedConnectionIds ?? [])].map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  const already = liveNeeded.filter((option) => {
    const connectionId = PACKAGE_ASK_OPTION_TO_CONNECTION[option];
    return connectionId && connected.has(connectionId);
  });
  if (already.length !== liveNeeded.length) return null;
  return {
    questionId: "q_integrations",
    answer: already.join(", "),
    skipped: false,
    unknown: false,
    answeredAt: nowISO,
    evidenceSource: "already_connected",
  };
}

/**
 * Narrow / rewrite a bank question for package-Ask (especially integrations).
 * @param {object} question
 * @param {{ packageAsk?: boolean, packageAskPackages?: string[], connectedConnectionIds?: string[] }} [context]
 */
export function specializePackageAskQuestion(question, {
  packageAsk = false,
  packageAskPackages = [],
  connectedConnectionIds = [],
} = {}) {
  if (!packageAsk || !question) return question;
  const packages = normalizePurchasedPackages(packageAskPackages);
  const labels = packages.map((id) => getSalesPackage(id)?.label).filter(Boolean);
  const packageLabel = labels.length === 1
    ? labels[0]
    : labels.length
      ? labels.join(" · ")
      : "your new packages";

  if (String(question.questionId) !== "q_integrations") {
    return question;
  }

  const narrowed = resolvePackageAskConnectionOptions(packages);
  if (!narrowed) return question;
  const remaining = filterPackageAskOptionsByConnected(narrowed, connectedConnectionIds);
  const liveOptions = remaining.filter((id) => id !== "none_yet");

  // Everything already connected — caller should seed + skip; return nullish options signal.
  if (!liveOptions.length) {
    return {
      ...question,
      prompt: `You’re already connected for ${packageLabel}.`,
      why: "Skipped — Home already shows these connections as live.",
      options: ["none_yet"],
      skipBecauseConnected: true,
    };
  }

  // One account left: yes/no — not a provider checklist with one lonely chip.
  if (liveOptions.length === 1) {
    const optionId = liveOptions[0];
    const name = CONNECTION_OPTION_LABELS[optionId] ?? optionId;
    return {
      ...question,
      prompt: `Should ${packageLabel} use ${name}?`,
      why: `Pick Yes if you want bookings and reminders through ${name}. Skip if you’ll connect later from Home.`,
      answerType: "choice",
      options: [optionId, "none_yet"],
      optionLabels: {
        [optionId]: `Yes — connect ${name}`,
        none_yet: "Not now",
      },
    };
  }

  const optionLabels = Object.fromEntries(
    remaining.map((id) => [
      id,
      id === "none_yet"
        ? "None of these yet"
        : (CONNECTION_OPTION_LABELS[id] ?? id),
    ]),
  );

  return {
    ...question,
    prompt: `Which accounts should ${packageLabel} use?`,
    why: "Select what you still need. Anything already connected on Home is skipped.",
    options: remaining.includes("none_yet") ? remaining : [...remaining, "none_yet"],
    optionLabels,
  };
}

/**
 * Question gate for package-add Ask: prefer catalog focus IDs, else topic scope.
 * @param {{ questionId?: string, topic?: string }} question
 * @param {string[]} purchasedPackages
 * @param {{ packageAsk?: boolean, packageAskPackages?: string[] }} [options]
 */
export function questionMatchesPackageAsk(question, purchasedPackages = [], {
  packageAsk = false,
  packageAskPackages = null,
} = {}) {
  if (!packageAsk) return questionMatchesPurchasedPackages(question, purchasedPackages);
  const focusPackages = Array.isArray(packageAskPackages) && packageAskPackages.length
    ? packageAskPackages
    : purchasedPackages;
  const focus = resolvePackageAskQuestionIds(focusPackages);
  if (focus) return focus.has(String(question?.questionId ?? ""));
  return questionMatchesPurchasedPackages(question, focusPackages);
}

function moduleIdSatisfiesScope(moduleId, entitledModuleIds) {
  const id = String(moduleId ?? "");
  if (!id || !entitledModuleIds) return false;
  if (entitledModuleIds.has(id)) return true;
  for (const [catalogId, aliases] of Object.entries(MODULE_ALIAS_GROUPS)) {
    if (!entitledModuleIds.has(catalogId)) continue;
    if (aliases.includes(id)) return true;
  }
  // Entitlement for schedule/calendar also covers sports schedule when scheduling purchased.
  if (entitledModuleIds.has("schedule") && (id === "schedule" || id === "appointments" || id === "calendar")) {
    return true;
  }
  return false;
}

export function filterModulesForPurchasedPackages(modules = [], purchasedPackages = []) {
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (scope.fullOs || !scope.moduleIds) return modules;
  return (modules ?? []).filter((module) => {
    const id = String(module?.moduleId ?? module?.id ?? "");
    if (!id) return false;
    return moduleIdSatisfiesScope(id, scope.moduleIds);
  });
}

/**
 * Keep only Launch Center missions entitled by purchased packages.
 * Full OS / empty packages = broad OS, but optional lead-gen (Meta) stays opt-in
 * unless lead_follow_up (or another package that lists meta_lead_intake) was purchased.
 */
export function filterLaunchMissionsForPurchasedPackages(missions = [], purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  const scope = resolvePurchasedPackageScope(packages);
  let rows = Array.isArray(missions) ? missions : [];

  if (!scope.fullOs && scope.launchMissionIds) {
    // Missed-call SMS needs Voice + SMS. If SMS is entitled, always surface voice setup too.
    const allowed = new Set(scope.launchMissionIds);
    if (allowed.has("sms_send")) allowed.add("voice_calls");
    rows = rows.filter((mission) => allowed.has(String(mission?.id ?? "")));
  }

  // Meta Lead Ads is a purchasable lead product — never dump it on Full OS by accident.
  const metaEntitled = packages.some((id) => {
    const pkg = BY_ID.get(id);
    if (!pkg) return false;
    if (Array.isArray(pkg.launchMissionIds) && pkg.launchMissionIds.includes("meta_lead_intake")) {
      return true;
    }
    return false;
  });
  if (!metaEntitled) {
    rows = rows.filter((mission) => String(mission?.id ?? "") !== "meta_lead_intake");
  }

  return rows;
}

/**
 * Owner-facing Launch path badge. Prefer purchased packages; otherwise humanize
 * the industry string. Never hardcode a Sports/Dental-only label map.
 */
export function presentLaunchPathLabel({ purchasedPackages = [], industry = "" } = {}) {
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (!scope.fullOs && scope.packages.length) {
    const labels = scope.packages
      .map((id) => BY_ID.get(id)?.label)
      .filter(Boolean)
      .map(shortenPackageLabelForBadge);
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} · ${labels[1]}`;
    if (labels.length > 2) return `${labels.length} packages`;
  }
  const ind = String(industry ?? "").trim().replace(/_/g, " ");
  if (!ind || ind === "*" || /^other$/i.test(ind)) return null;
  return titleCaseWords(ind);
}

function shortenPackageLabelForBadge(label) {
  const raw = String(label ?? "");
  if (/receptionist/i.test(raw)) return "Receptionist";
  if (/crm/i.test(raw)) return "CRM";
  if (/lead/i.test(raw)) return "Lead follow-up";
  if (/operating system/i.test(raw)) return "Full OS";
  if (/chatbot/i.test(raw)) return "Website intake";
  if (/schedul/i.test(raw)) return "Scheduling";
  if (/knowledge/i.test(raw)) return "Knowledge";
  if (/sales/i.test(raw)) return "Sales";
  if (/email|sms|marketing/i.test(raw)) return "Email / SMS";
  if (/integration/i.test(raw)) return "Integration";
  if (/essential/i.test(raw)) return "Essential";
  if (/growth/i.test(raw)) return "Growth";
  return raw.split(/[/(]/)[0].trim().slice(0, 28);
}

function titleCaseWords(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function filterEmployeesForPurchasedPackages(employees = [], purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length || isFullOsPurchasedScope(packages)) return employees;

  const rows = Array.isArray(employees) ? employees : [];
  const kept = [];
  const seen = new Set();

  const pushMatching = (pattern, limit) => {
    let added = 0;
    for (const employee of rows) {
      if (added >= limit) break;
      const key = String(employee?.employeeId ?? employee?.id ?? employee?.archetypeId ?? "");
      if (seen.has(key)) continue;
      const role = String(
        employee?.archetypeId ?? employee?.roleId ?? employee?.title ?? employee?.label ?? "",
      ).toLowerCase();
      if (!pattern.test(role)) continue;
      seen.add(key);
      kept.push(employee);
      added += 1;
    }
    return added;
  };

  if (packages.includes("ai_receptionist") || packages.includes("voice_inbound_agent")) {
    pushMatching(/reception|voice|front.?desk|phone/, 1);
  }
  if (packages.includes("crm_automation") || packages.includes("lead_follow_up")) {
    const added = pushMatching(/crm|intake|follow|coord|registration|people|pipeline/, 2);
    if (packages.includes("lead_follow_up") && added === 0) {
      const def = buildDefaultLeadFollowUpEmployee();
      const key = String(def.employeeId);
      if (!seen.has(key)) {
        seen.add(key);
        kept.push(def);
      }
    }
    if (packages.includes("crm_automation") && !kept.some((emp) => /crm.?automation/i.test(String(emp?.label ?? emp?.employeeId ?? "")))) {
      const def = buildDefaultCrmAutomationEmployee();
      const key = String(def.employeeId);
      if (!seen.has(key)) {
        seen.add(key);
        kept.push(def);
      }
    }
  }
  if (packages.includes("voice_support_agent")) {
    const added = pushMatching(/support.?voice|support/, 1);
    if (added === 0) {
      const def = buildDefaultSupportVoiceEmployee();
      const key = String(def.employeeId);
      if (!seen.has(key)) {
        seen.add(key);
        kept.push(def);
      }
    }
  }
  if (packages.includes("voice_scheduling_agent") || packages.includes("scheduling")) {
    if (packages.includes("voice_scheduling_agent")) {
      const added = pushMatching(/scheduling.?voice|scheduling|appointment/, 1);
      if (added === 0) {
        const def = buildDefaultSchedulingVoiceEmployee();
        const key = String(def.employeeId);
        if (!seen.has(key)) {
          seen.add(key);
          kept.push(def);
        }
      }
    }
  }
  if (packages.includes("sales_assistant")) {
    const added = pushMatching(/sales|outreach|sdr/, 2);
    // Guarantee at least one sales worker with a runnable draft path.
    if (added === 0) {
      const def = buildDefaultSalesAssistantEmployee();
      const key = String(def.employeeId);
      if (!seen.has(key)) {
        seen.add(key);
        kept.push(def);
      }
    }
  }
  if (packages.includes("appointment_setter")) {
    const added = pushMatching(/appointment.?setter|appointment|setter/, 1);
    if (added === 0) {
      const def = buildDefaultAppointmentSetterEmployee();
      const key = String(def.employeeId);
      if (!seen.has(key)) {
        seen.add(key);
        kept.push(def);
      }
    }
  }

  // Managed tiers must not install with an empty workforce.
  if (
    (
      packages.includes("essential_managed")
      || packages.includes("growth_managed")
      || packages.includes("managed_revenue_follow_through")
    )
    && kept.length === 0
  ) {
    for (const def of [
      buildDefaultLeadFollowUpEmployee(),
      buildDefaultSalesAssistantEmployee(),
    ]) {
      const key = String(def.employeeId);
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(def);
    }
  }

  // Receptionist SKU: guarantee a front-desk voice worker (not Meta/form lead template).
  if (
    (packages.includes("ai_receptionist") || packages.includes("voice_inbound_agent"))
    && !kept.some((emp) => /reception|voice|front.?desk|phone/i.test(
      String(emp?.archetypeId ?? emp?.label ?? ""),
    ))
  ) {
    const def = buildDefaultReceptionistEmployee();
    const key = String(def.employeeId);
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(def);
    }
  }

  // Social background screening SKU.
  if (
    packages.includes("social_background_screening")
    && !kept.some((emp) => /social.?background|social.?screen/i.test(
      String(emp?.employeeId ?? emp?.label ?? ""),
    ))
  ) {
    const def = buildDefaultSocialScreenerEmployee();
    const key = String(def.employeeId);
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(def);
    }
  }

  const caps = resolvePackageSoftCaps(packages);
  if (Number.isFinite(caps.maxWorkers) && kept.length > caps.maxWorkers) {
    return kept.slice(0, caps.maxWorkers);
  }

  // Thin SKU honesty: never fall back to arbitrary first N of a full pack.
  return kept;
}

/** Ask / change capabilities always allowed on thin SKUs. */
const THIN_SKU_ASK_BASE = Object.freeze([
  "architect.change.update_business_profile",
  "architect.change.invite_team_member",
  "architect.change.enable_integration",
  "architect.change.add_knowledge",
  "architect.change.modify_approval_policy",
  "architect.change.update_workflow",
  "architect.change.enable_ai_employee",
  "architect.change.enable_blueprint_capability",
]);

/** Extra Ask capabilities unlocked by specific packages. */
const PACKAGE_ASK_EXTRAS = Object.freeze({
  scheduling: ["architect.change.enable_scheduling"],
  email_sms_marketing: ["architect.change.enable_sms_messaging"],
  lead_follow_up: ["architect.change.enable_sms_messaging"],
  appointment_setter: ["architect.change.enable_sms_messaging", "architect.change.enable_scheduling", "architect.change.enable_facebook_leads"],
  essential_managed: ["architect.change.enable_sms_messaging"],
  growth_managed: ["architect.change.enable_sms_messaging", "architect.change.enable_scheduling"],
  ai_receptionist: ["architect.change.enable_phone_voice"],
  sales_assistant: ["architect.change.enable_ai_employee"],
});

/**
 * Filter Ask/change capabilities by purchased packages.
 * Full OS / empty = no filtering.
 * @template {{ capabilityId?: string, id?: string }} T
 * @param {T[]} capabilities
 * @param {string[]} purchasedPackages
 * @returns {T[]}
 */
export function filterAskCapabilitiesForPurchasedPackages(capabilities = [], purchasedPackages = []) {
  if (isFullOsPurchasedScope(purchasedPackages)) return capabilities;
  const packages = normalizePurchasedPackages(purchasedPackages);
  const allowed = new Set(THIN_SKU_ASK_BASE);
  for (const id of packages) {
    for (const cap of PACKAGE_ASK_EXTRAS[id] ?? []) allowed.add(cap);
  }
  return (capabilities ?? []).filter((entry) => {
    const id = String(entry?.capabilityId ?? entry?.id ?? "");
    return !id || allowed.has(id);
  });
}
