/**
 * Reusable missed-call → CRM + SMS follow-up.
 * Industry-agnostic: no business names, listings, or vertical copy hardcoded.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createNormalizedInboundEvent } from "../inbound/NormalizedInboundEvent.js";
import { InboundBusinessOrchestrationService } from "../inbound/InboundBusinessOrchestrationService.js";
import { TwilioSmsIntegrationAdapter } from "../adapters/TwilioSmsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { persistAffectedRuntimes } from "../../persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import { ensureCrmContactPersisted } from "../../crm/ensureCrmContactAndOptionalCard.js";

export const MISSED_DIAL_STATUSES = Object.freeze([
  "no-answer",
  "busy",
  "failed",
  "canceled",
  "cancelled",
]);

export function isMissedDialStatus(status) {
  return MISSED_DIAL_STATUSES.includes(String(status ?? "").trim().toLowerCase());
}

export function defaultMissedCallSmsBody({ businessName } = {}) {
  const brand = String(businessName || "our team").trim() || "our team";
  return `Sorry we missed your call to ${brand}. Reply here and we'll help.`;
}

export function renderMissedCallSmsBody(template, { businessName, firstName } = {}) {
  const raw = String(template ?? "").trim();
  const body = raw || defaultMissedCallSmsBody({ businessName });
  return body
    .replace(/\{businessName\}/gi, String(businessName || "our team").trim() || "our team")
    .replace(/\{firstName\}/gi, String(firstName || "").trim() || "there");
}

export function resolveMissedCallFollowUpConfig({ businessId, workspace } = {}) {
  const id = String(businessId ?? "").trim();
  const vault = workspace?.connected?.integrationPlatform?.credentialVault
    ?? workspace?.integrationPlatform?.credentialVault
    ?? null;
  const record = vault?.get?.(`cred_twilio_voice_${id}`) ?? null;
  const meta = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const secrets = record?.secrets && typeof record.secrets === "object" ? record.secrets : {};
  const enabled = Boolean(meta.missedCallFollowUpEnabled ?? secrets.missedCallFollowUpEnabled);
  const forwardNumber = String(meta.forwardNumber ?? secrets.forwardNumber ?? "").trim();
  const ringTimeoutSeconds = Math.min(
    60,
    Math.max(5, Number(meta.ringTimeoutSeconds ?? secrets.ringTimeoutSeconds ?? 20) || 20),
  );
  const smsBodyTemplate = String(meta.smsBodyTemplate ?? secrets.smsBodyTemplate ?? "").trim();
  return deepFreeze({
    enabled,
    forwardNumber,
    ringTimeoutSeconds,
    smsBodyTemplate,
    active: Boolean(enabled && forwardNumber),
  });
}

function findSmsConnection(workspace) {
  const hub = workspace?.connected?.integrationPlatform ?? workspace?.integrationPlatform ?? null;
  const runtime = hub?.connectionRuntime;
  const direct = runtime?.getConnectionByType?.("sms_channel") ?? runtime?.getConnectionByType?.("twilio_sms");
  const connection = direct ?? (runtime?.getConnections?.() ?? []).find((entry) => {
    const type = String(entry?.connectionType ?? entry?.type ?? "").toLowerCase();
    const provider = String(entry?.providerId ?? "").toLowerCase();
    return type.includes("sms") || provider.includes("twilio");
  }) ?? null;
  return { hub, connection };
}

function buildDialTwiml({ forwardNumber, timeoutSeconds, actionUrl }) {
  const to = String(forwardNumber ?? "").trim();
  const timeout = Math.min(60, Math.max(5, Number(timeoutSeconds) || 20));
  const action = String(actionUrl ?? "").trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${timeout}" action="${escapeXml(action)}" method="POST">
    <Number>${escapeXml(to)}</Number>
  </Dial>
</Response>`.trim();
}

function buildMissedNoticeTwiml({ sayText = "We missed your call. We'll text you shortly." } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(sayText)}</Say>
  <Hangup/>
</Response>`.trim();
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * @param {{
 *   stack: object,
 *   workspace?: object,
 *   businessId: string,
 *   fromPhone: string,
 *   callSid: string,
 *   disposition?: string,
 *   businessName?: string,
 *   smsBodyTemplate?: string,
 *   nowISO?: string,
 *   sendSms?: Function | null,
 *   platformStore?: object | null,
 *   installation?: object | null,
 *   persist?: boolean,
 * }} input
 */
export async function handleMissedCallFollowUp({
  stack,
  workspace = null,
  businessId,
  fromPhone,
  callSid,
  disposition = "no-answer",
  businessName = "our team",
  smsBodyTemplate = "",
  nowISO = new Date().toISOString(),
  sendSms = null,
  platformStore = null,
  installation = null,
  persist = true,
} = {}) {
  const bid = String(businessId ?? "").trim();
  const phone = String(fromPhone ?? "").trim();
  const sid = String(callSid ?? "").trim();
  if (!bid) return deepFreeze({ ok: false, reason: "business_id_required" });
  if (!phone) return deepFreeze({ ok: false, reason: "from_phone_required" });
  if (!sid) return deepFreeze({ ok: false, reason: "call_sid_required" });
  if (!stack?.businessGraphRuntime || !stack?.requestRuntime) {
    return deepFreeze({ ok: false, reason: "stack_unavailable" });
  }

  const requestId = `req_inbound_${sid}`;
  const existing = stack.requestRuntime.getRequest?.(requestId) ?? null;
  if (existing) {
    return deepFreeze({
      ok: true,
      duplicate: true,
      partyId: existing.partyId ?? existing.primaryPartyId ?? null,
      requestId,
      smsSent: false,
    });
  }

  const orchestrator = new InboundBusinessOrchestrationService({
    workspaceId: bid,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    requestRuntime: stack.requestRuntime,
    interactionRuntime: stack.interactionRuntime,
    installationResult: installation,
    nowISO,
  });

  const normalized = createNormalizedInboundEvent({
    externalEventId: sid,
    providerId: "twilio_voice",
    workspaceId: bid,
    channel: "phone",
    eventKind: "missed_call",
    occurredAt: nowISO,
    identityHints: {
      phone,
      name: "",
    },
    attribution: {
      sourceLabel: "phone",
      disposition: String(disposition || "no-answer"),
    },
    payloadFacts: {
      eventKind: "missed_call",
      title: "Missed call",
      message: `Missed call (${String(disposition || "no-answer")})`,
      identityHints: { phone },
    },
  });

  const orchestration = orchestrator.handleNormalizedEvent(normalized);
  const partyId = orchestration?.partyId ?? null;

  if (partyId && platformStore && installation) {
    try {
      const party = stack.businessGraphRuntime.getParty?.(partyId);
      await ensureCrmContactPersisted({
        platformStore,
        installation,
        actorId: "missed_call_follow_up",
        businessGraphRuntime: stack.businessGraphRuntime,
        contact: {
          id: partyId,
          partyId,
          name: String(party?.displayName || phone || "Phone caller"),
          phone,
          kind: "lead",
          tags: ["missed_call"],
          notes: `Missed call ${sid} (${String(disposition || "no-answer")})`,
        },
      });
    } catch {
      /* best effort — graph party is the source of truth */
    }
  }

  let smsSent = false;
  let smsResult = null;
  let smsSkipReason = null;
  const body = renderMissedCallSmsBody(smsBodyTemplate, {
    businessName,
    firstName: "",
  });

  try {
    if (typeof sendSms === "function") {
      smsResult = await sendSms({ to: phone, body, businessId: bid, partyId });
      smsSent = Boolean(smsResult?.ok === true || String(smsResult?.status ?? "").toLowerCase() === "completed");
    } else {
      const ws = workspace ?? { connected: { operatingStack: stack } };
      const { hub, connection } = findSmsConnection(ws);
      if (!connection || !hub?.credentialResolver) {
        smsSkipReason = "sms_not_connected";
      } else {
        smsResult = await new TwilioSmsIntegrationAdapter().executeAction({
          actionRequest: {
            capability: INTEGRATION_CAPABILITIES.SEND_SMS,
            parameters: { to: phone, body },
          },
          connection,
          credentialResolver: hub.credentialResolver,
        });
        smsSent = Boolean(
          smsResult?.ok === true
          || String(smsResult?.status ?? "").toLowerCase() === "completed",
        );
        if (!smsSent) smsSkipReason = "sms_send_failed";
      }
    }
    if (smsSent) {
      try {
        const { recordUsageSafe } = await import("../../platform/billing/UsageMetering.js");
        recordUsageSafe({ businessId: bid, meterId: "sms_segments", quantity: 1 });
      } catch {
        /* non-blocking */
      }
    }
  } catch (error) {
    smsSkipReason = error instanceof Error ? error.message : "sms_send_failed";
  }

  if (persist) {
    try {
      await persistAffectedRuntimes({
        workspaceId: bid,
        stack,
        integrationPlatform: workspace?.connected?.integrationPlatform ?? workspace?.integrationPlatform ?? null,
        kinds: [
          RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH,
          RUNTIME_SNAPSHOT_KINDS.REQUEST,
          RUNTIME_SNAPSHOT_KINDS.INTERACTION,
        ].filter(Boolean),
      });
    } catch {
      /* non-blocking */
    }
  }

  return deepFreeze({
    ok: true,
    duplicate: false,
    partyId,
    requestId,
    orchestration,
    smsSent,
    smsSkipReason,
    smsResult,
  });
}

export function buildMissedCallDialTwiml(input) {
  return buildDialTwiml(input);
}

export function buildMissedCallNoticeTwiml(input) {
  return buildMissedNoticeTwiml(input);
}
