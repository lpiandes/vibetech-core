/**
 * Shared Eastern-time helpers for FE Retention scheduled sends.
 * Calendar day = America/New_York. Send clock = daily Vercel Hobby cron (13:00 UTC),
 * which is 9 AM EDT / 8 AM EST — not a separate 9 AM ET gate that would miss winter cron.
 */
export const FE_RETENTION_TIMEZONE = "America/New_York";
/** Hobby cron is `0 13 * * *` (1:00 PM UTC). */
export const FE_SCHEDULED_SEND_UTC_HOUR = 13;

const PART_TYPES = Object.freeze(["year", "month", "day", "hour", "minute"]);

/**
 * Calendar + clock parts in a named IANA zone (no extra deps).
 * @param {Date|string|number} [date]
 * @param {string} [timeZone]
 */
export function getZonedParts(date = new Date(), timeZone = FE_RETENTION_TIMEZONE) {
  const instant = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.create(null);
  for (const part of fmt.formatToParts(instant)) {
    if (PART_TYPES.includes(part.type)) bag[part.type] = Number(part.value);
  }
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour: bag.hour,
    minute: bag.minute,
  };
}

export function easternDateKey(date = new Date()) {
  const p = getZonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * True once today's Eastern calendar date has reached 13:00 UTC (the daily cron).
 * Uses the Eastern date's 13:00Z instant so evening ET (after UTC midnight) still catch-up.
 */
export function isAtOrAfterScheduledSendHour(date = new Date()) {
  const instant = date instanceof Date ? date : new Date(date);
  const cronInstant = new Date(`${easternDateKey(instant)}T${String(FE_SCHEDULED_SEND_UTC_HOUR).padStart(2, "0")}:00:00.000Z`);
  return instant.getTime() >= cronInstant.getTime();
}

/**
 * Parse YYYY-MM-DD or MM-DD into { month, day }.
 */
export function parseMonthDay(isoOrMd) {
  const s = String(isoOrMd ?? "").trim();
  const m = s.match(/^(?:(\d{4})-)?(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

function utcDay(year, month, day) {
  return Date.UTC(year, month - 1, day);
}

/**
 * Whole Eastern calendar days until the next occurrence of month/day.
 * 0 = today in America/New_York.
 */
export function daysUntilMonthDay({ month, day } = {}, now = new Date()) {
  const m = Math.min(12, Math.max(1, Number(month) || 0));
  const d = Math.min(31, Math.max(1, Number(day) || 0));
  if (!m || !d) return null;
  const p = getZonedParts(now);
  const today = utcDay(p.year, p.month, p.day);
  let next = utcDay(p.year, m, d);
  if (next < today) next = utcDay(p.year + 1, m, d);
  return Math.round((next - today) / 86400000);
}

export function daysUntilBirthday(birthday, now = new Date()) {
  const md = parseMonthDay(birthday);
  if (!md) return null;
  return daysUntilMonthDay(md, now);
}

export function daysUntilDueDay(dueDay, now = new Date()) {
  const day = Math.min(28, Math.max(1, Number(dueDay) || 1));
  const p = getZonedParts(now);
  const today = utcDay(p.year, p.month, p.day);
  let due = utcDay(p.year, p.month, day);
  if (due < today) {
    const nextMonth = p.month === 12 ? 1 : p.month + 1;
    const nextYear = p.month === 12 ? p.year + 1 : p.year;
    due = utcDay(nextYear, nextMonth, day);
  }
  return Math.round((due - today) / 86400000);
}

/**
 * Idempotency for scheduled kinds: already successfully sent on this Eastern date.
 */
export function alreadySentOnLocalDate(messageLog, { clientId, kind, dateKey }) {
  const id = String(clientId ?? "");
  const k = String(kind ?? "");
  const day = String(dateKey ?? "");
  if (!id || !k || !day) return false;
  return (messageLog ?? []).some((row) => {
    if (String(row.clientId) !== id) return false;
    if (String(row.kind) !== k) return false;
    if (!row.ok) return false;
    try {
      return easternDateKey(row.at) === day;
    } catch {
      return String(row.at ?? "").startsWith(day);
    }
  });
}

export const FE_SCHEDULED_KINDS = Object.freeze(["birthday", "holiday", "paymentReminder"]);
export const FE_IMMEDIATE_KINDS = Object.freeze(["welcome", "docsMail", "lapseRecovery"]);

/** True when the daily cron window (13:00 UTC+) has opened. Used for the once-a-day Gmail pass, not to skip SMS retries. */
export function feScheduledSweepDue(lastSchedulerRunAt, now = new Date()) {
  if (!isAtOrAfterScheduledSendHour(now)) return false;
  if (!lastSchedulerRunAt) return true;
  try {
    return easternDateKey(lastSchedulerRunAt) !== easternDateKey(now);
  } catch {
    return true;
  }
}
