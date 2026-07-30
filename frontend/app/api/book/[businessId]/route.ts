import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { ensureCrmContactPersisted } from "../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";
import { readTeamAvailability } from "../../../../../backend/core/integrations/appointment-setter/TeamAvailabilityStore.js";
import { resolveNextSlots } from "../../../../../backend/core/integrations/appointment-setter/resolveAvailabilitySlots.js";
import { bookConfirmedAppointment } from "../../../../../backend/core/integrations/appointment-setter/bookConfirmedAppointment.js";

async function installationFor(businessId: string) {
  return platformStore.getBusinessOSInstallation(businessId).catch(() => null);
}

function calendarConnected(service: any) {
  const runtime = service?.connected?.integrationPlatform?.connectionRuntime ?? service?.integrationPlatform?.connectionRuntime;
  return Boolean(runtime?.getConnectionByType?.("calendar") ?? runtime?.getConnectionByType?.("google_calendar"));
}

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const installation = await installationFor(businessId);
  if (!installation) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
  const { service } = await getSystemWorkspaceForBusiness(businessId).catch(() => ({ service: null }));
  const availability = readTeamAvailability(installation);
  const slots = resolveNextSlots({ availability, count: 3, now: new Date() });
  return NextResponse.json({
    ok: true,
    businessName: String(installation?.configuration?.businessProfile?.businessName ?? installation?.configuration?.businessName ?? "Our business"),
    calendarConnected: calendarConnected(service),
    slots,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const slotStart = String(body.slotStart ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  if (!name || !phone || !slotStart) return NextResponse.json({ ok: false, error: "name, phone, and slotStart required" }, { status: 400 });
  const installation = await installationFor(businessId);
  if (!installation) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
  const contactId = `contact_booking_${Date.now().toString(36)}`;
  await (ensureCrmContactPersisted as any)({
    platformStore, installation, actorId: "public_booking",
    contact: { id: contactId, partyId: contactId, name, email, phone, kind: "lead", tags: ["public_booking"], notes: `${notes}\nRequested slot: ${slotStart}`.trim() },
    addToPipeline: true, cardId: `card_booking_${contactId}`, cardTitle: name, dualWriteSource: "public_booking",
  });
  const getWorkspace = async (id: string) => (await getSystemWorkspaceForBusiness(id)).service;
  const availability = readTeamAvailability(installation);
  const candidateSlots = resolveNextSlots({ availability, count: 20, now: new Date() });
  const matchedSlot = (candidateSlots as any[]).find((s) => s.startISO === slotStart) ?? { startISO: slotStart, label: slotStart };
  const booking = await bookConfirmedAppointment({
    businessId,
    name,
    phone,
    slot: matchedSlot,
    source: "book_page",
    speech: notes,
    getWorkspace,
    callSid: `booking_${contactId}`,
  });
  return NextResponse.json({ ok: true, contactId, booking });
}
