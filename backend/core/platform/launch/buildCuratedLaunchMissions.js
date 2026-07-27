/**
 * Curate Launch Center missions — capability registry only (no checklist dump).
 * Prioritize by vertical so sports/dental feel sharp, not a 19-item wall.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isSmsBrandComplete } from "../../integrations/twilio/smsBrandCompleteness.js";
import {
  buildCapabilityStatusReport,
  capabilityReportToLaunchMissions,
} from "../capabilities/PlatformCapabilityStatusRegistry.js";
import { filterLaunchMissionsForPurchasedPackages } from "../packages/SalesPackageCatalog.js";

/** Checklist step id → connection id used by capability registry */
export const CHECKLIST_TO_CONNECTION = Object.freeze({
  email: "business_email",
  calendar: "calendar",
  sms: "sms_channel",
  voice: "voice_channel",
  meta_lead_ads: "meta_lead_ads",
});

const LAUNCH_PRIORITY = Object.freeze({
  sports: [
    "customer_email_send",
    "calendar_scheduling",
    "knowledge_consult",
    "outbound_approvals",
    "sports_registration_golden_path",
    "sms_send",
    "meta_lead_intake",
    "website_forms",
    "voice_calls",
  ],
  dental: [
    "customer_email_send",
    "calendar_scheduling",
    "knowledge_consult",
    "outbound_approvals",
    "dental_intake_golden_path",
    "sms_send",
    "meta_lead_intake",
    "website_forms",
    "voice_calls",
  ],
  "*": [
    "customer_email_send",
    "calendar_scheduling",
    "knowledge_consult",
    "outbound_approvals",
    "sms_send",
    "meta_lead_intake",
    "website_forms",
    "voice_calls",
  ],
});

/**
 * Derive connectionStatuses from live connections + checklist completeness.
 */
export function deriveLaunchConnectionStatuses({
  connections = [],
  checklist = [],
  connectionStatuses = {},
} = {}) {
  const out = {};

  // Snapshot / connection rows are a baseline — live connectionStatuses win so a
  // just-verified SMS/calendar connect is not overwritten by a stale ERROR row.
  for (const conn of Array.isArray(connections) ? connections : []) {
    const id = String(conn?.id ?? "");
    if (!id) continue;
    out[id] = String(conn?.status ?? "NOT_CONNECTED");
  }

  for (const [id, status] of Object.entries(
    connectionStatuses && typeof connectionStatuses === "object" ? connectionStatuses : {},
  )) {
    if (!id) continue;
    out[id] = String(status ?? "NOT_CONNECTED");
  }

  for (const item of Array.isArray(checklist) ? checklist : []) {
    const stepId = String(item?.id ?? "");
    const connectionId = CHECKLIST_TO_CONNECTION[stepId];
    if (!connectionId) continue;
    if (item?.complete && !out[connectionId]) {
      out[connectionId] = "CONNECTED";
    }
  }

  return out;
}

/**
 * Seed proof-shaped records from workspace evidence (still require explicit prove for most).
 * Knowledge with docs → verified (ready to prove). Approvals always available.
 */
export function enrichProofRecordsForLaunch({
  proofRecords = {},
  knowledgeCount = 0,
} = {}) {
  const out = { ...(proofRecords && typeof proofRecords === "object" ? proofRecords : {}) };

  if (Number(knowledgeCount) > 0 && !out.knowledge_consult?.ok) {
    out.knowledge_consult = {
      ...(out.knowledge_consult ?? {}),
      verified: true,
      ok: Boolean(out.knowledge_consult?.ok),
      at: out.knowledge_consult?.at ?? null,
    };
  }

  return out;
}

/**
 * Resolve launch vertical from explicit industry / pack only.
 * Never sniff industry from business name keywords (hockey, dental, etc.).
 */
export function resolveLaunchVertical({
  operatingPackId = "",
  industry = "",
  businessName = "",
} = {}) {
  void businessName; // retained for callers; intentionally unused — no name sniffing
  const pack = String(operatingPackId).toLowerCase();
  const ind = String(industry).toLowerCase().replace(/\s+/g, "_");
  if (pack.includes("sport") || ind === "sports" || ind.includes("sport")) {
    return "sports";
  }
  if (pack.includes("dental") || ind === "dental" || ind.includes("dental") || ind.includes("orthodont")) {
    return "dental";
  }
  if (pack.includes("property") || ind.includes("property")) return "property_management";
  return "*";
}

/**
 * Build the Launch Center mission list owners actually work through.
 */
export function buildCuratedLaunchMissions({
  vertical = "*",
  businessId = null,
  baseHref = null,
  connectionStatuses = {},
  proofRecords = {},
  checklist = [],
  connections = [],
  knowledgeCount = 0,
  businessName = "",
  smsSetup = null,
  purchasedPackages = [],
} = {}) {
  const v = resolveLaunchVertical({
    operatingPackId: vertical,
    industry: vertical,
    businessName,
  }) || normalizeVertical(vertical);

  const statuses = deriveLaunchConnectionStatuses({
    connections,
    checklist,
    connectionStatuses,
  });
  const proofs = enrichProofRecordsForLaunch({ proofRecords, knowledgeCount });

  const report = buildCapabilityStatusReport({
    vertical: v,
    connectionStatuses: statuses,
    proofRecords: proofs,
    workspaceGate: { industry: v, operatingPackId: v },
    knowledgeCount,
  });

  let missions = capabilityReportToLaunchMissions(report, {
    businessId,
    baseHref,
  }).map((m) => ({ ...m }));

  // Thin SKUs: drop sports/dental golden-path and Meta/SMS missions the customer did not buy.
  missions = filterLaunchMissionsForPurchasedPackages(missions, purchasedPackages);

  // Knowledge: require real docs before prove / Done. Owner may defer without blocking launch.
  missions = missions.map((m) => {
    if (m.id !== "knowledge_consult") return m;
    const proof = proofs.knowledge_consult;
    const deferred = Boolean(proof?.detail?.deferredByOwner || proof?.deferredByOwner);
    if (Number(knowledgeCount) < 1) {
      if (deferred) {
        return {
          ...m,
          complete: false,
          blocked: false,
          deferred: true,
          blockedReason: null,
          status: "deferred",
          actionLabel: "Add knowledge",
          detail: "Paused — add playbooks or FAQs whenever you’re ready.",
          canProveInline: false,
          href: baseHref ? `${baseHref}/knowledge?add=1` : "/knowledge?add=1",
        };
      }
      return {
        ...m,
        complete: false,
        status: "needs_setup",
        actionLabel: "Add knowledge",
        detail: "Upload playbooks, policies, or FAQs — or skip for now if you don’t have any yet.",
        canProveInline: false,
        href: baseHref ? `${baseHref}/knowledge?add=1` : "/knowledge?add=1",
        canDefer: true,
      };
    }
    if (m.complete) return m;
    return {
      ...m,
      status: "verified",
      actionLabel: "Run prove test",
      detail: "Knowledge is loaded. Run prove to confirm AI can cite it.",
      canProveInline: true,
      href: baseHref ? `${baseHref}/knowledge` : "/knowledge",
    };
  });

  missions = missions.map((m) => {
    if (m.id === "outbound_approvals" && !m.complete) {
      return {
        ...m,
        status: "available",
        actionLabel: "Prove approvals",
        detail: "Confirm outbound still requires owner GRANT before customer send.",
      };
    }
    return m;
  });

  // Website forms: hosted intake form (no third-party connector required).
  missions = missions.map((m) => {
    if (m.id !== "website_forms" || m.complete) return m;
    return {
      ...m,
      blocked: false,
      blockedReason: null,
      status: m.status === "unsupported" ? "available" : m.status,
      actionLabel: "Open intake form",
      detail: "Share your intake form link. Submissions create People contacts and can fire automations.",
      canProveInline: true,
      href: baseHref ? `${baseHref}/intake` : "/intake",
    };
  });

  // SMS: collect A2P brand details before "Send test text" (even if a number is already connected).
  missions = missions.map((m) => {
    if (m.id !== "sms_send" || m.complete) return m;
    const brandComplete = resolveSmsBrandComplete({ smsSetup, connections });
    if (brandComplete) {
      const st = String(m.status ?? "");
      if (st === "connected" || st === "verified") {
        return {
          ...m,
          needsBrandSetup: false,
          canProveInline: true,
          actionLabel: "Send test text",
          detail: "Business details saved. Send a test text, then confirm you got it. US delivery may wait until carrier approval finishes.",
        };
      }
      return { ...m, needsBrandSetup: false };
    }
    return {
      ...m,
      needsBrandSetup: true,
      canProveInline: false,
      status: "needs_setup",
      actionLabel: "Set up",
      detail: "Enter your business and messaging details so we can set up texting and carrier registration. You’ll send a test text after that.",
      phase: "connect",
    };
  });

  const priority = LAUNCH_PRIORITY[v] ?? LAUNCH_PRIORITY["*"];
  const rank = new Map(priority.map((id, i) => [id, i]));
  missions.sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : 100;
    const rb = rank.has(b.id) ? rank.get(b.id) : 100;
    if (ra !== rb) return ra - rb;
    // Incomplete before complete; unsupported last
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
    if (a.complete !== b.complete) return a.complete ? 1 : -1;
    return 0;
  });

  // Drop website_forms from core launch for sports/dental (optional later) — keep if needs_setup only as optional
  missions = missions.map((m, index) => ({
    ...m,
    missionIndex: index + 1,
    phase: launchPhaseFor(m),
    canProveInline: m.canProveInline != null ? m.canProveInline : canProveInline(m),
  }));

  const proven = missions.filter((m) => m.complete).length;
  const actionable = missions.filter((m) => !m.blocked).length;

  return deepFreeze({
    vertical: v,
    missions,
    summary: deepFreeze({
      proven,
      total: missions.length,
      actionable,
      nextId: missions.find((m) => !m.complete && !m.blocked && m.status !== "deferred" && !m.deferred)?.id ?? null,
    }),
  });
}

function normalizeVertical(vertical) {
  const v = String(vertical ?? "").trim().toLowerCase();
  if (v === "youth_sports" || v === "sports_club" || v.includes("sport")) return "sports";
  if (v.includes("dental") || v.includes("ortho")) return "dental";
  return v || "*";
}

function resolveSmsBrandComplete({ smsSetup = null, connections = [] } = {}) {
  if (smsSetup && typeof smsSetup === "object") {
    if (smsSetup.brandComplete === true) return true;
    if (smsSetup.brandComplete === false) return false;
    if (isSmsBrandComplete(smsSetup.brand ?? {})) return true;
  }
  const smsConn = (Array.isArray(connections) ? connections : []).find((c) => {
    const id = String(c?.id ?? c?.connectionType ?? "");
    return id === "sms_channel" || id === "sms_send";
  });
  const meta = smsConn?.metadata && typeof smsConn.metadata === "object" ? smsConn.metadata : {};
  return isSmsBrandComplete(meta.brand ?? smsSetup?.brand ?? {});
}

function launchPhaseFor(mission) {
  if (mission.blocked || mission.status === "unsupported") return "later";
  if (String(mission.id).includes("golden_path")) return "prove_operations";
  if (mission.requiredIntegrations?.length || ["customer_email_send", "calendar_scheduling", "sms_send", "meta_lead_intake"].includes(mission.id)) {
    if (mission.status === "needs_setup" || mission.status === "available") return "connect";
    return "prove_connections";
  }
  return "prove_operations";
}

function canProveInline(mission) {
  if (mission.complete || mission.blocked || !mission.proveAction) return false;
  const st = String(mission.status ?? "");
  if (st === "connected" || st === "verified") return true;
  if (st === "available" && (!mission.requiredIntegrations || mission.requiredIntegrations.length === 0)) {
    return true;
  }
  // Golden path can run once email is connected (or always with simulated)
  if (String(mission.proveAction).includes("golden_path") && (st === "connected" || st === "verified" || st === "available")) {
    return st === "connected" || st === "verified";
  }
  return false;
}
