/**
 * Small dependency-free IANA timezone helpers built on `Intl`, used anywhere
 * we need to convert a civil (wall-clock) date/time in a specific timezone to
 * a real UTC instant — correctly across DST transitions — without depending
 * on the server process's local timezone (`TZ` env var).
 *
 * Node's `Temporal` is not yet available without a flag on our supported
 * Node versions, so this implements the well-known "format the UTC guess in
 * the target zone, measure the offset, correct once" pattern instead.
 */

const FALLBACK_TIMEZONE = "America/New_York";
const UTC_TIMEZONE = "UTC";

const validTimeZoneCache = new Map();

function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") return false;
  if (validTimeZoneCache.has(timeZone)) return validTimeZoneCache.get(timeZone);
  let valid = true;
  try {
    // Throws RangeError for unknown zone identifiers.
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    valid = false;
  }
  validTimeZoneCache.set(timeZone, valid);
  return valid;
}

/**
 * Resolve the first valid IANA timezone among the candidates (e.g. a
 * member-level timezone, then a team-level timezone), falling back to
 * America/New_York and finally UTC if nothing usable was provided.
 */
export function resolveTimeZone(...candidates) {
  for (const candidate of candidates) {
    if (isValidTimeZone(candidate)) return candidate;
  }
  if (isValidTimeZone(FALLBACK_TIMEZONE)) return FALLBACK_TIMEZONE;
  return UTC_TIMEZONE;
}

const partsFormatterCache = new Map();

function partsFormatterFor(timeZone) {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Civil date/time parts (year/month/day/hour/minute/second) for `instant` as observed in `timeZone`. */
function wallClockParts(instant, timeZone) {
  const parts = {};
  for (const part of partsFormatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts;
}

/**
 * Offset (ms) such that `instantMs + offset` equals the wall-clock time in
 * `timeZone` reinterpreted as a UTC instant. Positive east of UTC.
 */
function offsetMsAt(instantMs, timeZone) {
  const p = wallClockParts(new Date(instantMs), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instantMs;
}

/**
 * Convert a civil (wall-clock) date/time in `timeZone` to the UTC instant
 * (epoch ms) it represents — correct across DST transitions.
 *
 * Two-pass correction: the offset at our first guess can be wrong right
 * around a DST transition (the guess and the real instant can straddle the
 * boundary), so we recompute the offset at the corrected instant and, if it
 * changed, apply it once more. This is the standard pattern used when a
 * proper timezone database API (e.g. `Temporal`) isn't available.
 */
export function zonedTimeToUtc({ timeZone, year, month, day, hour = 0, minute = 0, second = 0 }) {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = offsetMsAt(desiredWallMs, resolvedTimeZone);
  const guess = desiredWallMs - offset1;
  const offset2 = offsetMsAt(guess, resolvedTimeZone);
  return offset2 === offset1 ? guess : desiredWallMs - offset2;
}

/** Civil (calendar) date + time-of-day, and day-of-week (0=Sun..6=Sat), for `instant` observed in `timeZone`. */
export function civilDateInTimeZone(instant, timeZone) {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const p = wallClockParts(instant, resolvedTimeZone);
  const dayOfWeek = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, dayOfWeek };
}

/**
 * Add `days` calendar days to a `{year, month, day}` triple. Pure calendar
 * arithmetic (via a UTC-anchored Date, never a real timezone), so it's
 * unaffected by DST — a "day" is always exactly one calendar date later.
 */
export function addCivilDays({ year, month, day }, days) {
  const d = new Date(Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), dayOfWeek: d.getUTCDay() };
}
