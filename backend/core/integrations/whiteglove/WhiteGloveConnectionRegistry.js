/**
 * Which Connections need VIBETech ops (white-glove) vs owner self-serve / AI.
 * Owner never pastes Twilio SID/tokens for white-glove channels.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * @typedef {{
 *   connectionId: string,
 *   playbookId: string,
 *   ownerTitle: string,
 *   ownerPendingCopy: string,
 *   ownerReadyCopy: string,
 *   ownerRequestIntro?: string,
 *   collectFromOwner?: string[],
 *   proveCapabilityId?: string | null,
 *   markReadyRequiresConnected?: boolean,
 *   opsNotifyPolicy?: "always" | "only_if_ops_needed" | "never",
 * }} WhiteGloveConnection
 *
 * @typedef {{ all?: string[], anyOf?: string[] }} PackageWhiteGloveSpec
 */

/** @type {Record<string, WhiteGloveConnection>} */
const WHITE_GLOVE = {
  voice_channel: {
    connectionId: "voice_channel",
    playbookId: "twilio_voice_connect",
    ownerTitle: "Business phone",
    ownerPendingCopy: "Hold on — VIBETech is setting up your business phone for you.",
    ownerReadyCopy: "Good to go — your business phone is ready. Test a call next.",
    ownerRequestIntro: "We’ll set up your business phone. Optional: add your cell if you want missed calls to ring you first.",
    collectFromOwner: ["cell", "forward", "notes"],
    proveCapabilityId: "voice_calls",
    opsNotifyPolicy: "always",
  },
  sms_channel: {
    connectionId: "sms_channel",
    playbookId: "twilio_sms_provision",
    ownerTitle: "Text messaging",
    ownerPendingCopy: "Hold on — VIBETech is setting up text messaging and carrier approval for you.",
    ownerReadyCopy: "Good to go — texting is ready. Send a test text next.",
    ownerRequestIntro: "Carriers need your legal business details. Follow the short steps, then we’ll buy the number and finish approval.",
    collectFromOwner: ["brand", "ein", "contactEmail", "notes"],
    proveCapabilityId: "sms_send",
    opsNotifyPolicy: "always",
  },
  meta_lead_ads: {
    connectionId: "meta_lead_ads",
    playbookId: "meta_lead_connect_existing",
    ownerTitle: "Meta Lead Forms",
    ownerPendingCopy: "Hold on — VIBETech is connecting your Meta Lead Forms.",
    ownerReadyCopy: "Good to go — Meta Lead Forms are connected. Test a lead next.",
    ownerRequestIntro: "Tell us which Facebook Page runs your Lead Forms — we’ll connect the webhook and tokens.",
    collectFromOwner: ["pageName", "pageUrl", "notes"],
    proveCapabilityId: "meta_lead_ingest",
    opsNotifyPolicy: "always",
  },
  hubspot: {
    connectionId: "hubspot",
    playbookId: "hubspot_connect",
    ownerTitle: "HubSpot",
    ownerPendingCopy: "Hold on — VIBETech is connecting HubSpot for you.",
    ownerReadyCopy: "Good to go — HubSpot is connected. Test a contact sync next.",
    ownerRequestIntro: "To connect HubSpot for you we need portal details and access — follow the steps (don’t paste private app tokens here).",
    collectFromOwner: ["hubspotPortal", "accessInvite"],
    proveCapabilityId: "crm_hubspot",
    opsNotifyPolicy: "always",
  },
  highlevel: {
    connectionId: "highlevel",
    playbookId: "highlevel_connect",
    ownerTitle: "HighLevel",
    ownerPendingCopy: "Hold on — VIBETech is connecting HighLevel for you.",
    ownerReadyCopy: "Good to go — HighLevel is connected. Test a contact sync next.",
    ownerRequestIntro: "We need two things only: Location ID + how we get access. Follow the steps under each field.",
    collectFromOwner: ["locationId", "accessInvite"],
    proveCapabilityId: "crm_highlevel",
    opsNotifyPolicy: "always",
  },
  /**
   * Salesforce is request-only: no in-app token paste / fake Connected.
   * Ops delivers via Custom Build / SOW, then attests ready.
   */
  salesforce: {
    connectionId: "salesforce",
    playbookId: "salesforce_connect",
    ownerTitle: "Salesforce",
    ownerPendingCopy: "Hold on — VIBETech is scoping Salesforce for you (Custom Build).",
    ownerReadyCopy: "Good to go — Salesforce work is ready for your sign-off.",
    ownerRequestIntro: "One required field: org name, Production vs Sandbox, admin contact, and must-have objects.",
    collectFromOwner: ["salesforceOrg"],
    proveCapabilityId: null,
    /** No durable vault connect path yet — Mark ready is ops attestation. */
    markReadyRequiresConnected: false,
    opsNotifyPolicy: "always",
  },
};

/** Owner (or AI) can finish these without ops. */
const SELF_SERVE = new Set([
  "business_email",
  "calendar",
  "google_calendar",
  "website_forms",
  "website_chat",
]);

/**
 * Package → white-glove needs.
 * - all: every id required
 * - anyOf: one of the ids is enough (e.g. HubSpot or HighLevel)
 * Aligned with OwnerPackageSetupRegistry checklists — do not invent channels the checklist omits.
 */
/** @type {Record<string, PackageWhiteGloveSpec>} */
const PACKAGE_WHITE_GLOVE = {
  ai_receptionist: { all: ["voice_channel"] },
  voice_inbound_agent: { all: ["voice_channel"] },
  voice_outbound_agent: { all: ["voice_channel"] },
  voice_scheduling_agent: { all: ["voice_channel"] },
  voice_support_agent: { all: ["voice_channel"] },
  // Lead follow-up checklist = email + forms (self-serve). No SMS handoff.
  lead_follow_up: { all: [] },
  essential_managed: { all: ["sms_channel"] },
  growth_managed: { all: ["voice_channel"] },
  professional_managed: { all: [] },
  enterprise_managed: { all: [] },
  crm_external_integration: { anyOf: ["hubspot", "highlevel", "salesforce"] },
  appointment_setter: { all: ["meta_lead_ads", "sms_channel", "voice_channel"] },
};

/** Alias → canonical connection id. */
const CONNECTION_ALIASES = {
  voice: "voice_channel",
  phone: "voice_channel",
  call: "voice_channel",
  voice_channel: "voice_channel",
  sms: "sms_channel",
  text: "sms_channel",
  texting: "sms_channel",
  sms_channel: "sms_channel",
  meta: "meta_lead_ads",
  facebook: "meta_lead_ads",
  fb: "meta_lead_ads",
  meta_lead_ads: "meta_lead_ads",
  hubspot: "hubspot",
  highlevel: "highlevel",
  gohighlevel: "highlevel",
  "go high level": "highlevel",
  salesforce: "salesforce",
  sfdc: "salesforce",
};

export function normalizeConnectionId(raw) {
  const key = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!key) return null;
  if (CONNECTION_ALIASES[key]) return CONNECTION_ALIASES[key];
  if (WHITE_GLOVE[key]) return key;
  return null;
}

export function isWhiteGloveConnection(connectionId) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  return Boolean(WHITE_GLOVE[id]);
}

export function isSelfServeConnection(connectionId) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  return SELF_SERVE.has(id);
}

export function getWhiteGloveConnection(connectionId) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  const row = WHITE_GLOVE[id];
  return row ? deepFreeze({ ...row }) : null;
}

export function listWhiteGloveConnections() {
  return deepFreeze(Object.values(WHITE_GLOVE).map((r) => ({ ...r })));
}

export function resolvePackageWhiteGloveSpec(packageId) {
  const raw = PACKAGE_WHITE_GLOVE[String(packageId ?? "")];
  if (!raw) return deepFreeze({ all: [], anyOf: [] });
  if (Array.isArray(raw)) {
    return deepFreeze({ all: [...raw], anyOf: [] });
  }
  return deepFreeze({
    all: Array.isArray(raw.all) ? [...raw.all] : [],
    anyOf: Array.isArray(raw.anyOf) ? [...raw.anyOf] : [],
  });
}

/**
 * @deprecated Prefer resolveWhiteGloveNeeds from resolveWhiteGloveNeeds.js
 */
export function resolveWhiteGloveNeedsForPackages(purchasedPackages = []) {
  const ids = new Set();
  for (const pkg of Array.isArray(purchasedPackages) ? purchasedPackages : []) {
    const spec = resolvePackageWhiteGloveSpec(pkg);
    for (const id of spec.all) ids.add(id);
    for (const id of spec.anyOf) ids.add(id);
  }
  return deepFreeze([...ids].map((id) => getWhiteGloveConnection(id)).filter(Boolean));
}

export function playbookIdForConnection(connectionId, { needEverything = false } = {}) {
  const id = normalizeConnectionId(connectionId) ?? String(connectionId ?? "");
  if (id === "meta_lead_ads" && needEverything) return "meta_lead_create_from_scratch";
  return WHITE_GLOVE[id]?.playbookId ?? null;
}

/**
 * Whether Mark ready needs a live Connected status.
 * Salesforce / Custom Build channels may attest without vault credentials.
 */
export function markReadyRequiresConnected(connectionId) {
  const row = getWhiteGloveConnection(connectionId);
  if (!row) return true;
  return row.markReadyRequiresConnected !== false;
}
