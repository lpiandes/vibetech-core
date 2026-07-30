import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { TwilioSmsIntegrationAdapter } from "../adapters/TwilioSmsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { businessHasAppointmentSetter } from "./businessHasAppointmentSetter.js";
import { upsertSession, upsertDurableSession } from "./AppointmentSetterSessionStore.js";
import { buildFirstTouchSms } from "./smsAppointmentSetter.js";

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

export async function startAppointmentSetterFromLead({
  businessId,
  contact: { name, phone, email, contactId } = {},
  source = "lead",
  purchasedPackages = [],
  getWorkspace,
  sendSms = null,
  platformStore = null,
  installation = null,
  appBaseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.vtechdevelopment.com",
} = {}) {
  if (!businessHasAppointmentSetter(purchasedPackages)) return deepFreeze({ ok: false, reason: "package_not_enabled" });
  if (!phone) return deepFreeze({ ok: false, reason: "phone_required" });
  let session;
  if (platformStore) {
    try {
      session = await upsertDurableSession({
        platformStore,
        businessId,
        phone,
        installation,
        actorId: "appointment_setter",
        name,
        contactId,
        stage: "qualify",
        answers: { source, email },
      });
    } catch {
      session = upsertSession({ businessId, phone, name, contactId, stage: "qualify", answers: { source, email } });
    }
  } else {
    session = upsertSession({ businessId, phone, name, contactId, stage: "qualify", answers: { source, email } });
  }
  const bookingUrl = `${String(appBaseUrl).replace(/\/$/, "")}/book/${encodeURIComponent(String(businessId))}?contact=${encodeURIComponent(String(contactId ?? ""))}`;
  const body = buildFirstTouchSms({ businessName: "our team", name, bookingUrl });
  try {
    let sms;
    if (typeof sendSms === "function") sms = await sendSms({ to: session.phone, body, businessId, contactId });
    else {
      if (typeof getWorkspace !== "function") return deepFreeze({ ok: false, reason: "workspace_loader_missing", session });
      const workspace = await getWorkspace(businessId);
      const { hub, connection } = findSmsConnection(workspace);
      if (!connection || !hub?.credentialResolver) return deepFreeze({ ok: false, reason: "sms_not_connected", session });
      sms = await new TwilioSmsIntegrationAdapter().executeAction({
        actionRequest: { capability: INTEGRATION_CAPABILITIES.SEND_SMS, parameters: { to: session.phone, body } },
        connection,
        credentialResolver: hub.credentialResolver,
      });
    }
    return deepFreeze({ ok: String(sms?.status ?? "").toLowerCase() === "completed" || sms?.ok === true, session, sms });
  } catch (error) {
    return deepFreeze({ ok: false, reason: error instanceof Error ? error.message : "sms_send_failed", session });
  }
}
