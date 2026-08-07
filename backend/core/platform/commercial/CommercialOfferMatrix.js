/**
 * Full commercial pricing-sheet → offer class matrix.
 * Every sheet line must appear here. Offerable only when implementationStatus === "complete".
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * @typedef {{
 *   id: string,
 *   sheetSection: string,
 *   sheetLine: string,
 *   packageId: string | null,
 *   offerClass: "ready" | "custom_build" | "consulting" | "managed_ops" | "usage",
 *   deliveryPlaybookId: string,
 *   requiredProveMissionIds: string[],
 *   setupPriceUsd: number | null,
 *   monthlyPriceUsd: number | null,
 *   implementationStatus: "complete" | "building",
 *   notes?: string | null,
 * }} CommercialOffer
 */

/** @type {CommercialOffer[]} */
const ROWS = [
  // —— 1. Discovery and Consulting ——
  offer("discovery", "Technology Stack Assessment", null, "consulting", "consulting_tech_stack", [], 2000, null),
  offer("discovery", "AI Readiness Assessment", null, "consulting", "consulting_ai_readiness", [], 2000, null),
  offer("discovery", "Business Process Review", null, "consulting", "consulting_process_review", [], 3500, null),
  offer("discovery", "AI Strategy and Roadmap", null, "consulting", "consulting_ai_strategy", [], 5000, null),
  offer("discovery", "Executive AI Consulting", null, "consulting", "consulting_executive", [], 3500, null),
  offer("discovery", "Hourly Consulting Rate", null, "consulting", "consulting_hourly", [], null, null, { notes: "$350/hour" }),
  offer("discovery", "Custom Workshop or Training Session", null, "consulting", "consulting_workshop", [], 5000, null),

  // —— 2. AI Voice and Communication ——
  offer("voice", "AI Receptionist", "ai_receptionist", "ready", "sku_ai_receptionist", ["voice_calls", "knowledge_consult"], 4000, 997),
  offer("voice", "AI Inbound Call Agent", "voice_inbound_agent", "custom_build", "sku_voice_inbound", ["voice_calls", "knowledge_consult", "outbound_approvals"], 5000, 1497),
  offer("voice", "AI Outbound Call Agent", "voice_outbound_agent", "custom_build", "sku_voice_outbound", ["voice_calls", "outbound_approvals"], 9000, 2497),
  offer("voice", "Appointment Scheduling Agent", "voice_scheduling_agent", "custom_build", "sku_voice_scheduling", ["voice_calls", "calendar_scheduling"], 4500, 1297),
  offer("voice", "Customer Support Voice Agent", "voice_support_agent", "custom_build", "sku_voice_support", ["voice_calls", "knowledge_consult"], 6000, 1997),
  offer("voice", "Custom Voice Agent", "voice_custom_agent", "custom_build", "sku_voice_custom", ["voice_calls", "knowledge_consult", "outbound_approvals"], 15000, 3500),

  // —— 3. Sales and Marketing ——
  offer("sales", "AI Lead Qualification System", "lead_follow_up", "ready", "sku_lead_qualification", ["website_forms", "outbound_approvals", "customer_email_send"], 4000, 997),
  offer("sales", "Automated Lead Follow-Up", "lead_follow_up", "ready", "sku_lead_follow_up", ["website_forms", "customer_email_send", "outbound_approvals", "sms_send"], 3500, 797, {
    notes: "Wave A Ready — lead_follow_up entitlement with prove missions",
  }),
  offer("sales", "CRM Automation", "crm_automation", "custom_build", "sku_crm_automation", ["outbound_approvals", "customer_email_send", "website_forms"], 6000, 1497),
  offer("sales", "AI Sales Assistant", "sales_assistant", "custom_build", "sku_sales_assistant", ["knowledge_consult", "customer_email_send", "outbound_approvals"], 5000, 1497),
  offer("sales", "Email Marketing Automation", "email_sms_marketing", "custom_build", "sku_email_marketing", ["customer_email_send", "outbound_approvals"], 4000, 997),
  offer("sales", "Social Media Content Automation", "social_content_automation", "custom_build", "sku_social_content", ["knowledge_consult"], 3500, 797),
  offer("sales", "Marketing Content Engine", "marketing_content_engine", "custom_build", "sku_marketing_content", ["knowledge_consult"], 5000, 1497),
  offer("sales", "Sales Analytics Dashboard", "sales_analytics", "custom_build", "sku_sales_analytics", ["knowledge_consult"], 5000, 997),

  // —— 4. Customer Service and Operations ——
  offer("ops", "AI Customer Support Agent", "voice_support_agent", "custom_build", "sku_support_agent", ["knowledge_consult", "outbound_approvals"], 6000, 1997),
  offer("ops", "Website Chatbot", "website_chatbot", "ready", "sku_website_forms", ["website_forms"], 3500, 797, {
    notes: "Forms → People (Wave A Ready). Native chat is website_native_chat.",
  }),
  offer("ops", "Native Website Chatbot", "website_native_chat", "ready", "sku_website_native_chat", ["website_forms", "website_chat", "knowledge_consult"], 4500, 997, {
    notes: "Embeddable Knowledge-backed chat widget with lead capture.",
  }),
  offer("ops", "Internal Knowledge Base Assistant", "knowledge_assistant", "ready", "sku_knowledge_assistant", ["knowledge_consult"], 5000, 1297),
  offer("ops", "Workflow Automation", "ai_business_os", "custom_build", "sku_workflow_automation", ["outbound_approvals"], 3000, 697),
  offer("ops", "Scheduling Automation", "scheduling", "custom_build", "sku_scheduling", ["calendar_scheduling"], 4500, 997),
  offer("ops", "Document Processing Automation", "document_processing", "custom_build", "sku_document_processing", ["knowledge_consult"], 8000, 1997),
  offer("ops", "Reporting and Dashboard Automation", "reporting_automation", "custom_build", "sku_reporting", ["knowledge_consult"], 5000, 997),

  // —— 5. Systems Integration and Custom Development ——
  offer("integration", "Basic System Integration", "basic_integration", "ready", "sku_basic_integration", ["customer_email_send", "calendar_scheduling", "sms_send"], 3500, 397),
  offer("integration", "CRM Integration", "crm_external_integration", "custom_build", "sku_crm_external", ["knowledge_consult"], 7500, 697, {
    notes: "HubSpot / HighLevel push-pull. Salesforce = Custom Build Factory when client requires it.",
  }),
  offer("integration", "Multi-System Integration", "multi_system_integration", "custom_build", "sku_multi_system", ["customer_email_send", "calendar_scheduling", "sms_send"], 15000, 1497),
  offer("integration", "Custom AI Application", "ai_business_os", "custom_build", "custom_build_factory", ["knowledge_consult", "outbound_approvals"], 25000, 2500),
  offer("integration", "Custom Business Automation", "ai_business_os", "custom_build", "custom_build_factory", ["outbound_approvals"], 10000, 1497),
  offer("integration", "AI Business Operating System", "ai_business_os", "custom_build", "custom_build_factory", ["knowledge_consult", "outbound_approvals", "customer_email_send"], 20000, 3500),
  offer("integration", "Enterprise AI Deployment", "enterprise_managed", "managed_ops", "managed_enterprise", ["knowledge_consult", "outbound_approvals"], 50000, 7500, {
    notes: "Operator-led enterprise managed deployment on uncapped entitlements.",
  }),

  // —— 6. Managed Services Packages ——
  offer("managed", "Managed Revenue Follow-Through", "managed_revenue_follow_through", "ready", "managed_rft", ["customer_email_send", "knowledge_consult", "outbound_approvals", "website_forms"], null, null, {
    notes: "Primary Ready beachhead product",
    implementationStatus: "complete",
  }),
  offer("managed", "Essential", "essential_managed", "managed_ops", "managed_essential", ["customer_email_send", "knowledge_consult", "outbound_approvals", "website_forms", "sms_send"], 3500, 997),
  offer("managed", "Growth", "growth_managed", "managed_ops", "managed_growth", ["customer_email_send", "knowledge_consult", "outbound_approvals", "website_forms", "sms_send", "voice_calls"], 7500, 1997),
  offer("managed", "Professional", "professional_managed", "managed_ops", "managed_professional", ["customer_email_send", "knowledge_consult", "outbound_approvals"], 15000, 3997),
  offer("managed", "Enterprise", "enterprise_managed", "managed_ops", "managed_enterprise", ["customer_email_send", "knowledge_consult", "outbound_approvals"], 35000, 8500),
  offer("managed", "Custom Managed Services", null, "managed_ops", "managed_custom", ["knowledge_consult", "outbound_approvals"], 20000, 5000),

  // —— 7. Monthly Add-Ons ——
  offer("addon", "Additional AI Agent", "addon_additional_ai_agent", "managed_ops", "addon_agent", ["knowledge_consult"], 2000, 497),
  offer("addon", "Additional Workflow", "addon_additional_workflow", "managed_ops", "addon_workflow", ["outbound_approvals"], 1000, 197),
  offer("addon", "Additional Integration", "addon_additional_integration", "managed_ops", "addon_integration", ["customer_email_send"], null, 397),
  offer("addon", "AI Employee Training", null, "consulting", "addon_training", [], null, 797),
  offer("addon", "Prompt Engineering and Optimization", null, "consulting", "addon_prompt_opt", [], null, 797),
  offer("addon", "Executive Dashboard", "addon_executive_dashboard", "custom_build", "addon_dashboard", ["knowledge_consult"], null, 797, {
    notes: "Settings Executive view — sales analytics + usage + open Decisions.",
  }),
  offer("addon", "Sales Coaching and Analytics", "addon_sales_coaching", "consulting", "addon_sales_coaching", [], null, 1297),
  offer("addon", "Quarterly Business Review", null, "consulting", "addon_qbr", [], null, null, { notes: "$1000/quarter" }),
  offer("addon", "Dedicated AI Advisor", null, "consulting", "addon_advisor", [], null, 2500),
  offer("addon", "Priority Support", "addon_priority_support", "managed_ops", "addon_priority_support", [], null, 497),

  // —— 8. Usage-Based Pricing ——
  offer("usage", "Voice Minutes", null, "usage", "usage_voice", [], null, null, { notes: "$0.40 inbound / $0.45 outbound per minute + carrier" }),
  offer("usage", "Text Messages", null, "usage", "usage_sms", [], null, null, { notes: "1000 segments included; $0.035 overage + carrier" }),
  offer("usage", "Emails", null, "usage", "usage_email", [], null, null, { notes: "5000 included; $0.004 overage" }),
  offer("usage", "AI Conversations / Work Credits", null, "usage", "usage_ai_credits", [], null, null, { notes: "1000 included; $0.20 overage" }),
  offer("usage", "API / Provider Usage", null, "usage", "usage_api_wallet", [], null, null, { notes: "$150 wallet; provider + 25% margin" }),
  offer("usage", "Data Storage", null, "usage", "usage_storage", [], null, null, { notes: "10 GB included; $7/GB overage" }),
  offer("usage", "Additional Users", null, "usage", "usage_users", [], null, null, { notes: "10 staff included; $25/user overage" }),
];

/**
 * @param {string} sheetSection
 * @param {string} sheetLine
 * @param {string | null} packageId
 * @param {CommercialOffer["offerClass"]} offerClass
 * @param {string} deliveryPlaybookId
 * @param {string[]} requiredProveMissionIds
 * @param {number | null} setupPriceUsd
 * @param {number | null} monthlyPriceUsd
 * @param {{ notes?: string, implementationStatus?: "complete" | "building" }} [extra]
 * @returns {CommercialOffer}
 */
function offer(
  sheetSection,
  sheetLine,
  packageId,
  offerClass,
  deliveryPlaybookId,
  requiredProveMissionIds,
  setupPriceUsd,
  monthlyPriceUsd,
  extra = {},
) {
  const implementationStatus = extra.implementationStatus
    ?? defaultStatus(offerClass);
  return {
    id: sheetLineSlug(sheetSection, sheetLine),
    sheetSection,
    sheetLine,
    packageId,
    offerClass,
    deliveryPlaybookId,
    requiredProveMissionIds: [...requiredProveMissionIds],
    setupPriceUsd,
    monthlyPriceUsd,
    implementationStatus,
    notes: extra.notes ?? null,
  };
}

function defaultStatus(offerClass) {
  // Consulting + usage playbooks are operable immediately as human/commercial paths.
  // Ready/custom/managed product paths start as building until prove closes.
  if (offerClass === "consulting" || offerClass === "usage") return "complete";
  if (offerClass === "ready") return "building";
  return "building";
}

export function sheetLineSlug(section, line) {
  return `${String(section)}__${String(line)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;
}

/**
 * Sheet lines / package ids that must NOT be sold until adapters or ops wiring exist.
 * Keep consulting/usage/Wave A Ready/custom-on-engine paths complete; hide unfinished adapters.
 */
const BUILDING_PACKAGE_IDS = new Set([
  // Reserved for future hard blocks (empty = all gated lines complete or consulting/usage).
]);

const BUILDING_SHEET_LINES = new Set([
  // Reserved for future hard blocks.
]);

const COMPLETE_READY_PACKAGE_IDS = new Set([
  "managed_revenue_follow_through",
  "ai_receptionist",
  "lead_follow_up",
  "website_chatbot",
  "website_native_chat",
  "knowledge_assistant",
  "basic_integration",
  "sales_assistant",
  "crm_automation",
  "scheduling",
  "voice_inbound_agent",
  "voice_outbound_agent",
  "voice_scheduling_agent",
  "voice_support_agent",
  "social_content_automation",
  "marketing_content_engine",
  "sales_analytics",
  "document_processing",
  "reporting_automation",
  "crm_external_integration",
  "multi_system_integration",
]);

const COMPLETE_MANAGED_PACKAGE_IDS = new Set([
  "essential_managed",
  "growth_managed",
  "professional_managed",
  "enterprise_managed",
  "addon_priority_support",
  "addon_additional_ai_agent",
  "addon_additional_workflow",
  "addon_additional_integration",
  "addon_additional_agent",
  "addon_executive_dashboard",
]);

export const COMMERCIAL_OFFER_MATRIX = deepFreeze(
  ROWS.map((row) => {
    if (row.packageId === "managed_revenue_follow_through") {
      return { ...row, offerClass: "ready", implementationStatus: "complete" };
    }
    if (row.offerClass === "consulting" || row.offerClass === "usage") {
      return { ...row, implementationStatus: "complete" };
    }
    if (BUILDING_PACKAGE_IDS.has(row.packageId) || BUILDING_SHEET_LINES.has(row.sheetLine)) {
      return {
        ...row,
        implementationStatus: "building",
        notes: row.notes
          ?? "Not offerable until live adapter / entitlement metering ships — Custom Build Factory cannot invent missing providers.",
      };
    }
    if (COMPLETE_READY_PACKAGE_IDS.has(row.packageId)) {
      return { ...row, implementationStatus: "complete" };
    }
    if (COMPLETE_MANAGED_PACKAGE_IDS.has(row.packageId) || row.sheetLine === "Custom Managed Services") {
      return { ...row, implementationStatus: "complete" };
    }
    // Custom-on-platform paths that use existing Google/Twilio/forms/knowledge engines.
    if (row.offerClass === "custom_build") {
      return { ...row, implementationStatus: "complete" };
    }
    return { ...row, implementationStatus: row.implementationStatus ?? "building" };
  }),
);

const BY_ID = new Map(COMMERCIAL_OFFER_MATRIX.map((row) => [row.id, row]));
const BY_LINE = new Map(COMMERCIAL_OFFER_MATRIX.map((row) => [row.sheetLine.toLowerCase(), row]));

export function listCommercialOffers() {
  return COMMERCIAL_OFFER_MATRIX;
}

export function getCommercialOffer(idOrLine) {
  const key = String(idOrLine ?? "").trim();
  if (!key) return null;
  return BY_ID.get(key) ?? BY_LINE.get(key.toLowerCase()) ?? null;
}

export function listOffersByClass(offerClass) {
  return deepFreeze(COMMERCIAL_OFFER_MATRIX.filter((row) => row.offerClass === offerClass));
}

export function listOfferableOffers() {
  return deepFreeze(COMMERCIAL_OFFER_MATRIX.filter((row) => row.implementationStatus === "complete"));
}

export function canOfferLine(idOrLine) {
  const row = getCommercialOffer(idOrLine);
  return Boolean(row && row.implementationStatus === "complete");
}

export function listOffersByPackageId(packageId) {
  const id = String(packageId ?? "").trim();
  if (!id) return deepFreeze([]);
  return deepFreeze(COMMERCIAL_OFFER_MATRIX.filter((row) => row.packageId === id));
}

export function presentOfferMatrixSummary() {
  const all = COMMERCIAL_OFFER_MATRIX;
  const complete = all.filter((r) => r.implementationStatus === "complete");
  const building = all.filter((r) => r.implementationStatus === "building");
  const byClass = {};
  for (const row of all) {
    byClass[row.offerClass] = (byClass[row.offerClass] ?? 0) + 1;
  }
  return deepFreeze({
    total: all.length,
    complete: complete.length,
    building: building.length,
    byClass,
  });
}
