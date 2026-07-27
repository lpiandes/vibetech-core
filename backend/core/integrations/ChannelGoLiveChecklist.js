/**
 * Channel go-live checklist — owner completes these in Launch / Integrations before live SMS / Voice / Meta.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function buildChannelGoLiveChecklist({
  connections = [],
  proofRecords = {},
  smsSetup = null,
  appOrigin = process.env.APP_ORIGIN || process.env.NEXTAUTH_URL || "",
} = {}) {
  const byType = new Map();
  for (const conn of Array.isArray(connections) ? connections : []) {
    const type = String(conn?.connectionType ?? conn?.type ?? conn?.id ?? "").toLowerCase();
    if (type) byType.set(type, conn);
  }

  const email = byType.get("business_email") || byType.get("gmail");
  const calendar = byType.get("calendar") || byType.get("google_calendar");
  const sms = byType.get("sms_channel") || byType.get("twilio_sms");
  const voice = byType.get("voice_channel") || byType.get("twilio_voice");
  const meta = byType.get("meta_lead_ads") || byType.get("meta");

  const proof = (id) => proofRecords?.[id] ?? proofRecords?.[String(id)] ?? null;
  const proven = (id) => {
    const row = proof(id);
    return Boolean(row?.ok || row?.verified || String(row?.status ?? "").toLowerCase() === "proven");
  };

  const brandComplete = smsSetup?.brandComplete === true
    || Boolean(sms?.metadata?.brandComplete);

  const originOk = Boolean(String(appOrigin).trim())
    && !/localhost|127\.0\.0\.1/i.test(String(appOrigin));

  const items = [
    {
      id: "email",
      label: "Business email connected + prove send",
      ready: Boolean(email) && proven("customer_email_send"),
      ownerNote: "Connect Gmail, then Launch → Send test email.",
      operatorNote: "Connect Gmail, then Launch → Send test email.",
    },
    {
      id: "calendar",
      label: "Google Calendar connected + prove event",
      ready: Boolean(calendar) && proven("calendar_scheduling"),
      ownerNote: "Connect Calendar, then Launch → create test event.",
      operatorNote: "Connect Calendar, then Launch → create test event.",
    },
    {
      id: "sms",
      label: "Twilio SMS + A2P brand + prove send",
      ready: Boolean(sms) && brandComplete && proven("sms_send"),
      ownerNote: "Connect Text messaging, complete A2P brand fields, wait for Approved, then Launch → Send test text.",
      operatorNote: "Connect Text messaging, complete A2P brand fields, wait for Approved, then Launch → Send test text.",
    },
    {
      id: "voice",
      label: "Twilio Voice webhook + prove call",
      ready: Boolean(voice) && originOk && proven("voice_calls"),
      ownerNote: `In Twilio, point the Voice webhook to ${appOrigin || "[APP_ORIGIN]"}/api/businesses/{id}/integrations/voice/inbound, then Launch → prove call.`,
      operatorNote: `In Twilio, point the Voice webhook to ${appOrigin || "[APP_ORIGIN]"}/api/businesses/{id}/integrations/voice/inbound, then Launch → prove call.`,
    },
    {
      id: "meta",
      label: "Meta Lead Ads webhook + prove ingest",
      ready: Boolean(meta) && proven("meta_lead_intake"),
      ownerNote: "Connect Meta Lead Ads, configure page webhook, Launch → ingest test lead.",
      operatorNote: "Connect Meta Lead Ads, configure page webhook, Launch → ingest test lead.",
    },
  ];

  const readyCount = items.filter((item) => item.ready).length;
  return deepFreeze({
    items,
    readyCount,
    total: items.length,
    allReady: readyCount === items.length,
    appOrigin: String(appOrigin || ""),
    note: "Complete each channel prove in Launch Center before going live. Platform support is break-glass only.",
  });
}
