/**
 * SMS appointment setter sessions.
 *
 * Durable storage lives on installation.configuration.appointmentSetterSessions
 * (same pattern as CrmStore / ProspectingJobStore). A process-local in-memory
 * cache is kept so synchronous callers (and unit tests) can read/write without
 * a platformStore, and so a single Node process stays coherent between a
 * durable write and an immediate follow-up read within the same request.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const sessions = new Map();
const STAGES = new Set(["qualify", "offer", "confirm", "booked", "closed"]);

const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TERMINAL_STAGE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days for booked/closed

export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

function key(businessId, phone) {
  return `${String(businessId ?? "")}:${normalizePhone(phone)}`;
}

function snapshot(value) {
  return value ? deepFreeze({
    ...value,
    answers: { ...(value.answers ?? {}) },
    offeredSlots: [...(value.offeredSlots ?? [])],
  }) : null;
}

function normalizeSessionValue(raw) {
  if (!raw || typeof raw !== "object") return null;
  const normalizedPhone = normalizePhone(raw.phone);
  if (!raw.businessId || !normalizedPhone) return null;
  const stage = STAGES.has(raw.stage) ? raw.stage : "qualify";
  return {
    businessId: String(raw.businessId),
    phone: normalizedPhone,
    contactId: raw.contactId ?? null,
    name: raw.name ?? "",
    stage,
    answers: raw.answers && typeof raw.answers === "object" ? { ...raw.answers } : {},
    offeredSlots: Array.isArray(raw.offeredSlots) ? raw.offeredSlots : [],
    selectedSlot: raw.selectedSlot ?? null,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Sync in-memory API — kept for unit tests and any call site without a
// platformStore. Backed by the same process-local cache the durable API uses.
// ---------------------------------------------------------------------------

export function getSession({ businessId, phone } = {}) {
  return snapshot(sessions.get(key(businessId, phone)));
}

export function upsertSession({ businessId, phone, ...patch } = {}) {
  const normalizedPhone = normalizePhone(phone);
  if (!businessId || !normalizedPhone) return null;
  const prior = sessions.get(key(businessId, normalizedPhone)) ?? {};
  const stage = STAGES.has(patch.stage) ? patch.stage : (prior.stage ?? "qualify");
  const value = {
    businessId: String(businessId),
    phone: normalizedPhone,
    contactId: patch.contactId ?? prior.contactId ?? null,
    name: patch.name ?? prior.name ?? "",
    stage,
    answers: { ...(prior.answers ?? {}), ...(patch.answers ?? {}) },
    offeredSlots: patch.offeredSlots ?? prior.offeredSlots ?? [],
    selectedSlot: patch.selectedSlot ?? prior.selectedSlot ?? null,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
  sessions.set(key(businessId, normalizedPhone), value);
  return snapshot(value);
}

export function clearSession({ businessId, phone } = {}) {
  return sessions.delete(key(businessId, phone));
}

// ---------------------------------------------------------------------------
// Durable API — installation.configuration.appointmentSetterSessions
// Shape: { version: 1, byKey: { "bizId:+1555...": sessionObj }, updatedAt }
// ---------------------------------------------------------------------------

export function emptyAppointmentSetterSessionsState() {
  return { version: 1, byKey: {}, updatedAt: null };
}

export function readAppointmentSetterSessionsState(installation) {
  const raw = installation?.configuration?.appointmentSetterSessions;
  if (!raw || typeof raw !== "object") return emptyAppointmentSetterSessionsState();
  const byKey = {};
  for (const [k, v] of Object.entries(raw.byKey && typeof raw.byKey === "object" ? raw.byKey : {})) {
    const normalized = normalizeSessionValue(v);
    if (normalized) byKey[k] = normalized;
  }
  return { version: 1, byKey, updatedAt: raw.updatedAt ?? null };
}

/** Prune sessions older than 30 days, or closed/booked sessions older than 14 days. */
function pruneSessions(byKey, nowMs = Date.now()) {
  const out = {};
  for (const [k, session] of Object.entries(byKey ?? {})) {
    const updatedAtMs = Date.parse(session?.updatedAt ?? "");
    const age = Number.isFinite(updatedAtMs) ? nowMs - updatedAtMs : 0;
    if (age > MAX_SESSION_AGE_MS) continue;
    if ((session.stage === "closed" || session.stage === "booked") && age > TERMINAL_STAGE_MAX_AGE_MS) continue;
    out[k] = session;
  }
  return out;
}

export async function writeAppointmentSetterSessionsState({
  platformStore,
  installation,
  state,
  actorId = null,
}) {
  if (!platformStore || !installation) {
    throw new Error("writeAppointmentSetterSessionsState requires platformStore and installation");
  }
  const next = {
    version: 1,
    byKey: pruneSessions(state?.byKey ?? {}),
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
      ?? "appointment_setter_sessions_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration && typeof installation.configuration === "object"
        ? installation.configuration
        : {}),
      appointmentSetterSessions: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      { at: next.updatedAt, action: "appointment_setter_sessions_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

/**
 * Read a session from durable storage. Falls back to the process-local cache
 * only for coherence bookkeeping (updates it on a durable hit); never invents
 * a session that isn't in either place.
 */
export async function getDurableSession({ platformStore, businessId, phone, installation = null } = {}) {
  if (!platformStore || !businessId) return null;
  const install = installation ?? await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!install) return null;
  const state = readAppointmentSetterSessionsState(install);
  const k = key(businessId, phone);
  const session = state.byKey[k] ?? null;
  if (session) sessions.set(k, session);
  return snapshot(session);
}

/**
 * Upsert a session durably. Uses the prior durable value (or, failing that,
 * the in-memory cache — kept coherent by prior durable writes in this same
 * process) as the merge base, then persists and refreshes the memory cache.
 */
export async function upsertDurableSession({
  platformStore,
  businessId,
  phone,
  installation = null,
  actorId = null,
  ...patch
} = {}) {
  if (!platformStore || !businessId) {
    throw new Error("upsertDurableSession requires platformStore and businessId");
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error("upsertDurableSession requires a valid phone");
  }
  const install = installation ?? await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!install) {
    throw new Error("upsertDurableSession: installation not found");
  }
  const state = readAppointmentSetterSessionsState(install);
  const k = key(businessId, normalizedPhone);
  const prior = state.byKey[k] ?? sessions.get(k) ?? {};
  const stage = STAGES.has(patch.stage) ? patch.stage : (prior.stage ?? "qualify");
  const value = {
    businessId: String(businessId),
    phone: normalizedPhone,
    contactId: patch.contactId ?? prior.contactId ?? null,
    name: patch.name ?? prior.name ?? "",
    stage,
    answers: { ...(prior.answers ?? {}), ...(patch.answers ?? {}) },
    offeredSlots: patch.offeredSlots ?? prior.offeredSlots ?? [],
    selectedSlot: patch.selectedSlot ?? prior.selectedSlot ?? null,
    updatedAt: new Date().toISOString(),
  };
  await writeAppointmentSetterSessionsState({
    platformStore,
    installation: install,
    state: { ...state, byKey: { ...state.byKey, [k]: value } },
    actorId,
  });
  sessions.set(k, value);
  return snapshot(value);
}
