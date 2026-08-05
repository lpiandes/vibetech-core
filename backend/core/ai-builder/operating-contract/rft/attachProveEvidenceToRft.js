/**
 * Map integration prove actions → RFT provider evidence and attach to opportunity cards.
 */
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import {
  progressRftOpportunity,
  seedRftOpportunity,
} from "./rftOpportunityRuntime.js";
import { readRftLaunch, applyRftLaunchPatch, persistRftLaunch } from "./rftLaunch.js";

export const PROVE_ACTION_TO_EVIDENCE_KIND = Object.freeze({
  send_test_email: "gmail_message_id",
  create_test_event: "calendar_event_id",
  send_test_sms: "twilio_message_sid",
  place_test_call: "twilio_call_sid",
  submit_test_form: "form_submission_id",
  ingest_test_lead: "webhook_delivery_id",
  sync_gmail_inbox: "gmail_message_id",
});

export function mapProveActionToEvidenceKind(action) {
  return PROVE_ACTION_TO_EVIDENCE_KIND[String(action ?? "")] ?? null;
}

export function extractProveProviderId(result = {}) {
  const detail = result.detail && typeof result.detail === "object" ? result.detail : {};
  // Never accept internal CRM ids as provider proof — that forges Verified.
  return String(
    detail.externalReference
    ?? detail.messageId
    ?? detail.eventId
    ?? detail.sid
    ?? detail.formSubmissionId
    ?? detail.webhookDeliveryId
    ?? "",
  ).trim() || null;
}

/**
 * After a successful prove (or owner receipt confirm), attach evidence to the
 * launch prove card — seeding one if needed.
 */
export async function attachProveEvidenceToRftOpportunity({
  platformStore,
  installation,
  businessId,
  action,
  proveResult = {},
  actorId = "prove",
  contact = null,
} = {}) {
  const kind = mapProveActionToEvidenceKind(action);
  const providerId = extractProveProviderId(proveResult);
  if (!kind || !providerId) {
    return deepFreeze({
      ok: false,
      code: "no_provider_id",
      message: "Prove result has no provider id to attach as RFT evidence.",
    });
  }
  if (!platformStore || !installation) {
    return deepFreeze({ ok: false, code: "missing_installation", message: "Installation required." });
  }

  const evidence = [{
    kind,
    providerId,
    source: String(action),
    at: proveResult.at ?? new Date().toISOString(),
    note: proveResult.message ?? null,
  }];

  let launch = readRftLaunch(installation);
  let cardId = launch.proveCardId;
  let workingInstallation = installation;

  if (!cardId) {
    const seeded = await seedRftOpportunity({
      platformStore,
      installation: workingInstallation,
      contact: contact ?? {
        name: "Prove prospect",
        email: "prove@example.invalid",
        source: "rft_prove",
      },
      title: `Prove — ${action}`,
      triggerEvent: action === "submit_test_form" ? "WEBSITE_INQUIRY" : "INBOUND_SALES_EMAIL",
      evidence,
      actorId,
    });
    if (!seeded.ok) {
      return deepFreeze({ ok: false, code: "seed_failed", message: "Could not seed prove opportunity." });
    }
    cardId = seeded.cardId;
    // Re-read after seed so persistRftLaunch does not wipe CRM with a stale configuration.
    workingInstallation = await platformStore.getBusinessOSInstallation(businessId);
    launch = readRftLaunch(workingInstallation);
    const patched = applyRftLaunchPatch(launch, { proveCardId: cardId });
    if (patched.ok) {
      await persistRftLaunch({
        platformStore,
        installation: workingInstallation,
        launch: patched.launch,
        actorId,
      });
    }
    workingInstallation = await platformStore.getBusinessOSInstallation(businessId);
  }

  // Progress toward Verified when we have provider proof and enough prior states.
  // Seed starts at Detected; walk a minimal path then Verified.
  const path = ["ContextReady", "ActionProposed", "AutoEligible", "Executing", "Verified"];
  let last = null;
  for (const toState of path) {
    workingInstallation = await platformStore.getBusinessOSInstallation(businessId);
    last = await progressRftOpportunity({
      platformStore,
      installation: workingInstallation,
      cardId,
      toState,
      evidence,
      actorId,
      note: `Prove attach via ${action}`,
      outcomeType: toState === "Verified" ? "Acknowledged" : null,
    });
    if (!last.ok && last.code === "missing_provider_proof") {
      return deepFreeze({ ok: false, ...last, cardId, evidence });
    }
    if (!last.ok && last.code === "illegal_transition") {
      // Already past this state — continue.
      continue;
    }
    if (!last.ok) break;
  }

  workingInstallation = await platformStore.getBusinessOSInstallation(businessId);
  launch = readRftLaunch(workingInstallation);
  if (launch.proveCardId !== cardId) {
    const patched = applyRftLaunchPatch(launch, { proveCardId: cardId });
    if (patched.ok) {
      await persistRftLaunch({
        platformStore,
        installation: workingInstallation,
        launch: patched.launch,
        actorId,
      });
    }
  }

  return deepFreeze({
    ok: Boolean(last?.ok) || Boolean(cardId),
    cardId,
    evidence,
    state: last?.toState ?? null,
    progress: last,
  });
}
