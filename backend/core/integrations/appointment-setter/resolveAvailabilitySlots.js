/**
 * Resolve the next bookable appointment slots from team availability,
 * subtracting busy calendar intervals, and spreading across members.
 *
 * Timezone handling: weekly windows and date overrides are civil (wall-clock)
 * times in each member's own timezone (falling back to the team's
 * `availability.timezone`, then America/New_York, then UTC — see
 * TeamAvailabilityStore). Converting those civil times to UTC instants uses
 * `zonedTimeToUtc`, which is correct across DST transitions and does not
 * depend on the server process's local timezone.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { zonedTimeToUtc, civilDateInTimeZone, addCivilDays, resolveTimeZone } from "../../workspace/_utils/timezone.js";
import { listBookableMembers } from "./TeamAvailabilityStore.js";

const MS_PER_MIN = 60 * 1000;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKeyFor({ year, month, day }) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseTime(time) {
  const [hour, minute] = String(time).split(":").map(Number);
  return { hour, minute };
}

function windowsForDay(member, { dayOfWeek, dateKey }) {
  const override = (member.overrides ?? []).find((o) => o.date === dateKey);
  if (override) {
    if (override.blocked) return [];
    if (Array.isArray(override.windows) && override.windows.length) return override.windows;
  }
  return (member.weekly ?? [])
    .filter((w) => w.day === dayOfWeek)
    .map((w) => ({ start: w.start, end: w.end }));
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Subtract busy [start,end] ms intervals from a [startMs,endMs] range, returning free segments. */
function subtractBusy(startMs, endMs, busyIntervals) {
  let segments = [[startMs, endMs]];
  for (const busy of busyIntervals ?? []) {
    const bs = Date.parse(busy?.start ?? busy?.startISO ?? "");
    const be = Date.parse(busy?.end ?? busy?.endISO ?? "");
    if (!Number.isFinite(bs) || !Number.isFinite(be) || be <= bs) continue;
    const next = [];
    for (const [s, e] of segments) {
      if (!intervalsOverlap(s, e, bs, be)) {
        next.push([s, e]);
        continue;
      }
      if (bs > s) next.push([s, Math.min(bs, e)]);
      if (be < e) next.push([Math.max(be, s), e]);
    }
    segments = next.filter(([s, e]) => e > s);
  }
  return segments;
}

function formatSlotLabel(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * @param {object} params
 * @param {object} params.availability - TeamAvailabilityStore shape
 * @param {number} [params.count=3]
 * @param {Date} [params.now]
 * @param {number} [params.durationMinutes=30]
 * @param {Array<{start:string,end:string}>} [params.busyIntervals] - ISO start/end, applies to all members
 * @param {number} [params.daysAhead=14]
 */
export function resolveNextSlots({
  availability,
  count = 3,
  now = new Date(),
  durationMinutes = 30,
  busyIntervals = [],
  daysAhead = 14,
} = {}) {
  const members = listBookableMembers(availability);
  if (!members.length) return deepFreeze([]);

  const durationMs = durationMinutes * MS_PER_MIN;
  const byMember = new Map(members.map((m) => [m.memberId, []]));
  const teamTimeZone = resolveTimeZone(availability?.timezone);
  const nowMs = now.getTime();

  for (const member of members) {
    // Each member's weekly windows/overrides are civil times in their own
    // timezone — fall back to the team timezone if the member has none set.
    const memberTimeZone = resolveTimeZone(member.timezone, teamTimeZone);
    const startCivil = civilDateInTimeZone(now, memberTimeZone);

    for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
      const civil = dayOffset === 0 ? startCivil : addCivilDays(startCivil, dayOffset);
      const dateKey = dateKeyFor(civil);
      const windows = windowsForDay(member, { dayOfWeek: civil.dayOfWeek, dateKey });

      for (const window of windows) {
        const start = parseTime(window.start);
        const end = parseTime(window.end);
        const windowStartMs = zonedTimeToUtc({
          timeZone: memberTimeZone,
          year: civil.year,
          month: civil.month,
          day: civil.day,
          hour: start.hour,
          minute: start.minute,
        });
        const windowEndMs = zonedTimeToUtc({
          timeZone: memberTimeZone,
          year: civil.year,
          month: civil.month,
          day: civil.day,
          hour: end.hour,
          minute: end.minute,
        });
        const effectiveStartMs = Math.max(windowStartMs, nowMs);
        if (effectiveStartMs >= windowEndMs) continue;
        const free = subtractBusy(effectiveStartMs, windowEndMs, busyIntervals);
        for (const [segStart, segEnd] of free) {
          for (let slotStart = segStart; slotStart + durationMs <= segEnd; slotStart += durationMs) {
            byMember.get(member.memberId).push({
              startMs: slotStart,
              endMs: slotStart + durationMs,
              memberId: member.memberId,
              memberName: member.displayName,
              timeZone: memberTimeZone,
            });
          }
        }
      }
    }
  }

  // Prefer spreading across bookable members: round-robin earliest-available
  // per member, skipping start times already claimed by an earlier member.
  const memberIds = [...byMember.keys()];
  for (const list of byMember.values()) list.sort((a, b) => a.startMs - b.startMs);
  const cursors = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const claimedStarts = new Set();
  const chosen = [];
  let progressed = true;
  while (chosen.length < count && progressed) {
    progressed = false;
    for (const id of memberIds) {
      if (chosen.length >= count) break;
      const list = byMember.get(id);
      let cursor = cursors[id];
      while (cursor < list.length && claimedStarts.has(list[cursor].startMs)) cursor++;
      if (cursor < list.length) {
        chosen.push(list[cursor]);
        claimedStarts.add(list[cursor].startMs);
        cursors[id] = cursor + 1;
        progressed = true;
      } else {
        cursors[id] = cursor;
      }
    }
  }
  chosen.sort((a, b) => a.startMs - b.startMs);

  return deepFreeze(chosen.slice(0, count).map((s, i) => ({
    id: `slot_${i + 1}_${s.startMs}_${s.memberId}`,
    startISO: new Date(s.startMs).toISOString(),
    endISO: new Date(s.endMs).toISOString(),
    label: formatSlotLabel(new Date(s.startMs), s.timeZone),
    memberId: s.memberId,
    memberName: s.memberName,
    timeZone: s.timeZone,
  })));
}
