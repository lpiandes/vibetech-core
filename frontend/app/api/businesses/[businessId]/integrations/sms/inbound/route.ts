import { NextResponse } from "next/server";
import { platformStore, businessKnowledgeService } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { businessHasAppointmentSetter, readPurchasedPackagesFromInstallation } from "../../../../../../../../backend/core/integrations/appointment-setter/businessHasAppointmentSetter.js";
import { getDurableSession, upsertDurableSession } from "../../../../../../../../backend/core/integrations/appointment-setter/AppointmentSetterSessionStore.js";
import { runSmsAppointmentSetterTurn } from "../../../../../../../../backend/core/integrations/appointment-setter/smsAppointmentSetter.js";
import { readTeamAvailability } from "../../../../../../../../backend/core/integrations/appointment-setter/TeamAvailabilityStore.js";
import { resolveNextSlots } from "../../../../../../../../backend/core/integrations/appointment-setter/resolveAvailabilitySlots.js";
import { bookConfirmedAppointment, findCalendarConnection } from "../../../../../../../../backend/core/integrations/appointment-setter/bookConfirmedAppointment.js";
import { GoogleCalendarIntegrationAdapter } from "../../../../../../../../backend/core/integrations/adapters/GoogleCalendarIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../../../../../../../../backend/core/integrations/capabilities/IntegrationCapability.js";

function xml(text: string) {
  const escaped = String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${escaped ? `<Message>${escaped}</Message>` : ""}</Response>`, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

/** Best-effort: fetch Google Calendar busy intervals so offered slots don't collide with existing events. */
async function fetchBusyIntervals(workspace: any, timeMinISO: string, timeMaxISO: string) {
  try {
    const { hub, connection } = findCalendarConnection(workspace);
    if (!connection || !hub?.credentialResolver) return [];
    const calendar = new GoogleCalendarIntegrationAdapter();
    const result = await calendar.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY,
        parameters: { timeMin: timeMinISO, timeMax: timeMaxISO, calendarId: "primary" },
      },
      connection,
      credentialResolver: hub.credentialResolver,
    });
    const busy = (result as any)?.metadata?.calendars?.primary?.busy;
    return Array.isArray(busy) ? busy.map((b: any) => ({ start: b.start, end: b.end })) : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const form = await request.formData().catch(() => null);
  const from = String(form?.get("From") ?? "").trim();
  const inboundText = String(form?.get("Body") ?? "").trim();
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
    const busyIntervals = workspace ? await fetchBusyIntervals(workspace, now.toISOString(), rangeEnd.toISOString()) : [];
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

  if (turn.intent === "book" && turn.bookSlot) {
    const booking = await bookConfirmedAppointment({
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
      selectedSlot: (booking as any)?.slot ?? turn.bookSlot,
    });
  }

  return xml(turn.reply);
}
