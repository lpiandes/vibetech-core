/**
 * Auto-book a CONFIRMED appointment (not a HOLD) once a customer has picked
 * and confirmed a slot via SMS or the public booking page. Creates a real
 * Google Calendar event when connected, and always creates appointment Work.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { GoogleCalendarIntegrationAdapter } from "../adapters/GoogleCalendarIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { enqueueVoiceAppointmentWork } from "../voice/enqueueVoiceAppointmentWork.js";

export function findCalendarConnection(workspace) {
  const hub = workspace?.connected?.integrationPlatform
    ?? workspace?.integrationPlatform
    ?? null;
  const runtime = hub?.connectionRuntime;
  if (!runtime) return { hub: null, connection: null };
  const byType = runtime.getConnectionByType?.("calendar")
    ?? runtime.getConnectionByType?.("google_calendar")
    ?? null;
  if (byType) return { hub, connection: byType };
  const all = runtime.getConnections?.() ?? [];
  const connection = (Array.isArray(all) ? all : []).find((c) => {
    const type = String(c?.connectionType ?? c?.type ?? "").toLowerCase();
    const provider = String(c?.providerId ?? "").toLowerCase();
    return type.includes("calendar") || provider.includes("calendar");
  }) ?? null;
  return { hub, connection };
}

const CONNECTED_STATUSES = new Set(["", "CONNECTED", "VERIFIED", "ACTIVE"]);

/**
 * Accepts either a slot object ({ startISO, endISO?, label?, memberId?, memberName? })
 * or a plain string label (best-effort Date.parse, falls back to unparseable label only).
 */
export function parseSelectedSlot(slot, { durationMinutes = 30 } = {}) {
  if (slot && typeof slot === "object" && slot.startISO) {
    const start = new Date(slot.startISO);
    if (Number.isNaN(start.getTime())) return null;
    const end = slot.endISO ? new Date(slot.endISO) : new Date(start.getTime() + durationMinutes * 60 * 1000);
    return {
      start,
      end,
      label: slot.label ?? null,
      memberId: slot.memberId ?? null,
      memberName: slot.memberName ?? null,
    };
  }
  if (typeof slot === "string" && slot.trim()) {
    const label = slot.trim();
    const parsed = Date.parse(label);
    if (Number.isFinite(parsed)) {
      const start = new Date(parsed);
      return {
        start,
        end: new Date(start.getTime() + durationMinutes * 60 * 1000),
        label,
        memberId: null,
        memberName: null,
      };
    }
    return { start: null, end: null, label, memberId: null, memberName: null };
  }
  return null;
}

export async function bookConfirmedAppointment({
  businessId,
  name = "",
  phone = "",
  slot,
  source = "sms",
  speech = "",
  getWorkspace = null,
  durationMinutes = 30,
  adapter = null,
  nowMs = Date.now(),
  callSid = null,
} = {}) {
  const parsed = parseSelectedSlot(slot, { durationMinutes });
  if (!parsed) return deepFreeze({ ok: false, reason: "slot_required" });
  if (typeof getWorkspace !== "function") return deepFreeze({ ok: false, reason: "workspace_loader_missing" });

  const sourceLabel = source === "book_page" ? "public booking page" : "SMS";
  const who = name || "New appointment";

  let workspace = null;
  try {
    workspace = await getWorkspace(businessId);
  } catch {
    workspace = null;
  }

  let event = deepFreeze({ ok: false, reason: "calendar_not_connected" });
  // Only a real, connected calendar create attempt counts toward the ok:false
  // ("we tried and failed") branch below — an unconnected/misconfigured
  // calendar is a known, honest work-only fallback, not a failure.
  let attemptedCreate = false;
  if (workspace && parsed.start) {
    const { hub, connection } = findCalendarConnection(workspace);
    const credentialResolver = hub?.credentialResolver ?? null;
    const status = String(connection?.status ?? "").toUpperCase();
    if (connection && credentialResolver && CONNECTED_STATUSES.has(status)) {
      attemptedCreate = true;
      try {
        const calendar = adapter ?? new GoogleCalendarIntegrationAdapter({ nowISO: new Date(nowMs).toISOString() });
        const description = [
          `Booked via ${sourceLabel} appointment setter.`,
          phone ? `Phone: ${phone}` : null,
          parsed.memberName ? `With: ${parsed.memberName}` : null,
          speech ? `Notes: ${speech}` : null,
        ].filter(Boolean).join("\n");
        const result = await calendar.executeAction({
          actionRequest: {
            capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
            parameters: {
              summary: `Appointment: ${who}`,
              description,
              start: { dateTime: parsed.start.toISOString() },
              end: { dateTime: parsed.end.toISOString() },
            },
          },
          connection,
          credentialResolver,
        });
        const completed = String(result?.status ?? "").toLowerCase() === "completed";
        event = deepFreeze(completed
          ? {
            ok: true,
            externalReference: result?.externalReference ?? null,
            htmlLink: result?.metadata?.htmlLink ?? null,
            summary: `Appointment: ${who}`,
            start: parsed.start.toISOString(),
            end: parsed.end.toISOString(),
          }
          : { ok: false, reason: result?.error ?? "calendar_create_failed" });
      } catch (err) {
        event = deepFreeze({ ok: false, reason: err instanceof Error ? err.message : "calendar_create_failed" });
      }
    } else if (!connection) {
      event = deepFreeze({ ok: false, reason: "calendar_not_connected" });
    } else if (!credentialResolver) {
      event = deepFreeze({ ok: false, reason: "credential_resolver_missing" });
    } else {
      event = deepFreeze({ ok: false, reason: "calendar_not_connected", status });
    }
  }

  let work;
  try {
    work = await enqueueVoiceAppointmentWork({
      businessId,
      speech: [
        `Confirmed appointment booked${parsed.label ? ` for ${parsed.label}` : ""} via ${sourceLabel}.`,
        speech || null,
      ].filter(Boolean).join(" "),
      from: phone,
      callSid: callSid || `appt_${Date.now()}`,
      reply: event.ok
        ? "Appointment booked and added to the calendar."
        : attemptedCreate
          ? "Appointment confirmed by the customer; calendar create failed — confirm the time on the calendar manually."
          : "Appointment confirmed by the customer; no calendar connected — confirm the time manually.",
      getWorkspace,
    });
  } catch (err) {
    work = deepFreeze({ ok: false, reason: err instanceof Error ? err.message : "work_enqueue_failed" });
  }

  const slotSummary = {
    startISO: parsed.start ? parsed.start.toISOString() : null,
    endISO: parsed.end ? parsed.end.toISOString() : null,
    label: parsed.label,
    memberId: parsed.memberId,
    memberName: parsed.memberName,
  };

  // We attempted a real calendar write and it failed — don't tell the caller
  // the appointment is confirmed; let them message honestly and retry/escalate.
  if (attemptedCreate && !event.ok) {
    return deepFreeze({ ok: false, reason: event.reason, event, work, slot: slotSummary });
  }

  if (event.ok) {
    return deepFreeze({ ok: true, confirmed: true, event, work, slot: slotSummary });
  }

  // No calendar connected — honest, intentional work-only fallback so callers
  // can say "request received, team will confirm" instead of "you're booked".
  return deepFreeze({
    ok: true,
    confirmed: false,
    reason: event.reason ?? "calendar_not_connected",
    event,
    work,
    slot: slotSummary,
  });
}
