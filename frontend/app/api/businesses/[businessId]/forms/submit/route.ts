import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { ensureCrmContactPersisted } from "../../../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";

/** In-memory rate limit: businessId → timestamps (last minute). */
const RATE = new Map<string, number[]>();
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

function rateLimited(businessId: string) {
  const now = Date.now();
  const prev = (RATE.get(businessId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    RATE.set(businessId, prev);
    return true;
  }
  prev.push(now);
  RATE.set(businessId, prev);
  return false;
}

function originAllowed(request: Request, installation: any) {
  const allowed = installation?.configuration?.formAllowedOrigins;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const origin = request.headers.get("origin") || "";
  const referer = request.headers.get("referer") || "";
  const candidates = [origin, referer].filter(Boolean);
  if (!candidates.length) return true; // same-origin / curl
  return allowed.some((rule: string) => {
    const r = String(rule).trim().toLowerCase();
    if (!r) return false;
    return candidates.some((c) => String(c).toLowerCase().includes(r.replace(/^https?:\/\//, "")));
  });
}

/**
 * Public website form intake — creates a People contact (+ pipeline card) and fires FORM_SUBMIT.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    if (rateLimited(businessId)) {
      return NextResponse.json(
        { ok: false, error: "Too many submissions — try again shortly." },
        { status: 429, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    const body = await request.json().catch(() => ({}));
    // Honeypot — bots fill "website"
    if (String(body.website ?? body.company_url ?? "").trim()) {
      return NextResponse.json(
        { ok: true, contactId: null, discarded: true },
        { headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const message = String(body.message ?? body.notes ?? "").trim();
    const appointmentRequest = body.appointmentRequest === true
      || body.requestAppointment === true
      || /appoint|book|schedule/i.test(message);
    if (!name && !email && !phone) {
      return NextResponse.json(
        { ok: false, error: "name, email, or phone required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json(
        { ok: false, error: "Business not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    if (!originAllowed(request, installation)) {
      return NextResponse.json(
        { ok: false, error: "Origin not allowed for this form." },
        { status: 403, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    let systemWorkspace: { service: any } | null = null;
    try {
      systemWorkspace = await getSystemWorkspaceForBusiness(businessId);
    } catch {
      systemWorkspace = null;
    }

    const contactId = `contact_form_${Date.now().toString(36)}`;
    const ensured = await ensureCrmContactPersisted({
      platformStore,
      installation,
      actorId: "website_form",
      contact: {
        id: contactId,
        partyId: contactId,
        name: name || email || phone || "Website lead",
        email,
        phone,
        kind: "lead",
        tags: [
          "website_form",
          body.source === "embed" ? "embed" : "hosted",
          ...(appointmentRequest ? ["appointment_request"] : []),
        ],
        notes: message || "Submitted via VIBETech intake form",
      },
      addToPipeline: true,
      cardId: `card_form_${contactId}`.slice(0, 64),
      cardTitle: name || email || "Website lead",
      dualWriteSource: "website_form",
      workspaceService: systemWorkspace?.service ?? null,
    });
    const cardId = ensured.cardId;

    let automation = null;
    try {
      const service = systemWorkspace?.service ?? (await getSystemWorkspaceForBusiness(businessId)).service;
      automation = await service.emitSpecialtyBusinessEvent({
        eventType: "FORM_SUBMIT",
        brief: [
          "New website form submission.",
          `Name: ${name || "(none)"}`,
          email ? `Email: ${email}` : null,
          phone ? `Phone: ${phone}` : null,
          message ? `Message: ${message}` : null,
          "Run intake automation. Outbound stays approval-gated.",
        ].filter(Boolean).join("\n"),
        forceManual: false,
        actorId: "website_form",
        eventPayload: {
          contactId,
          cardId,
          name,
          email,
          phone,
          message,
          source: "website_forms",
          contact: ensured.contact ?? {
            id: contactId,
            name: name || email || phone || "Website lead",
            email,
            phone,
            kind: "lead",
            tags: ["website_form"],
          },
        },
      });
    } catch {
      automation = null;
    }

    let appointment = null;
    if (appointmentRequest) {
      try {
        const { enqueueVoiceAppointmentWork } = await import(
          "../../../../../../../backend/core/integrations/voice/enqueueVoiceAppointmentWork.js"
        );
        const { enqueueVoiceCalendarHold } = await import(
          "../../../../../../../backend/core/integrations/voice/enqueueVoiceCalendarHold.js"
        );
        const speech = [
          "Website form appointment request.",
          name ? `Name: ${name}` : null,
          email ? `Email: ${email}` : null,
          phone ? `Phone: ${phone}` : null,
          message ? `Message: ${message}` : null,
        ].filter(Boolean).join("\n");
        const [work, hold] = await Promise.all([
          enqueueVoiceAppointmentWork({
            businessId,
            speech,
            from: phone || email || name,
            callSid: `form_${contactId}`,
            reply: "Appointment request from website form.",
            getWorkspace: async (id: string) => {
              const { service } = await getSystemWorkspaceForBusiness(id);
              return service;
            },
          }),
          enqueueVoiceCalendarHold({
            businessId,
            speech,
            from: phone || email || name,
            callSid: `form_${contactId}`,
            getWorkspace: async (id: string) => {
              const { service } = await getSystemWorkspaceForBusiness(id);
              return service;
            },
          }),
        ]);
        appointment = { work, hold };
      } catch {
        appointment = null;
      }
    }

    let appointmentSetter: any = null;
    if (phone) {
      try {
        const {
          businessHasAppointmentSetter,
          readPurchasedPackagesFromInstallation,
        } = await import("../../../../../../../backend/core/integrations/appointment-setter/businessHasAppointmentSetter.js");
        const packages = readPurchasedPackagesFromInstallation(installation);
        if (businessHasAppointmentSetter(packages)) {
          const { startAppointmentSetterFromLead } = await import(
            "../../../../../../../backend/core/integrations/appointment-setter/startAppointmentSetterFromLead.js"
          );
          appointmentSetter = await (startAppointmentSetterFromLead as any)({
            businessId,
            contact: { name: name || email || phone, email, phone, contactId },
            source: "website_forms",
            purchasedPackages: packages,
            getWorkspace: async (id: string) => (await getSystemWorkspaceForBusiness(id)).service,
            platformStore,
            installation,
          });
        }
      } catch {
        appointmentSetter = { ok: false, reason: "appointment_setter_failed" };
      }
    }

    return NextResponse.json(
      {
        ok: true,
        contactId,
        cardId,
        automationFired: Number(automation?.firedCount ?? 0),
        appointmentRequested: Boolean(appointmentRequest),
        appointmentWorkId: appointment?.work?.workId ?? null,
        calendarHold: Boolean(appointment?.hold?.ok),
        appointmentSetter,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "submit_failed" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
