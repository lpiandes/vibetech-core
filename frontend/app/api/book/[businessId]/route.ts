import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { ensureCrmContactPersisted } from "../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";
import { readTeamAvailability } from "../../../../../backend/core/integrations/appointment-setter/TeamAvailabilityStore.js";
import { resolveNextSlots } from "../../../../../backend/core/integrations/appointment-setter/resolveAvailabilitySlots.js";
import { fetchCalendarBusyIntervals } from "../../../../../backend/core/integrations/appointment-setter/fetchCalendarBusyIntervals.js";
import { bookConfirmedAppointment } from "../../../../../backend/core/integrations/appointment-setter/bookConfirmedAppointment.js";

/** In-memory rate limit: client IP → timestamps (last minute). */
const RATE = new Map<string, number[]>();
const RATE_MAX = 8;
const RATE_WINDOW_MS = 60_000;

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const prev = (RATE.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    RATE.set(ip, prev);
    return true;
  }
  prev.push(now);
  RATE.set(ip, prev);
  return false;
}

async function installationFor(businessId: string) {
  return platformStore.getBusinessOSInstallation(businessId).catch(() => null);
}

function calendarConnected(service: any) {
  const runtime = service?.connected?.integrationPlatform?.connectionRuntime ?? service?.integrationPlatform?.connectionRuntime;
  return Boolean(runtime?.getConnectionByType?.("calendar") ?? runtime?.getConnectionByType?.("google_calendar"));
}

/** Recompute the currently-bookable slots from live availability + calendar busy intervals — never trust a client-supplied slot. */
async function computeAllowedSlots(businessId: string, installation: any, count: number) {
  const { service } = await getSystemWorkspaceForBusiness(businessId).catch(() => ({ service: null }));
  const availability = readTeamAvailability(installation);
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const busyIntervals = service ? await fetchCalendarBusyIntervals(service, now.toISOString(), rangeEnd.toISOString()) : [];
  const slots = resolveNextSlots({ availability, count, now, busyIntervals });
  return { slots, service };
}

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const installation = await installationFor(businessId);
  if (!installation) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
  const { slots, service } = await computeAllowedSlots(businessId, installation, 3);
  return NextResponse.json({
    ok: true,
    businessName: String(installation?.configuration?.businessProfile?.businessName ?? installation?.configuration?.businessName ?? "Our business"),
    calendarConnected: calendarConnected(service),
    slots,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ ok: false, error: "Too many requests — try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const slotStart = String(body.slotStart ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  if (!name || (!email && !phone) || !slotStart) {
    return NextResponse.json({ ok: false, error: "name, slotStart, and email or phone are required" }, { status: 400 });
  }

  const installation = await installationFor(businessId);
  if (!installation) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });

  // Re-derive the allowed slots right now (fresh availability + calendar busy
  // check) and require an exact ISO match — never trust a client-echoed slot.
  const { slots: allowedSlots, service: workspaceService } = await computeAllowedSlots(businessId, installation, 20);
  const matchedSlot = (allowedSlots as any[]).find((s) => s.startISO === slotStart);
  if (!matchedSlot) {
    return NextResponse.json(
      { ok: false, error: "That time is no longer available. Please choose another slot." },
      { status: 409 },
    );
  }

  const contactId = `contact_booking_${Date.now().toString(36)}`;
  await (ensureCrmContactPersisted as any)({
    platformStore, installation, actorId: "public_booking",
    contact: { id: contactId, partyId: contactId, name, email, phone, kind: "lead", tags: ["public_booking"], notes: `${notes}\nRequested slot: ${slotStart}`.trim() },
    addToPipeline: true, cardId: `card_booking_${contactId}`, cardTitle: name, dualWriteSource: "public_booking",
    workspaceService,
  });

  const getWorkspace = async (id: string) => (await getSystemWorkspaceForBusiness(id)).service;
  const booking: any = await bookConfirmedAppointment({
    businessId,
    name,
    phone,
    slot: matchedSlot,
    source: "book_page",
    speech: notes,
    getWorkspace,
    callSid: `booking_${contactId}`,
  });

  if (!booking?.ok) {
    // Calendar was connected but the write failed — do not tell the customer
    // they're booked on the calendar.
    return NextResponse.json({
      ok: false,
      contactId,
      booking,
      error: "We couldn't confirm that time on the calendar. Our team has your request and will follow up shortly.",
    });
  }

  return NextResponse.json({
    ok: true,
    confirmed: booking.confirmed === true,
    contactId,
    booking,
    message: booking.confirmed === true
      ? "You're booked!"
      : "Request received — our team will confirm your appointment shortly.",
  });
}
