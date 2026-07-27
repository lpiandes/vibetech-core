import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { JOB_TYPES } from "../../platform/jobs/PlatformJobQueue.js";

/**
 * Normalize schedule config from operating contract trigger.schedule.
 */
export function normalizeSpecialtySchedule(schedule = null, { fallbackFromWhenText = "" } = {}) {
  const src = schedule && typeof schedule === "object" ? schedule : {};
  let cadence = String(src.cadence ?? "").toLowerCase() || null;
  let dayOfWeek = Number.isFinite(Number(src.dayOfWeek)) ? Number(src.dayOfWeek) : null;
  let hourLocal = Number.isFinite(Number(src.hourLocal)) ? Number(src.hourLocal) : 9;
  const timezone = String(src.timezone ?? "America/New_York").trim() || "America/New_York";

  const whenText = String(fallbackFromWhenText ?? "").toLowerCase();
  if (!cadence && /sunday|weekly|digest|every week/.test(whenText)) {
    cadence = "weekly";
  }
  if (dayOfWeek == null && /sunday/.test(whenText)) dayOfWeek = 0;
  if (dayOfWeek == null && /monday/.test(whenText)) dayOfWeek = 1;
  if (dayOfWeek == null && cadence === "weekly") dayOfWeek = 0;
  if (!cadence) return null;

  return deepFreeze({
    cadence,
    dayOfWeek: dayOfWeek == null ? 0 : Math.max(0, Math.min(6, dayOfWeek)),
    hourLocal: Math.max(0, Math.min(23, hourLocal)),
    timezone,
  });
}

/**
 * Compute next runAfter ISO for a weekly schedule (UTC approximation of local hour).
 */
export function computeNextScheduleRunAfter({
  schedule,
  fromISO = null,
} = {}) {
  const norm = normalizeSpecialtySchedule(schedule);
  if (!norm || norm.cadence !== "weekly") return null;

  const from = fromISO ? new Date(fromISO) : new Date();
  if (Number.isNaN(from.getTime())) return null;

  const target = new Date(from.getTime());
  // Advance at least 1 minute so we don't re-fire immediately.
  target.setUTCMinutes(target.getUTCMinutes() + 1);

  const desiredDow = Number(norm.dayOfWeek);
  const desiredHour = Number(norm.hourLocal);

  for (let i = 0; i < 14; i += 1) {
    const candidate = new Date(target.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + i);
    if (candidate.getUTCDay() !== desiredDow) continue;
    candidate.setUTCHours(desiredHour, 0, 0, 0);
    if (candidate.getTime() > from.getTime()) {
      return candidate.toISOString();
    }
  }
  // Fallback: +7 days
  const fallback = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  fallback.setUTCHours(desiredHour, 0, 0, 0);
  return fallback.toISOString();
}

export function specialtyScheduleIdempotencyKey({ businessId, employeeId, runAfter }) {
  const day = String(runAfter ?? "").slice(0, 10);
  return `specialty_schedule:${businessId}:${employeeId}:${day}`;
}

/**
 * Enqueue next specialty_schedule_due job when automation is Active + schedule configured.
 */
export async function enqueueSpecialtyScheduleJob({
  queue,
  businessId,
  employeeId,
  schedule,
  whenText = "",
  fromISO = null,
} = {}) {
  if (!queue?.enqueue) return deepFreeze({ ok: false, reason: "queue_required" });
  const norm = normalizeSpecialtySchedule(schedule, { fallbackFromWhenText: whenText });
  if (!norm) return deepFreeze({ ok: false, reason: "no_schedule" });

  const runAfter = computeNextScheduleRunAfter({ schedule: norm, fromISO });
  if (!runAfter) return deepFreeze({ ok: false, reason: "no_run_after" });

  const job = await queue.enqueue({
    businessId: String(businessId),
    jobType: JOB_TYPES.SPECIALTY_SCHEDULE_DUE,
    idempotencyKey: specialtyScheduleIdempotencyKey({
      businessId,
      employeeId,
      runAfter,
    }),
    payload: {
      employeeId: String(employeeId),
      schedule: norm,
      eventType: "SPECIALTY_SCHEDULE_DUE",
    },
    runAfter,
  });

  return deepFreeze({
    ok: true,
    jobId: job.id,
    runAfter,
    deduped: Boolean(job.deduped),
    schedule: norm,
  });
}

/**
 * Resolve schedule from employee operating contract.
 */
export function resolveEmployeeSpecialtySchedule(employee = {}) {
  const contract = employee?.operatingContract ?? {};
  const mode = String(contract?.trigger?.mode ?? "");
  const whenAnswer = contract?.scope?.answers?.when;
  const whenText = typeof whenAnswer === "object" && whenAnswer != null
    ? String(whenAnswer.value ?? "")
    : String(whenAnswer ?? "");

  const explicit = normalizeSpecialtySchedule(contract?.trigger?.schedule, {
    fallbackFromWhenText: whenText,
  });
  if (explicit) return explicit;

  // manual_or_events with Sunday/weekly language still gets a digest schedule when Active.
  if (mode === "schedule" || mode === "manual_or_events" || mode === "events") {
    return normalizeSpecialtySchedule({ cadence: "weekly", dayOfWeek: 0, hourLocal: 9 }, {
      fallbackFromWhenText: whenText || "weekly sunday digest",
    });
  }
  return null;
}
