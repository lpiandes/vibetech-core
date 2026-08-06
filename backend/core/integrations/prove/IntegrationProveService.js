/**
 * Integration prove tests — OAuth alone is never "proven".
 * Each prove action runs a safe test and records capability_proof intent.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { evaluateOutboundSendPermission } from "../../approvals/OutboundApprovalGate.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

export const PROVE_ACTIONS = Object.freeze({
  send_test_email: "send_test_email",
  create_test_event: "create_test_event",
  send_test_sms: "send_test_sms",
  place_test_call: "place_test_call",
  ingest_test_lead: "ingest_test_lead",
  upload_and_cite: "upload_and_cite",
  approve_and_send: "approve_and_send",
  run_sports_golden_path: "run_sports_golden_path",
  run_dental_golden_path: "run_dental_golden_path",
  submit_test_form: "submit_test_form",
  run_sample_social_screen: "run_sample_social_screen",
  prove_appointment_setter_sms: "prove_appointment_setter_sms",
  prove_team_availability: "prove_team_availability",
  sync_test_crm_contact: "sync_test_crm_contact",
});

const CONNECTIONLESS_ACTIONS = new Set([
  PROVE_ACTIONS.upload_and_cite,
  PROVE_ACTIONS.approve_and_send,
  PROVE_ACTIONS.submit_test_form,
  // Reads installation state directly — no external provider connection to check.
  PROVE_ACTIONS.prove_team_availability,
]);

/**
 * @param {{
 *   action: string,
 *   connectionStatus?: string,
 *   execute?: (input: object) => Promise<object>|object,
 *   outboundApproved?: boolean,
 *   nowISO?: string,
 * }} input
 */
export async function runIntegrationProveTest({
  action,
  connectionStatus = "NOT_CONNECTED",
  execute = null,
  outboundApproved = true,
  nowISO = new Date().toISOString(),
} = {}) {
  const act = String(action ?? "");
  const connected =
    CONNECTIONLESS_ACTIONS.has(act)
    || String(connectionStatus).toUpperCase() === "CONNECTED";

  if (!connected) {
    return deepFreeze({
      ok: false,
      verified: false,
      reason: "not_connected",
      status: "needs_setup",
      message: "Connect the provider before running a prove test.",
      at: nowISO,
    });
  }

  if (act === PROVE_ACTIONS.send_test_email || act === PROVE_ACTIONS.send_test_sms) {
    const capability =
      act === PROVE_ACTIONS.send_test_sms
        ? INTEGRATION_CAPABILITIES.SEND_SMS
        : INTEGRATION_CAPABILITIES.SEND_EMAIL;
    const channel = act === PROVE_ACTIONS.send_test_sms ? "sms" : "email";
    const gate = evaluateOutboundSendPermission({
      capability,
      channel,
      outboundApproved,
    });
    if (!gate.allowed) {
      return deepFreeze({
        ok: false,
        verified: true,
        reason: gate.reason ?? "outbound_approval_required",
        status: "verified",
        message:
          "Credentials look connected, but customer send still needs owner approval (platform law).",
        at: nowISO,
        honestLabel:
          act === PROVE_ACTIONS.send_test_email
            ? "Send approved email (not full inbox)"
            : "Send approved SMS",
      });
    }
  }

  // Fail closed — never default to a simulated pass.
  let execution = { ok: false, reason: "execute_missing", message: "Prove executor was not provided." };
  if (typeof execute === "function") {
    execution = await execute({ action: act, nowISO });
  }

  if (execution?.ok === false || execution == null) {
    return deepFreeze({
      ok: false,
      verified: true,
      reason: execution?.reason ?? "prove_failed",
      status: "failed",
      message: execution?.message ?? "Prove test failed.",
      detail: execution,
      at: nowISO,
    });
  }

  // Outbound / CRM proves must be live — simulated passes never count as Done.
  if (
    act === PROVE_ACTIONS.send_test_sms
    || act === PROVE_ACTIONS.send_test_email
    || act === PROVE_ACTIONS.sync_test_crm_contact
  ) {
    const ref = execution.externalReference ?? execution.messageId ?? execution.providerId ?? null;
    if (execution.simulated === true || !ref) {
      return deepFreeze({
        ok: false,
        verified: true,
        reason: execution.simulated ? "simulated_not_allowed" : "missing_provider_reference",
        status: "failed",
        message: act === PROVE_ACTIONS.send_test_sms
          ? "SMS prove did not send a real Twilio message. Check credentials, A2P/trial limits, and the destination number."
          : act === PROVE_ACTIONS.sync_test_crm_contact
            ? "CRM prove did not create a real HubSpot/HighLevel record. Reconnect and retry."
          : "Email prove did not send a real message. Reconnect Gmail and try again.",
        detail: execution,
        at: nowISO,
      });
    }
  }

  return deepFreeze({
    ok: true,
    verified: true,
    status: "proven",
    proveAction: act,
    at: nowISO,
    detail: execution,
    message: proveSuccessMessage(act),
    honestLabel:
      act === PROVE_ACTIONS.send_test_email
        ? "Send approved email (not full inbox)"
        : null,
  });
}

function proveSuccessMessage(action) {
  if (action === PROVE_ACTIONS.send_test_email) {
    return "Test email sent successfully after approval.";
  }
  if (action === PROVE_ACTIONS.create_test_event) {
    return "Test calendar event created successfully.";
  }
  if (action === PROVE_ACTIONS.send_test_sms) {
    return "Test SMS delivered successfully after approval.";
  }
  if (action === PROVE_ACTIONS.ingest_test_lead) {
    return "Test Meta lead reached the intake pipeline.";
  }
  if (action === PROVE_ACTIONS.upload_and_cite) {
    return "Knowledge is citeable — AI will use tagged docs, never invent.";
  }
  if (action === PROVE_ACTIONS.approve_and_send) {
    return "Outbound gate confirmed — customer send still requires owner GRANT.";
  }
  if (action === PROVE_ACTIONS.run_sports_golden_path) {
    return "Sports registration golden path completed.";
  }
  if (action === PROVE_ACTIONS.run_dental_golden_path) {
    return "Dental intake golden path completed (non-PHI).";
  }
  if (action === PROVE_ACTIONS.submit_test_form) {
    return "Test website form submission saved to People.";
  }
  if (action === PROVE_ACTIONS.place_test_call) {
    return "Prove call placed — AI receptionist answers. Customer outbound calls stay approval-gated.";
  }
  if (action === PROVE_ACTIONS.prove_appointment_setter_sms) {
    return "Twilio SMS is configured for the appointment setter.";
  }
  if (action === PROVE_ACTIONS.prove_team_availability) {
    return "At least one teammate has bookable weekly availability — the appointment setter can auto-book.";
  }
  if (action === PROVE_ACTIONS.sync_test_crm_contact) {
    return "CRM prove contact created with a provider record id.";
  }
  return "Prove test passed.";
}

export function proofRecordFromResult(capabilityId, result) {
  return deepFreeze({
    capabilityId: String(capabilityId),
    ok: Boolean(result?.ok),
    verified: Boolean(result?.verified),
    at: result?.at ?? null,
    proveAction: result?.proveAction ?? null,
    detail: result?.detail ?? {},
  });
}
