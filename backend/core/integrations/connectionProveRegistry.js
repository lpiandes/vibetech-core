/**
 * Canonical connection prove map — Integrations "Test it works" + package checklists.
 * Keep capability ids aligned with IntegrationProveService / capability proof records.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/** @type {Record<string, { action: string, capabilityId: string }>} */
const CONNECTION_PROVE = {
  business_email: { action: "send_test_email", capabilityId: "customer_email_send" },
  gmail: { action: "send_test_email", capabilityId: "customer_email_send" },
  calendar: { action: "create_test_event", capabilityId: "calendar_scheduling" },
  google_calendar: { action: "create_test_event", capabilityId: "calendar_scheduling" },
  sms_channel: { action: "send_test_sms", capabilityId: "sms_send" },
  voice_channel: { action: "place_test_call", capabilityId: "voice_calls" },
  meta_lead_ads: { action: "ingest_test_lead", capabilityId: "meta_lead_ingest" },
  website_forms: { action: "submit_test_form", capabilityId: "website_forms" },
  website_chat: { action: "submit_test_chat", capabilityId: "website_chat" },
  hubspot: { action: "sync_test_crm_contact", capabilityId: "crm_hubspot" },
  highlevel: { action: "sync_test_crm_contact", capabilityId: "crm_highlevel" },
};

export function proveActionForConnectionId(connectionId) {
  const row = CONNECTION_PROVE[String(connectionId ?? "")];
  return row ? deepFreeze({ ...row }) : null;
}

export function listConnectionProveIds() {
  return deepFreeze(Object.keys(CONNECTION_PROVE));
}

/**
 * True when any listed capability proof is honest/ok.
 */
export function anyProofOk(proofRecords = {}, capabilityIds = []) {
  const ids = Array.isArray(capabilityIds) ? capabilityIds : [capabilityIds];
  for (const id of ids.filter(Boolean).map(String)) {
    const row = proofRecords?.[id] ?? proofRecords?.[String(id)];
    if (!row) continue;
    if (row.ok === true || row.verified === true) return true;
  }
  return false;
}
