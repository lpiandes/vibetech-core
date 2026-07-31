/**
 * Team availability for appointment-setter auto-booking.
 * Durable on installation.configuration.teamAvailability (CrmStore pattern).
 *
 * Shape:
 * {
 *   version: 1,
 *   timezone: "America/New_York",
 *   members: {
 *     [memberId]: {
 *       memberId, displayName, timezone,
 *       weekly: [{ day: 0-6, start: "09:00", end: "17:00" }, ...],
 *       overrides: [{ date: "YYYY-MM-DD", blocked?: true, windows?: [{start,end}] }],
 *       bookable: true,
 *       updatedAt,
 *     },
 *   },
 *   updatedAt,
 * }
 *
 * Timezones ARE used during slot resolution (see resolveAvailabilitySlots.js):
 * each member's weekly/override windows are treated as civil (wall-clock)
 * times in `member.timezone`, falling back to `availability.timezone`, then
 * America/New_York, then UTC if neither is a valid IANA zone identifier.
 * Conversion to UTC instants goes through the `zonedTimeToUtc` helper
 * (backend/core/workspace/_utils/timezone.js), which is correct across DST
 * transitions and never depends on the server process's local timezone.
 */
export const DEFAULT_TIMEZONE = "America/New_York";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTime(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

export function defaultWeeklyAvailability() {
  // Mon–Fri 09:00–17:00 (day 0 = Sun ... 6 = Sat).
  return [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "17:00" }));
}

function normalizeWeeklyWindow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const day = Number(raw.day);
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  const start = isValidTime(raw.start) ? raw.start : null;
  const end = isValidTime(raw.end) ? raw.end : null;
  if (!start || !end || start >= end) return null;
  return { day, start, end };
}

function normalizeOverride(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date ?? "").trim();
  if (!DATE_RE.test(date)) return null;
  if (raw.blocked === true) return { date, blocked: true };
  const windows = Array.isArray(raw.windows)
    ? raw.windows
      .map((w) => {
        const start = isValidTime(w?.start) ? w.start : null;
        const end = isValidTime(w?.end) ? w.end : null;
        if (!start || !end || start >= end) return null;
        return { start, end };
      })
      .filter(Boolean)
    : [];
  if (!windows.length) return null;
  return { date, windows };
}

function normalizeMember(raw, { memberId, fallbackWeekly = true } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(memberId ?? raw.memberId ?? "").trim();
  if (!id) return null;
  const weekly = Array.isArray(raw.weekly)
    ? raw.weekly.map(normalizeWeeklyWindow).filter(Boolean)
    : [];
  return {
    memberId: id,
    displayName: String(raw.displayName ?? "").trim() || id,
    timezone: String(raw.timezone ?? "").trim() || null,
    weekly: weekly.length ? weekly : (fallbackWeekly ? defaultWeeklyAvailability() : []),
    overrides: Array.isArray(raw.overrides) ? raw.overrides.map(normalizeOverride).filter(Boolean) : [],
    bookable: raw.bookable !== false,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function emptyTeamAvailability() {
  return { version: 1, timezone: DEFAULT_TIMEZONE, members: {}, updatedAt: null };
}

export function readTeamAvailability(installation) {
  const raw = installation?.configuration?.teamAvailability;
  if (!raw || typeof raw !== "object") return emptyTeamAvailability();
  const members = {};
  for (const [id, member] of Object.entries(raw.members && typeof raw.members === "object" ? raw.members : {})) {
    const normalized = normalizeMember(member, { memberId: id });
    if (normalized) members[normalized.memberId] = normalized;
  }
  return {
    version: 1,
    timezone: String(raw.timezone ?? "").trim() || DEFAULT_TIMEZONE,
    members,
    updatedAt: raw.updatedAt ?? null,
  };
}

export async function writeTeamAvailability({ platformStore, installation, availability, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("writeTeamAvailability requires platformStore and installation");
  }
  const members = {};
  for (const [id, member] of Object.entries(availability?.members ?? {})) {
    const normalized = normalizeMember(member, { memberId: id });
    if (normalized) members[normalized.memberId] = normalized;
  }
  const next = {
    version: 1,
    timezone: String(availability?.timezone ?? "").trim() || DEFAULT_TIMEZONE,
    members,
    updatedAt: new Date().toISOString(),
  };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "team_availability_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration && typeof installation.configuration === "object"
        ? installation.configuration
        : {}),
      teamAvailability: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      { at: next.updatedAt, action: "team_availability_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

/** Upsert a single member's availability, defaulting weekly to Mon-Fri 9-5 the first time it's enabled. */
export async function upsertMemberAvailability({
  platformStore,
  installation,
  memberId,
  displayName,
  timezone,
  weekly,
  overrides,
  bookable,
  actorId = null,
}) {
  const id = String(memberId ?? "").trim();
  if (!id) throw new Error("upsertMemberAvailability requires memberId");
  const current = readTeamAvailability(installation);
  const existing = current.members[id] ?? null;
  const merged = normalizeMember({
    memberId: id,
    displayName: displayName ?? existing?.displayName ?? id,
    timezone: timezone ?? existing?.timezone ?? null,
    weekly: Array.isArray(weekly) ? weekly : existing?.weekly,
    overrides: Array.isArray(overrides) ? overrides : (existing?.overrides ?? []),
    bookable: bookable !== undefined ? bookable !== false : (existing?.bookable ?? true),
    updatedAt: new Date().toISOString(),
  }, { memberId: id });
  const written = await writeTeamAvailability({
    platformStore,
    installation,
    availability: { ...current, members: { ...current.members, [id]: merged } },
    actorId,
  });
  return written.members[id] ?? merged;
}

export function listBookableMembers(availability) {
  return Object.values(availability?.members ?? {}).filter((m) => m.bookable !== false);
}
