/**
 * On inbound voice "book" intent: resolve next free team slot and book a
 * CONFIRMED appointment (calendar event + Work). Falls back to HOLD path
 * when availability or calendar cannot complete a live book.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { resolveNextSlots } from "../appointment-setter/resolveAvailabilitySlots.js";
import { bookConfirmedAppointment } from "../appointment-setter/bookConfirmedAppointment.js";
import { fetchCalendarBusyIntervals } from "../appointment-setter/fetchCalendarBusyIntervals.js";
import { readTeamAvailability } from "../appointment-setter/TeamAvailabilityStore.js";

/**
 * @returns {Promise<{ ok: boolean, booked?: boolean, slot?: object, bookResult?: object, reason?: string, replySuffix?: string }>}
 */
export async function tryBookVoiceAppointmentSlot({
  businessId,
  speech = "",
  from = "",
  callSid = "",
  installation = null,
  getWorkspace = null,
  nowMs = Date.now(),
  durationMinutes = 30,
} = {}) {
  if (typeof getWorkspace !== "function") {
    return deepFreeze({ ok: false, booked: false, reason: "workspace_loader_missing" });
  }
  if (!installation) {
    return deepFreeze({ ok: false, booked: false, reason: "installation_missing" });
  }

  let availability = null;
  try {
    availability = readTeamAvailability(installation);
  } catch {
    availability = null;
  }
  if (!availability?.members || !Object.keys(availability.members).length) {
    return deepFreeze({
      ok: false,
      booked: false,
      reason: "no_team_availability",
      replySuffix: null,
    });
  }

  let workspace = null;
  try {
    workspace = await getWorkspace(businessId);
  } catch {
    workspace = null;
  }

  const timeMinISO = new Date(nowMs).toISOString();
  const timeMaxISO = new Date(nowMs + 14 * 24 * 60 * 60 * 1000).toISOString();
  let busyIntervals = [];
  try {
    busyIntervals = workspace
      ? await fetchCalendarBusyIntervals(workspace, timeMinISO, timeMaxISO)
      : [];
  } catch {
    busyIntervals = [];
  }

  let slots = [];
  try {
    slots = resolveNextSlots({
      availability,
      busyIntervals,
      count: 3,
      durationMinutes,
      now: new Date(nowMs),
    });
  } catch {
    slots = [];
  }
  const next = Array.isArray(slots) && slots[0] ? slots[0] : null;
  if (!next?.startISO) {
    return deepFreeze({
      ok: false,
      booked: false,
      reason: "no_open_slots",
      replySuffix: null,
    });
  }

  const bookResult = await bookConfirmedAppointment({
    businessId,
    name: from || "Phone caller",
    phone: from,
    slot: next,
    source: "voice",
    speech,
    getWorkspace,
    durationMinutes,
    nowMs,
    callSid,
  });

  if (!bookResult?.ok) {
    return deepFreeze({
      ok: false,
      booked: false,
      reason: bookResult?.reason ?? "book_failed",
      bookResult,
      replySuffix: null,
    });
  }

  const label = String(next.label ?? next.startISO);
  if (bookResult.confirmed) {
    return deepFreeze({
      ok: true,
      booked: true,
      confirmed: true,
      slot: next,
      bookResult,
      replySuffix: `I booked you for ${label}. You will get a confirmation from the team shortly.`,
    });
  }

  // Slot chosen + Work opened, but calendar not connected — honest, not "you're booked".
  return deepFreeze({
    ok: true,
    booked: false,
    confirmed: false,
    slot: next,
    bookResult,
    reason: bookResult.reason ?? "calendar_not_connected",
    replySuffix: `I have ${label} as the next open time and opened Work for the team to confirm it with you.`,
  });
}
