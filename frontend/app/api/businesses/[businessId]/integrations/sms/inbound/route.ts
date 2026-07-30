import { NextResponse } from "next/server";
import { platformStore, businessKnowledgeService } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { businessHasAppointmentSetter, readPurchasedPackagesFromInstallation } from "../../../../../../../../backend/core/integrations/appointment-setter/businessHasAppointmentSetter.js";
import { getDurableSession, upsertDurableSession } from "../../../../../../../../backend/core/integrations/appointment-setter/AppointmentSetterSessionStore.js";
import { runSmsAppointmentSetterTurn } from "../../../../../../../../backend/core/integrations/appointment-setter/smsAppointmentSetter.js";
import { readTeamAvailability } from "../../../../../../../../backend/core/integrations/appointment-setter/TeamAvailabilityStore.js";
import { resolveNextSlots } from "../../../../../../../../backend/core/integrations/appointment-setter/resolveAvailabilitySlots.js";
import { bookConfirmedAppointment } from "../../../../../../../../backend/core/integrations/appointment-setter/bookConfirmedAppointment.js";
import { fetchCalendarBusyIntervals } from "../../../../../../../../backend/core/integrations/appointment-setter/fetchCalendarBusyIntervals.js";
import { resolveInboundSmsWebhookUrl } from "../../../../../../../../backend/core/integrations/twilio/TwilioProvisioningService.js";
import { verifyTwilioRequestSignature } from "../../../../../../../../backend/core/integrations/twilio/verifyTwilioRequestSignature.js";

function xml(text: string) {
  const escaped = String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${escaped ? `<Message>${escaped}</Message>` : ""}</Response>`, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

function forbidden() {
  return new NextResponse(null, { status: 403 });
}

/** Business's own Twilio auth token if they've connected a number, else the platform token. */
async function resolveTwilioAuthToken(businessId: string) {
  try {
    const rows = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
    const row = (Array.isArray(rows) ? rows : []).find((r: any) => {
      const provider = String(r?.providerType ?? "");
      const id = String(r?.credentialId ?? "");
      return provider === "twilio_sms" || id.includes("twilio_sms");
    });
    const businessToken = String(row?.secrets?.authToken ?? "").trim();
    return businessToken || String(process.env.TWILIO_AUTH_TOKEN ?? "").trim() || null;
  } catch {
    return String(process.env.TWILIO_AUTH_TOKEN ?? "").trim() || null;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const form = await request.formData().catch(() => null);
  if (!form) return forbidden();

  const skipValidation = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "1" && process.env.NODE_ENV !== "production";
  if (!skipValidation) {
    const signature = request.headers.get("x-twilio-signature");
    const authToken = await resolveTwilioAuthToken(businessId);
    // Reconstruct the public URL from NEXTAUTH_URL/APP_ORIGIN rather than the
    // incoming request URL — proxies commonly rewrite the host Twilio never saw.
    const webhookUrl = resolveInboundSmsWebhookUrl(businessId);
    const twilioParams: Record<string, string> = {};
    for (const [key, value] of form.entries()) twilioParams[key] = typeof value === "string" ? value : "";
    const valid = Boolean(webhookUrl) && verifyTwilioRequestSignature({ url: webhookUrl, params: twilioParams, authToken, signature });
    if (!valid) return forbidden();
  }

  const from = String(form.get("From") ?? "").trim();
  const inboundText = String(form.get("Body") ?? "").trim();
  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const packages = readPurchasedPackagesFromInstallation(installation);
  if (!from || !installation || !businessHasAppointmentSetter(packages)) return xml("");
  const name = String(installation?.configuration?.businessProfile?.businessName ?? installation?.configuration?.businessName ?? "our team");
  const bookingUrl = `${new URL(request.url).origin}/book/${encodeURIComponent(businessId)}`;

  let session = await (getDurableSession as any)({ platformStore, businessId, phone: from, installation });
  if (!session) {
    session = await (upsertDurableSession as any)({ platformStore, businessId, phone: from, stage: "qualify" });
  }

  const docs = await businessKnowledgeService.listOperationalDocuments(businessId).catch(() => []);
  const getWorkspace = async (id: string) => (await getSystemWorkspaceForBusiness(id)).service;
  let workspace: any = null;
  try {
    workspace = await getWorkspace(businessId);
  } catch {
    workspace = null;
  }

  let offeredSlots = Array.isArray(session?.offeredSlots) && session.offeredSlots.length ? session.offeredSlots : [];
  if (!offeredSlots.length && (session?.stage === "qualify" || session?.stage === "offer")) {
    const availability = readTeamAvailability(installation);
    const now = new Date();
    const rangeEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const busyIntervals = workspace ? await fetchCalendarBusyIntervals(workspace, now.toISOString(), rangeEnd.toISOString()) : [];
    offeredSlots = resolveNextSlots({ availability, count: 3, now, busyIntervals }) as any;
  }

  const turn = await (runSmsAppointmentSetterTurn as any)({
    inboundText,
    session: { ...session, offeredSlots },
    businessName: name,
    bookingUrl,
    knowledgeSnippets: docs,
  });

  await (upsertDurableSession as any)({ platformStore, businessId, phone: from, ...turn.sessionPatch });

  let replyText = turn.reply;
  if (turn.intent === "book" && turn.bookSlot) {
    const booking: any = await bookConfirmedAppointment({
      businessId,
      name: session?.name ?? "",
      phone: from,
      slot: turn.bookSlot,
      source: "sms",
      speech: inboundText,
      getWorkspace,
      callSid: `sms_${Date.now()}`,
    });
    await (upsertDurableSession as any)({
      businessId,
      platformStore,
      phone: from,
      stage: "booked",
      selectedSlot: booking?.slot ?? turn.bookSlot,
    });
    // The calendar write may have failed (or no calendar is connected) even
    // though the customer confirmed — never tell them "you're booked" unless
    // the appointment is actually confirmed.
    if (!booking?.confirmed) {
      const slotLabel = booking?.slot?.label ?? turn.bookSlot?.label ?? "";
      replyText = `Thanks — request received${slotLabel ? ` for ${slotLabel}` : ""}. Our team will confirm shortly.`;
    }
  }

  return xml(replyText);
}
