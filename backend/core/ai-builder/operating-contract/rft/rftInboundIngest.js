/**
 * Plan 13 — continuous RFT loop: live inbound events → seed + progress.
 * Idempotent by provider evidence id. Never claims Verified without proof.
 */
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { readCrmState } from "../../../crm/CrmStore.js";
import { RFT_PIPELINE_ID, RFT_SCHEMA_ID } from "./rftCatalog.js";
import {
  seedRftOpportunity,
  progressRftOpportunity,
  ensureRftPipeline,
} from "./rftOpportunityRuntime.js";
import { resolveAutonomyDisposition } from "../../../company-rules/earnedAutonomy.js";

export const RFT_INBOUND_EVENT_TYPES = Object.freeze([
  "INBOUND_SALES_EMAIL",
  "FORM_SUBMIT",
  "WEBSITE_INQUIRY",
  "NEW_INQUIRY",
  "META_LEAD",
  "INBOUND_VOICE_CALL",
]);

function findRftEmployee(installation = null) {
  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];
  return employees.find((emp) => {
    const schemaId = String(emp?.operatingContract?.schemaId ?? "");
    const label = String(emp?.label ?? emp?.displayName ?? "");
    return schemaId === RFT_SCHEMA_ID
      || /revenue\s*follow/i.test(label)
      || String(emp?.roleId ?? "") === "revenue_follow_through"
      || Boolean(emp?.operatingContract?.rft);
  }) ?? null;
}

function evidenceKindForEvent(eventType) {
  switch (String(eventType)) {
    case "INBOUND_SALES_EMAIL":
      return "gmail_message_id";
    case "FORM_SUBMIT":
    case "WEBSITE_INQUIRY":
    case "NEW_INQUIRY":
      return "form_submission_id";
    case "META_LEAD":
      return "webhook_delivery_id";
    case "INBOUND_VOICE_CALL":
      return "twilio_call_sid";
    default:
      return "external_reference";
  }
}

function providerIdFromPayload(eventType, payload = {}) {
  const p = payload && typeof payload === "object" ? payload : {};
  return String(
    p.gmailMessageId
    ?? p.messageId
    ?? p.formSubmissionId
    ?? p.submissionId
    ?? p.leadId
    ?? p.webhookDeliveryId
    ?? p.callSid
    ?? p.sid
    ?? p.providerId
    ?? "",
  ).trim() || null;
}

function findCardByEvidenceProviderId(installation, providerId) {
  if (!providerId) return null;
  const crm = ensureRftPipeline(readCrmState(installation));
  for (const pipe of crm.pipelines ?? []) {
    if (String(pipe.id) !== RFT_PIPELINE_ID) continue;
    for (const card of pipe.cards ?? []) {
      const evidence = Array.isArray(card?.rft?.evidence) ? card.rft.evidence : [];
      if (evidence.some((e) => String(e?.providerId) === String(providerId))) {
        return card;
      }
    }
  }
  return null;
}

/**
 * Ingest an inbound specialty/business event into the RFT state machine.
 */
export async function ingestRftInboundEvent({
  platformStore,
  installation,
  eventType,
  payload = {},
  actorId = "rft_inbound",
  title = null,
} = {}) {
  const type = String(eventType ?? "").trim();
  if (!RFT_INBOUND_EVENT_TYPES.includes(type)) {
    return deepFreeze({ ok: false, code: "not_inbound_event", skipped: true });
  }
  if (!platformStore || !installation) {
    return deepFreeze({ ok: false, code: "missing_installation" });
  }

  const employee = findRftEmployee(installation);
  if (!employee) {
    return deepFreeze({
      ok: false,
      code: "rft_not_installed",
      message: "No Revenue Follow-Through employee/contract on this installation.",
    });
  }

  const providerId = providerIdFromPayload(type, payload);
  if (!providerId) {
    return deepFreeze({
      ok: false,
      code: "missing_provider_id",
      message: "Inbound event has no provider id — refusing to invent an opportunity.",
    });
  }

  const evidence = [{
    kind: evidenceKindForEvent(type),
    providerId,
    source: type,
    at: new Date().toISOString(),
    channel: payload.channel ?? null,
  }];

  const existing = findCardByEvidenceProviderId(installation, providerId);
  let cardId = existing?.id ?? null;
  let working = installation;
  let seeded = null;

  if (!cardId) {
    const from = payload.from && typeof payload.from === "object" ? payload.from : {};
    seeded = await seedRftOpportunity({
      platformStore,
      installation: working,
      contact: {
        id: payload.personId ?? payload.contactId ?? undefined,
        name: from.name || payload.name || payload.subject || "Inbound prospect",
        email: from.email || payload.email || "",
        phone: payload.phone || "",
        source: `rft_inbound:${type}`,
      },
      title: title
        || (payload.subject ? String(payload.subject).slice(0, 120) : null)
        || `Inbound — ${type}`,
      triggerEvent: type === "FORM_SUBMIT" || type === "WEBSITE_INQUIRY" || type === "NEW_INQUIRY"
        ? "WEBSITE_INQUIRY"
        : type === "META_LEAD"
          ? "META_LEAD"
          : "INBOUND_SALES_EMAIL",
      evidence,
      actorId,
    });
    if (!seeded.ok) {
      return deepFreeze({ ok: false, code: "seed_failed", detail: seeded });
    }
    cardId = seeded.cardId;
    working = await platformStore.getBusinessOSInstallation(installation.businessId);
  }

  const steps = [];
  const currentState = String(
    findCardByEvidenceProviderId(working, providerId)?.rft?.state
    ?? existing?.rft?.state
    ?? "Detected",
  );

  async function step(toState, eventTypeStep, note) {
    const install = await platformStore.getBusinessOSInstallation(installation.businessId);
    const result = await progressRftOpportunity({
      platformStore,
      installation: install,
      cardId,
      toState,
      eventType: eventTypeStep,
      evidence,
      actorId,
      note,
    });
    steps.push({ toState, ok: result.ok, code: result.code ?? null });
    return result;
  }

  if (currentState === "Detected") {
    await step("ContextReady", "CONTEXT_ENRICHED", "Inbound evidence + contact linked");
    await step("ActionProposed", "ACTION_PROPOSED", "Follow-through action proposed from inbound");
  } else if (currentState === "ContextReady") {
    await step("ActionProposed", "ACTION_PROPOSED", "Follow-through action proposed from inbound");
  }

  // After ActionProposed, choose ApprovalRequired vs AutoEligible via Plan 11.
  const installAfter = await platformStore.getBusinessOSInstallation(installation.businessId);
  const cardAfter = findCardByEvidenceProviderId(installAfter, providerId);
  if (String(cardAfter?.rft?.state) === "ActionProposed") {
    const disposition = resolveAutonomyDisposition({
      event: {
        kind: type === "INBOUND_SALES_EMAIL" ? "inbound_email" : "form_lead",
        title: cardAfter.title,
        email: payload.from?.email || payload.email || "unknown@example.invalid",
        evidence,
      },
      installation: installAfter,
      contract: employee.operatingContract,
    });
    await step(
      disposition.proposedNextState,
      disposition.autoEligible ? "ACTION_PROPOSED" : "ACTION_PROPOSED",
      `Earned autonomy → ${disposition.proposedNextState} (${disposition.classId})`,
    );
  }

  const finalInstall = await platformStore.getBusinessOSInstallation(installation.businessId);
  const finalCard = findCardByEvidenceProviderId(finalInstall, providerId);

  return deepFreeze({
    ok: true,
    cardId,
    state: finalCard?.rft?.state ?? null,
    duplicate: Boolean(existing),
    seeded: Boolean(seeded?.ok),
    steps,
    providerId,
    eventType: type,
  });
}

/**
 * On specialty path external failure — move linked RFT card to Exception when cardId known.
 */
export async function escalateRftOnExternalFailure({
  platformStore,
  installation,
  cardId = null,
  providerId = null,
  actorId = "specialty_path",
  note = null,
} = {}) {
  if (!platformStore || !installation) {
    return deepFreeze({ ok: false, code: "missing_installation" });
  }
  let id = cardId ? String(cardId) : null;
  if (!id && providerId) {
    id = findCardByEvidenceProviderId(installation, providerId)?.id ?? null;
  }
  if (!id) {
    return deepFreeze({ ok: false, code: "card_not_found", skipped: true });
  }
  const result = await progressRftOpportunity({
    platformStore,
    installation,
    cardId: id,
    toState: "Exception",
    eventType: "EXCEPTION_RAISED",
    actorId,
    note: note || "External specialty action failed — fail visibly.",
    outcomeType: "HumanInterventionRequired",
  });
  return deepFreeze({
    ok: result.ok,
    cardId: id,
    state: result.toState ?? null,
    code: result.code ?? null,
  });
}

export { findCardByEvidenceProviderId, findRftEmployee };
