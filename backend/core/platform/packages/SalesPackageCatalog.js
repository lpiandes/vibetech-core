import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  buildDefaultLeadFollowUpEmployee,
  buildDefaultSalesAssistantEmployee,
  buildDefaultReceptionistEmployee,
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
    honestyNote: null,
    commercialStatus: "product",
    sellable: true,
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
    honestyNote: "Roadmap product family — sells as receptionist specialization until dedicated agent contracts ship.",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Roadmap — outbound place-call exists; campaign agent product not shipped.",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Roadmap — receptionist creates appointment Work today; live slot book is Phase 3.",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Roadmap — use receptionist + Knowledge until support-agent contracts ship.",
    commercialStatus: "roadmap",
    sellable: false,
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
      "meta_lead_intake",
      "website_forms",
      "outbound_approvals",
      "knowledge_consult",
    ],
    packageAskQuestionIds: ["q_customers", "q_lead_sources", "q_communications", "q_integrations"],
    packageAskConnectionOptions: ["meta_platform", "gmail", "twilio_sms"],
    honestyNote: "Intake + approved drafts — not a scored lead engine.",
    commercialStatus: "product",
    sellable: true,
  },
  {
    id: "crm_automation",
    label: "CRM automation",
    description: "People, pipelines, and work automation (in-platform CRM).",
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
    honestyNote: "In-platform People/pipelines — not HubSpot/Salesforce sync.",
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
    description: "Website form embed → People. Native chat widget is a separate roadmap SKU.",
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
    id: "website_native_chat",
    label: "Website Chatbot (native)",
    description: "Real-time website chat widget with Knowledge answers and lead capture.",
    moduleIds: ["home", "people", "integrations", "knowledge", "settings", "inbox"],
    canonicalNavIds: ["home", "people", "inbox", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "communications", "integrations", "outcomes"],
    launchMissionIds: ["website_forms", "knowledge_consult"],
    honestyNote: "Roadmap — not available for install until native widget ships.",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Org calendar + reminder drafts. Website/intake can request appointment (Work + calendar HOLD). Not a public self-serve booking page.",
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
    honestyNote: null,
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
    sellable: true,
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
    sellable: true,
  },
  {
    id: "social_content_automation",
    label: "Social Media Content Automation",
    description: "Draft social posts for approval across connected channels.",
    moduleIds: ["home", "knowledge", "integrations", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "integrations", "outcomes"],
    launchMissionIds: ["knowledge_consult", "outbound_approvals"],
    honestyNote: "Roadmap — ads adapters exist; social publish product not shipped.",
    commercialStatus: "roadmap",
    sellable: false,
  },
  {
    id: "marketing_content_engine",
    label: "Marketing Content Engine",
    description: "Brief → draft assets → approve publish.",
    moduleIds: ["home", "knowledge", "integrations", "settings", "work"],
    canonicalNavIds: ["home", "needs_attention", "work", "knowledge", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "communications", "outcomes"],
    launchMissionIds: ["knowledge_consult", "outbound_approvals"],
    honestyNote: "Roadmap.",
    commercialStatus: "roadmap",
    sellable: false,
  },
  {
    id: "sales_analytics",
    label: "Sales Analytics Dashboard",
    description: "Pipeline and conversion KPIs beyond Home metrics.",
    moduleIds: ["home", "people", "pipelines", "performance", "settings"],
    canonicalNavIds: ["home", "people", "pipelines", "settings"],
    discoveryTopics: ["identity", "industry", "customers", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Roadmap — Growth includes performance module; dedicated sales BI not shipped.",
    commercialStatus: "roadmap",
    sellable: false,
  },
  {
    id: "document_processing",
    label: "Document Processing Automation",
    description: "Structured extract from documents into Work/CRM.",
    moduleIds: ["home", "knowledge", "people", "work", "settings"],
    canonicalNavIds: ["home", "people", "work", "knowledge", "settings"],
    discoveryTopics: ["identity", "industry", "services", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Roadmap beyond PDF→Knowledge ingest.",
    commercialStatus: "roadmap",
    sellable: false,
  },
  {
    id: "reporting_automation",
    label: "Reporting and Dashboard Automation",
    description: "Scheduled owner digests and automated reports.",
    moduleIds: ["home", "performance", "settings", "knowledge"],
    canonicalNavIds: ["home", "settings"],
    discoveryTopics: ["identity", "industry", "outcomes"],
    launchMissionIds: ["knowledge_consult"],
    honestyNote: "Roadmap.",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Roadmap — live CRM today is in-platform only.",
    commercialStatus: "roadmap",
    sellable: false,
  },
  {
    id: "multi_system_integration",
    label: "Multi-System Integration",
    description: "Multiple live adapters beyond Google/Twilio/Meta.",
    moduleIds: ["home", "integrations", "settings", "knowledge"],
    canonicalNavIds: ["home", "integrations", "settings"],
    discoveryTopics: ["identity", "industry", "integrations", "outcomes"],
    launchMissionIds: ["customer_email_send", "calendar_scheduling", "sms_send"],
    honestyNote: "Roadmap for Outlook/Slack/Drive/etc. live adapters.",
    commercialStatus: "roadmap",
    sellable: false,
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
    moduleIds: null,
    canonicalNavIds: null,
    discoveryTopics: null,
    launchMissionIds: null,
    fullOs: true,
    honestyNote: "Entitlements + billing required before sellable. Catalog stub for Phase 5.",
    commercialStatus: "roadmap",
    sellable: false,
    maxWorkers: 25,
    maxWorkflows: 50,
  },
  {
    id: "enterprise_managed",
    label: "Enterprise (managed)",
    description: "Enterprise entitlements, dedicated advisor metadata, highest caps.",
    moduleIds: null,
    canonicalNavIds: null,
    discoveryTopics: null,
    launchMissionIds: null,
    fullOs: true,
    honestyNote: "Operator-led enterprise deployment — billing + SSO later.",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Billable add-on — requires commercial metering (Phase 5).",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Billable add-on — requires commercial metering (Phase 5).",
    commercialStatus: "roadmap",
    sellable: false,
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
    honestyNote: "Billable add-on — requires commercial metering (Phase 5).",
    commercialStatus: "roadmap",
    sellable: false,
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
    sellable: true,
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
      })),
  );
}

/** Packages offered on Create & invite (live sales sheet). */
export function listSellableSalesPackagesForAdmin() {
  return listSalesPackagesForAdmin({ includeRoadmap: false });
}

/**
 * Soft caps from purchased managed packages (union of maxWorkers / maxWorkflows).
 */
export function resolvePackageSoftCaps(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length || isFullOsPurchasedScope(packages)) {
    return deepFreeze({ maxWorkers: null, maxWorkflows: null });
  }
  let maxWorkers = null;
  let maxWorkflows = null;
  for (const id of packages) {
    const pkg = BY_ID.get(id);
    if (!pkg) continue;
    if (Number.isFinite(pkg.maxWorkers)) {
      maxWorkers = maxWorkers == null ? pkg.maxWorkers : Math.max(maxWorkers, pkg.maxWorkers);
    }
    if (Number.isFinite(pkg.maxWorkflows)) {
      maxWorkflows = maxWorkflows == null ? pkg.maxWorkflows : Math.max(maxWorkflows, pkg.maxWorkflows);
    }
  }
  return deepFreeze({ maxWorkers, maxWorkflows });
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
  return scope.canonicalNavIds;
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
  social_screening: "Social screening",
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
 * Full OS / empty packages = no filtering (legacy).
 */
export function filterLaunchMissionsForPurchasedPackages(missions = [], purchasedPackages = []) {
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (scope.fullOs || !scope.launchMissionIds) return missions;
  return (missions ?? []).filter((mission) => scope.launchMissionIds.has(String(mission?.id ?? "")));
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

  // Managed tiers must not install with an empty workforce.
  if (
    (packages.includes("essential_managed") || packages.includes("growth_managed"))
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
