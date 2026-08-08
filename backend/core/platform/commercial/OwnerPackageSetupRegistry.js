/**
 * Owner-facing setup checklists per purchased package.
 * Labels are Connect → Test it → Go live. Internal prove/A2P language stays out.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getSalesPackage, listSellableSalesPackagesForAdmin } from "../packages/SalesPackageCatalog.js";

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   hint?: string,
 *   kind: "connect" | "knowledge" | "test" | "go_live" | "consulting",
 *   connectionIds?: string[],
 *   proveMissionId?: string | null,
 *   proveMissionIds?: string[],
 *   href?: "integrations" | "knowledge" | null,
 *   focusConnectionId?: string | null,
 * }} OwnerSetupStep
 */

/** @type {Record<string, OwnerSetupStep[]>} */
const EXPLICIT = {
  ai_receptionist: [
    step("connect_phone", "Connect business phone", "connect", {
      connectionIds: ["voice_channel"],
      href: "integrations",
      focusConnectionId: "voice_channel",
      hint: "We’ll help set up your number so callers reach your AI receptionist.",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", {
      href: "knowledge",
      hint: "Upload hours, services, and FAQs — what the phone is allowed to say.",
    }),
    step("test_call", "Test a call", "test", {
      proveMissionId: "voice_calls",
      href: "integrations",
      focusConnectionId: "voice_channel",
      hint: "Place a real test so we know the phone path works.",
    }),
    step("go_live", "Go live", "go_live", {
      hint: "Turn on live answering after the steps above are done.",
    }),
  ],
  voice_inbound_agent: [
    step("connect_phone", "Connect business phone", "connect", {
      connectionIds: ["voice_channel"],
      href: "integrations",
      focusConnectionId: "voice_channel",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_call", "Test a call", "test", { proveMissionId: "voice_calls", href: "integrations", focusConnectionId: "voice_channel" }),
    step("go_live", "Go live", "go_live"),
  ],
  voice_outbound_agent: [
    step("connect_phone", "Connect business phone", "connect", {
      connectionIds: ["voice_channel"],
      href: "integrations",
      focusConnectionId: "voice_channel",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_outbound", "Test an approved outbound call", "test", {
      proveMissionId: "voice_calls",
      href: "integrations",
      focusConnectionId: "voice_channel",
      hint: "Outbound dials need your approval before they reach a customer.",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  voice_scheduling_agent: [
    step("connect_phone", "Connect business phone", "connect", {
      connectionIds: ["voice_channel"],
      href: "integrations",
      focusConnectionId: "voice_channel",
    }),
    step("connect_calendar", "Connect calendar", "connect", {
      connectionIds: ["calendar", "google_calendar"],
      href: "integrations",
      focusConnectionId: "calendar",
    }),
    step("test_book", "Test a booking", "test", {
      proveMissionId: "calendar_scheduling",
      href: "integrations",
      focusConnectionId: "calendar",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  voice_support_agent: [
    step("connect_phone", "Connect business phone", "connect", {
      connectionIds: ["voice_channel"],
      href: "integrations",
      focusConnectionId: "voice_channel",
    }),
    step("add_knowledge", "Add support Knowledge", "knowledge", { href: "knowledge" }),
    step("test_call", "Test a support call", "test", { proveMissionId: "voice_calls", href: "integrations", focusConnectionId: "voice_channel" }),
    step("go_live", "Go live", "go_live"),
  ],
  lead_follow_up: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("setup_forms", "Set up website lead capture", "connect", {
      connectionIds: ["website_forms"],
      href: "integrations",
      focusConnectionId: "website_forms",
      hint: "Forms create People contacts — then you approve follow-up drafts.",
    }),
    step("test_form", "Test a lead", "test", {
      proveMissionId: "website_forms",
      href: "integrations",
      focusConnectionId: "website_forms",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  website_chatbot: [
    step("setup_forms", "Set up website forms", "connect", {
      connectionIds: ["website_forms"],
      href: "integrations",
      focusConnectionId: "website_forms",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_form", "Test form intake", "test", { proveMissionId: "website_forms", href: "integrations", focusConnectionId: "website_forms" }),
    step("go_live", "Go live", "go_live"),
  ],
  website_native_chat: [
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_chat", "Test website chat", "test", { proveMissionId: "website_chat", href: "integrations" }),
    step("go_live", "Go live", "go_live"),
  ],
  knowledge_assistant: [
    step("add_knowledge", "Upload playbooks & FAQs", "knowledge", { href: "knowledge" }),
    step("test_ask", "Test Ask against Knowledge", "test", { proveMissionId: "knowledge_consult", href: "knowledge" }),
    step("go_live", "Go live", "go_live"),
  ],
  scheduling: [
    step("connect_calendar", "Connect calendar", "connect", {
      connectionIds: ["calendar", "google_calendar"],
      href: "integrations",
      focusConnectionId: "calendar",
    }),
    step("test_event", "Test a calendar booking", "test", {
      proveMissionId: "calendar_scheduling",
      href: "integrations",
      focusConnectionId: "calendar",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  sales_assistant: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_email", "Test approved email", "test", {
      proveMissionId: "customer_email_send",
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  crm_automation: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("setup_forms", "Connect lead intake", "connect", {
      connectionIds: ["website_forms"],
      href: "integrations",
      focusConnectionId: "website_forms",
    }),
    step("test_form", "Test a pipeline update", "test", {
      proveMissionId: "website_forms",
      href: "integrations",
      focusConnectionId: "website_forms",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  basic_integration: [
    step("connect_one", "Connect email, calendar, or texting", "connect", {
      connectionIds: ["business_email", "gmail", "calendar", "google_calendar", "sms_channel"],
      href: "integrations",
      hint: "Connect the channel you bought — then test it.",
    }),
    step("test_channel", "Test the connection", "test", {
      proveMissionId: "customer_email_send",
      href: "integrations",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  crm_external_integration: [
    step("connect_crm", "Connect HubSpot, HighLevel, or Salesforce", "connect", {
      connectionIds: ["hubspot", "highlevel", "salesforce"],
      href: "integrations",
      hint: "Request setup — VIBETech connects HubSpot/HighLevel, or scopes Salesforce as Custom Build.",
    }),
    step("test_sync", "Test contact sync", "test", {
      proveMissionIds: ["crm_hubspot", "crm_highlevel"],
      connectionIds: ["hubspot", "highlevel", "salesforce"],
      href: "integrations",
      hint: "Run Test it works on HubSpot/HighLevel, or wait for Salesforce Custom Build attestation.",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  multi_system_integration: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("connect_calendar", "Connect calendar", "connect", {
      connectionIds: ["calendar", "google_calendar"],
      href: "integrations",
      focusConnectionId: "calendar",
    }),
    step("test_email", "Test email", "test", { proveMissionId: "customer_email_send", href: "integrations", focusConnectionId: "business_email" }),
    step("go_live", "Go live", "go_live"),
  ],
  essential_managed: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("connect_sms", "Set up text messaging", "connect", {
      connectionIds: ["sms_channel"],
      href: "integrations",
      focusConnectionId: "sms_channel",
      hint: "Connected is not enough — carrier approval must show approved before this step completes.",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_email", "Test email", "test", { proveMissionId: "customer_email_send", href: "integrations", focusConnectionId: "business_email" }),
    step("test_sms", "Test a text", "test", {
      proveMissionId: "sms_send",
      href: "integrations",
      focusConnectionId: "sms_channel",
      hint: "Run Test it works on text messaging with a real send.",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  growth_managed: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("connect_phone", "Connect business phone", "connect", {
      connectionIds: ["voice_channel"],
      href: "integrations",
      focusConnectionId: "voice_channel",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_email", "Test email", "test", { proveMissionId: "customer_email_send", href: "integrations", focusConnectionId: "business_email" }),
    step("test_call", "Test a call", "test", {
      proveMissionId: "voice_calls",
      href: "integrations",
      focusConnectionId: "voice_channel",
      hint: "Run Test it works on business phone with a real call.",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  professional_managed: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_email", "Test email", "test", { proveMissionId: "customer_email_send", href: "integrations", focusConnectionId: "business_email" }),
    step("go_live", "Go live", "go_live"),
  ],
  enterprise_managed: [
    step("connect_email", "Connect business email", "connect", {
      connectionIds: ["business_email", "gmail"],
      href: "integrations",
      focusConnectionId: "business_email",
    }),
    step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }),
    step("test_ask", "Test Knowledge", "test", { proveMissionId: "knowledge_consult", href: "knowledge" }),
    step("go_live", "Go live", "go_live"),
  ],
  social_content_automation: [
    step("add_knowledge", "Add brand Knowledge", "knowledge", { href: "knowledge" }),
    step("test_content", "Test a content draft", "test", { proveMissionId: "knowledge_consult", href: "knowledge" }),
    step("go_live", "Go live", "go_live"),
  ],
  marketing_content_engine: [
    step("add_knowledge", "Add brand Knowledge", "knowledge", { href: "knowledge" }),
    step("test_content", "Test a marketing draft", "test", { proveMissionId: "knowledge_consult", href: "knowledge" }),
    step("go_live", "Go live", "go_live"),
  ],
  sales_analytics: [
    step("add_knowledge", "Confirm business profile", "knowledge", { href: "knowledge" }),
    step("open_analytics", "Open sales analytics in Settings", "test", {
      proveMissionId: "knowledge_consult",
      hint: "Numbers come from real People and Outcomes — not forecasts.",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  document_processing: [
    step("add_knowledge", "Add sample documents", "knowledge", { href: "knowledge" }),
    step("test_extract", "Test document extract", "test", { proveMissionId: "knowledge_consult", href: "knowledge" }),
    step("go_live", "Go live", "go_live"),
  ],
  reporting_automation: [
    step("add_knowledge", "Confirm business profile", "knowledge", { href: "knowledge" }),
    step("test_digest", "Test owner digest", "test", { proveMissionId: "knowledge_consult" }),
    step("go_live", "Go live", "go_live"),
  ],
  addon_executive_dashboard: [
    step("open_dashboard", "Open Executive Dashboard in Settings", "test", {
      proveMissionId: "knowledge_consult",
    }),
    step("go_live", "Go live", "go_live"),
  ],
  addon_additional_ai_agent: [
    step("go_live", "Entitlement active", "go_live", {
      hint: "Extra AI agent capacity is on — VIBETech configures the worker with you if needed.",
    }),
  ],
  addon_additional_workflow: [
    step("go_live", "Entitlement active", "go_live", {
      hint: "Extra workflow capacity is on — VIBETech configures the path with you if needed.",
    }),
  ],
  addon_additional_integration: [
    step("connect_extra", "Connect the extra integration", "connect", {
      href: "integrations",
    }),
    step("go_live", "Go live", "go_live"),
  ],
};

const CONSULTING_CARD = deepFreeze([
  step("consulting", "VIBETech delivers this with you", "consulting", {
    hint: "This is a human engagement — no app connect wizard. We’ll schedule and deliver.",
  }),
]);

const MISSION_TO_CONNECTION = {
  voice_calls: ["voice_channel"],
  customer_email_send: ["business_email", "gmail"],
  calendar_scheduling: ["calendar", "google_calendar"],
  sms_send: ["sms_channel"],
  website_forms: ["website_forms"],
  meta_lead_intake: ["meta_lead_ads"],
  website_chat: [],
  knowledge_consult: [],
  outbound_approvals: [],
};

/**
 * @param {string} id
 * @param {string} label
 * @param {OwnerSetupStep["kind"]} kind
 * @param {Partial<OwnerSetupStep>} [extra]
 * @returns {OwnerSetupStep}
 */
function step(id, label, kind, extra = {}) {
  const proveMissionIds = Array.isArray(extra.proveMissionIds)
    ? [...extra.proveMissionIds]
    : (extra.proveMissionId ? [extra.proveMissionId] : []);
  return {
    id,
    label,
    kind,
    hint: extra.hint ?? null,
    connectionIds: Array.isArray(extra.connectionIds) ? [...extra.connectionIds] : [],
    proveMissionId: proveMissionIds[0] ?? null,
    proveMissionIds,
    href: extra.href ?? null,
    focusConnectionId: extra.focusConnectionId ?? null,
  };
}

function fallbackFromMissions(packageId) {
  const pkg = getSalesPackage(packageId);
  const missions = Array.isArray(pkg?.launchMissionIds) ? pkg.launchMissionIds.map(String) : [];
  const steps = [];
  const seenConn = new Set();
  for (const mission of missions) {
    const conns = MISSION_TO_CONNECTION[mission] ?? [];
    for (const c of conns) {
      if (seenConn.has(c)) continue;
      seenConn.add(c);
      steps.push(step(`connect_${c}`, `Connect ${humanConnection(c)}`, "connect", {
        connectionIds: [c],
        href: "integrations",
        focusConnectionId: c,
      }));
    }
  }
  if (missions.includes("knowledge_consult") || !steps.length) {
    steps.push(step("add_knowledge", "Add Knowledge", "knowledge", { href: "knowledge" }));
  }
  const testMission = missions.find((m) => m !== "outbound_approvals" && m !== "knowledge_consult")
    ?? missions.find((m) => m === "knowledge_consult")
    ?? null;
  if (testMission) {
    steps.push(step(`test_${testMission}`, `Test ${humanMission(testMission)}`, "test", {
      proveMissionId: testMission,
      href: testMission === "knowledge_consult" ? "knowledge" : "integrations",
    }));
  }
  steps.push(step("go_live", "Go live", "go_live"));
  return steps;
}

function humanConnection(id) {
  const map = {
    voice_channel: "business phone",
    business_email: "business email",
    gmail: "business email",
    calendar: "calendar",
    google_calendar: "calendar",
    sms_channel: "text messaging",
    website_forms: "website forms",
    meta_lead_ads: "Meta lead ads",
    hubspot: "HubSpot",
    highlevel: "HighLevel",
    salesforce: "Salesforce",
  };
  return map[id] ?? id.replace(/_/g, " ");
}

function humanMission(id) {
  const map = {
    voice_calls: "a call",
    customer_email_send: "email",
    calendar_scheduling: "a calendar booking",
    sms_send: "a text",
    website_forms: "a website lead",
    website_chat: "website chat",
    knowledge_consult: "Ask against Knowledge",
    meta_lead_intake: "a Meta lead",
  };
  return map[id] ?? id.replace(/_/g, " ");
}

/**
 * @param {string} packageId
 * @returns {OwnerSetupStep[]}
 */
export function getOwnerSetupSteps(packageId) {
  const id = String(packageId ?? "").trim();
  if (!id) return deepFreeze([]);
  if (id === "managed_revenue_follow_through") return deepFreeze([]);
  if (EXPLICIT[id]) return deepFreeze(EXPLICIT[id].map((s) => ({ ...s })));
  const pkg = getSalesPackage(id);
  if (!pkg) return deepFreeze([...CONSULTING_CARD]);
  if (pkg.commercialStatus === "human_service" || pkg.sellable === false && !pkg.launchMissionIds) {
    return deepFreeze([...CONSULTING_CARD]);
  }
  return deepFreeze(fallbackFromMissions(id));
}

export function listPackagesWithOwnerSetup() {
  return deepFreeze(
    listSellableSalesPackagesForAdmin()
      .map((p) => p.id)
      .filter((id) => id !== "managed_revenue_follow_through")
      .map((id) => ({ packageId: id, steps: getOwnerSetupSteps(id) })),
  );
}

export function getConsultingSetupCard() {
  return deepFreeze([...CONSULTING_CARD]);
}
