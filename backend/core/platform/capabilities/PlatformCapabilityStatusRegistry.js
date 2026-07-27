/**
 * Unified capability status model (Codex): one source of truth for Launch Center + Connections.
 *
 * Status ladder (never call OAuth alone "proven"):
 *   available → needs_setup → connected → verified → proven
 *   degraded | failed | paused | unsupported
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { shouldListConnection } from "../vertical/SurfaceInventory.js";

export const CAPABILITY_STATUSES = Object.freeze([
  "available",
  "needs_setup",
  "connected",
  "verified",
  "proven",
  "degraded",
  "failed",
  "paused",
  "unsupported",
]);

export const PLATFORM_CAPABILITIES = deepFreeze([
  {
    id: "customer_email_send",
    label: "Send approved customer email",
    description: "Draft freely; send only after owner approval. Inbound inbox reading is not claimed until built.",
    verticals: ["*"],
    requiredIntegrations: ["business_email"],
    requiredPermissions: ["integrations.manage"],
    proveAction: "send_test_email",
    honestLabel: "Send approved email (not full inbox)",
  },
  {
    id: "calendar_scheduling",
    label: "Calendar scheduling",
    description: "Create appointments on the connected calendar.",
    verticals: ["*"],
    requiredIntegrations: ["calendar"],
    requiredPermissions: ["integrations.manage"],
    proveAction: "create_test_event",
  },
  {
    id: "sms_send",
    label: "Send approved SMS",
    description: "Twilio SMS after human approval.",
    verticals: ["*"],
    requiredIntegrations: ["sms_channel"],
    requiredPermissions: ["integrations.manage"],
    proveAction: "send_test_sms",
  },
  {
    id: "voice_calls",
    label: "Approved voice calls",
    description: "AI phone receptionist (Knowledge-backed). Prove places a live call. Customer outbound stays approval-gated.",
    verticals: ["*"],
    requiredIntegrations: ["voice_channel"],
    requiredPermissions: ["integrations.manage"],
    proveAction: "place_test_call",
  },
  {
    id: "meta_lead_intake",
    label: "Meta lead intake",
    description: "Lead form → contact → intake pipeline Work.",
    verticals: ["*", "sports", "dental", "property_management"],
    requiredIntegrations: ["meta_lead_ads"],
    requiredPermissions: ["integrations.manage"],
    proveAction: "ingest_test_lead",
  },
  {
    id: "website_forms",
    label: "Website form intake",
    description: "Hosted intake form creates contact + Work.",
    verticals: ["*"],
    requiredIntegrations: [],
    requiredPermissions: ["integrations.manage"],
    proveAction: "submit_test_form",
    defaultStatus: "available",
  },
  {
    id: "knowledge_consult",
    label: "Citeable Knowledge",
    description: "AI consults tagged Knowledge; gaps shown, never invented.",
    verticals: ["*"],
    requiredIntegrations: [],
    requiredPermissions: ["knowledge.manage"],
    proveAction: "upload_and_cite",
  },
  {
    id: "outbound_approvals",
    label: "Approve-first outbound",
    description: "Customer email/SMS/call always requires GRANT.",
    verticals: ["*"],
    requiredIntegrations: [],
    requiredPermissions: [],
    proveAction: "approve_and_send",
  },
  {
    id: "sports_registration_golden_path",
    label: "Sports registration golden path",
    description: "Lead → family → registration pipeline → approved message → schedule.",
    verticals: ["sports"],
    requiredIntegrations: ["business_email"],
    requiredPermissions: [],
    proveAction: "run_sports_golden_path",
  },
  {
    id: "dental_intake_golden_path",
    label: "Dental intake golden path",
    description: "Lead → prospect → intake → appointment → reminder (no PHI until privacy architecture).",
    verticals: ["dental"],
    requiredIntegrations: ["business_email", "calendar"],
    requiredPermissions: [],
    proveAction: "run_dental_golden_path",
    compliance: ["no_phi_until_privacy_architecture"],
  },
  {
    id: "property_pms",
    label: "Property management system",
    description: "PM SoR bridge — quarantined from sports/dental.",
    verticals: ["property_management"],
    requiredIntegrations: ["property_management_system"],
    requiredPermissions: ["integrations.manage"],
    proveAction: "verify_pms_sync",
  },
]);

function normalizeVertical(vertical) {
  const v = String(vertical ?? "").trim().toLowerCase();
  if (v === "youth_sports" || v === "sports_club") return "sports";
  if (v === "general_dentistry" || v === "orthodontics") return "dental";
  return v || "*";
}

export function listCapabilitiesForVertical(vertical) {
  const v = normalizeVertical(vertical);
  return PLATFORM_CAPABILITIES.filter(
    (cap) => cap.verticals.includes("*") || cap.verticals.includes(v),
  );
}

/**
 * Resolve status from connection snapshot + proof records.
 * Proof = explicit successful proveAction result; OAuth alone is never proven.
 */
export function resolveCapabilityStatus({
  capability,
  connectionStatuses = {},
  proofRecords = {},
  healthByConnection = {},
  knowledgeCount = null,
} = {}) {
  if (!capability) return "unsupported";
  if (capability.defaultStatus === "unsupported") return "unsupported";

  const proofs = proofRecords[capability.id];

  // Knowledge is only proven when real docs exist AND prove succeeded.
  if (capability.id === "knowledge_consult") {
    if (knowledgeCount != null && Number(knowledgeCount) < 1) return "needs_setup";
    if (proofs?.ok === true && proofs?.at && (knowledgeCount == null || Number(knowledgeCount) > 0)) {
      return "proven";
    }
    if (knowledgeCount != null && Number(knowledgeCount) > 0) return "verified";
    return "needs_setup";
  }

  if (proofs?.ok === true && proofs?.at) return "proven";

  const required = Array.isArray(capability.requiredIntegrations)
    ? capability.requiredIntegrations
    : [];
  if (required.length === 0) {
    if (capability.defaultStatus === "needs_setup") return "needs_setup";
    return "available";
  }

  const levels = required.map((connId) => {
    const health = String(healthByConnection[connId]?.level ?? "").toUpperCase();
    if (health === "ERROR" || health === "FAILED") return "failed";
    if (health === "NEEDS_ATTENTION" || health === "DEGRADED") return "degraded";
    const st = String(connectionStatuses[connId] ?? "NOT_CONNECTED").toUpperCase();
    if (st === "CONNECTED") return "connected";
    if (st === "ERROR" || st === "FAILED") return "failed";
    if (st === "DEGRADED") return "degraded";
    if (st === "CONFIGURING") return "needs_setup";
    return "needs_setup";
  });

  if (levels.includes("failed")) return "failed";
  if (levels.includes("degraded")) return "degraded";
  if (levels.every((l) => l === "connected")) {
    const verified = proofs?.verified === true;
    return verified ? "verified" : "connected";
  }
  if (levels.some((l) => l === "needs_setup")) return "needs_setup";
  return "available";
}

export function buildCapabilityStatusReport({
  vertical = "*",
  connectionStatuses = {},
  proofRecords = {},
  healthByConnection = {},
  workspaceGate = {},
  knowledgeCount = null,
} = {}) {
  const caps = listCapabilitiesForVertical(vertical).filter((cap) => {
    if (cap.id === "property_pms" && !shouldListConnection("property_management_system", workspaceGate)) {
      return false;
    }
    return true;
  });

  const items = caps.map((capability) => {
    const status = resolveCapabilityStatus({
      capability,
      connectionStatuses,
      proofRecords,
      healthByConnection,
      knowledgeCount,
    });
    return deepFreeze({
      id: capability.id,
      label: capability.label,
      description: capability.description,
      honestLabel: capability.honestLabel ?? null,
      status,
      proveAction: capability.proveAction,
      requiredIntegrations: capability.requiredIntegrations,
      compliance: capability.compliance ?? [],
      isProven: status === "proven",
      isBlocked: status === "needs_setup" || status === "failed" || status === "unsupported",
    });
  });

  return deepFreeze({
    contract: "PlatformCapabilityStatusReport/v1",
    vertical: normalizeVertical(vertical),
    items,
    summary: deepFreeze({
      total: items.length,
      proven: items.filter((i) => i.status === "proven").length,
      connected: items.filter((i) => i.status === "connected" || i.status === "verified").length,
      needsSetup: items.filter((i) => i.status === "needs_setup").length,
      degraded: items.filter((i) => i.status === "degraded" || i.status === "failed").length,
    }),
    rule: "OAuth/connect alone is never proven. Proven requires a successful proveAction.",
  });
}

/**
 * Map capability report → Launch Center missions (truthful wording).
 */
export function capabilityReportToLaunchMissions(report, { businessId, baseHref = null } = {}) {
  const base = baseHref || (businessId ? `/b/${encodeURIComponent(businessId)}` : "");
  return (report?.items ?? []).map((item, index) => {
    const href = missionHrefForCapability(item, base);
    return deepFreeze({
      id: item.id,
      title: item.honestLabel || item.label,
      detail: buildMissionDetail(item),
      href,
      actionLabel: item.isProven ? "Proven" : actionLabelForStatus(item.status, item),
      complete: item.isProven,
      blocked: item.status === "unsupported",
      blockedReason: item.status === "unsupported" ? "Not available until end-to-end is built." : null,
      blockedByMission: undefined,
      status: item.status,
      proveAction: item.proveAction,
      requiredIntegrations: item.requiredIntegrations ?? [],
      optional: !item.requiredIntegrations?.length,
      missionIndex: index + 1,
    });
  });
}

function buildMissionDetail(item) {
  if (item.status === "proven") return "Passed a real prove test.";
  if (item.status === "verified") return "Credentials verified. Run the prove test to mark proven.";
  if (item.status === "connected") return "Connected. Verify and run a real test before calling this proven.";
  if (item.status === "degraded") return "Connected but unhealthy — reconnect, then re-prove.";
  if (item.status === "failed") return "Last attempt failed. Fix the connection error.";
  if (item.status === "unsupported") return item.description;
  if (item.status === "available" && !item.requiredIntegrations?.length) {
    return item.description;
  }
  return item.description;
}

function actionLabelForStatus(status, item = null) {
  if (status === "connected" || status === "verified") return "Run prove test";
  if (status === "available" && !item?.requiredIntegrations?.length) return "Run prove test";
  if (status === "degraded" || status === "failed") return "Fix connection";
  if (status === "unsupported") return "Coming later";
  return "Set up";
}

function missionHrefForCapability(item, base) {
  // Knowledge is never an Integrations connect — always open Knowledge upload.
  if (item.id.includes("knowledge") && base) return `${base}/knowledge?add=1`;
  const first = item.requiredIntegrations?.[0];
  if (item.id === "website_forms" && base) {
    return `${base}/intake`;
  }
  if (first && base) {
    const home = `${base}/home`;
    return `${base}/integrations?focus=${encodeURIComponent(first)}&returnTo=${encodeURIComponent(home)}`;
  }
  if (item.id.includes("approval") && base) return `${base}/home`;
  if (base) return `${base}/integrations?returnTo=${encodeURIComponent(`${base}/home`)}`;
  return "/integrations";
}
