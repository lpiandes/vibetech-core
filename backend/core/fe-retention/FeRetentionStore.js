/**
 * Final Expense Retention CRM state on installation.configuration.feRetention
 */
import crypto from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { DEFAULT_FE_RETENTION_TEMPLATES } from "./FeRetentionTemplates.js";

export const FE_POLICY_STATUSES = Object.freeze(["active", "missed", "lapsed", "cancelled"]);

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** US client phones as E.164 for Twilio (+1XXXXXXXXXX). */
export function normalizeFePhone(phone = "") {
  const raw = safeString(phone);
  if (!raw) return "";
  if (/^\+[1-9]\d{7,14}$/.test(raw.replace(/\s/g, ""))) {
    return raw.replace(/\s/g, "");
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw.startsWith("+") ? raw.replace(/\s/g, "") : `+${digits}`;
}

function nowISO() {
  return new Date().toISOString();
}

export function emptyFeRetentionState() {
  return {
    version: 1,
    clients: [],
    messageLog: [],
    unmatchedCarrierNotices: [],
    settings: {
      holidayMonth: 12,
      holidayDay: 25,
      holidayDateCustomized: false,
      reminderDaysBefore: 3,
      docsArriveDaysDefault: 10,
      agentNotifyEmail: "",
      agentNotifyPhone: "",
      agentNotifyCustomized: false,
      templates: { ...DEFAULT_FE_RETENTION_TEMPLATES },
      lastSchedulerRunAt: null,
      lastGmailLapseRunAt: null,
    },
    updatedAt: null,
  };
}

function normalizePolicy(raw = {}, defaults = {}) {
  const status = FE_POLICY_STATUSES.includes(String(raw.status ?? "").toLowerCase())
    ? String(raw.status).toLowerCase()
    : "active";
  const dueDay = Math.min(28, Math.max(1, Number(raw.dueDay ?? 1) || 1));
  const docsArriveDays = Math.min(
    60,
    Math.max(1, Number(raw.docsArriveDays ?? defaults.docsArriveDaysDefault ?? 10) || 10),
  );
  return {
    carrier: safeString(raw.carrier),
    policyNumber: safeString(raw.policyNumber),
    premium: safeString(raw.premium),
    dueDay,
    effectiveDate: safeString(raw.effectiveDate) || null,
    docsArriveDays,
    status,
    statusUpdatedAt: raw.statusUpdatedAt ? String(raw.statusUpdatedAt) : null,
    statusSource: safeString(raw.statusSource) || null,
  };
}

function normalizeTemplateOverrides(raw = {}) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of Object.keys(DEFAULT_FE_RETENTION_TEMPLATES)) {
    const value = safeString(raw[key]);
    if (value) out[key] = value;
  }
  return out;
}

function normalizeOptionalHolidayDay(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(31, Math.max(1, n));
}

function normalizeOptionalHolidayMonth(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(12, Math.max(1, n));
}

function normalizeClient(raw = {}, defaults = {}) {
  const id = safeString(raw.id) || `fe_client_${crypto.randomUUID()}`;
  return {
    id,
    name: safeString(raw.name),
    phone: normalizeFePhone(raw.phone),
    email: safeString(raw.email),
    birthday: safeString(raw.birthday) || null,
    address: safeString(raw.address) || null,
    policy: normalizePolicy(raw.policy ?? {}, defaults),
    welcomeSentAt: raw.welcomeSentAt ? String(raw.welcomeSentAt) : null,
    docsMailSentAt: raw.docsMailSentAt ? String(raw.docsMailSentAt) : null,
    smsOptedOut: Boolean(raw.smsOptedOut),
    smsOptedOutAt: raw.smsOptedOutAt ? String(raw.smsOptedOutAt) : null,
    smsOptOutSource: safeString(raw.smsOptOutSource) || null,
    /** Optional per-client holiday send date (Hanukkah etc.). Null = business default. */
    holidayMonth: normalizeOptionalHolidayMonth(raw.holidayMonth),
    holidayDay: normalizeOptionalHolidayDay(raw.holidayDay),
    /** Optional per-message copy; blank keys fall back to Settings templates. */
    templateOverrides: normalizeTemplateOverrides(raw.templateOverrides),
    reinstatementRequestedAt: raw.reinstatementRequestedAt ? String(raw.reinstatementRequestedAt) : null,
    reinstatementStatus: ["open", "handled"].includes(String(raw.reinstatementStatus ?? ""))
      ? String(raw.reinstatementStatus)
      : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : nowISO(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : nowISO(),
  };
}

function normalizeUnmatchedNotice(raw = {}) {
  return {
    id: safeString(raw.id) || `fe_notice_${crypto.randomUUID()}`,
    at: raw.at ? String(raw.at) : nowISO(),
    gmailMessageId: safeString(raw.gmailMessageId) || null,
    subject: safeString(raw.subject) || null,
    status: safeString(raw.status) || "missed",
    dismissed: Boolean(raw.dismissed),
  };
}

/** Last-10 digit match for US numbers; full digit match otherwise. */
export function normalizeFePhoneDigits(phone) {
  const digits = safeString(phone).replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function fePhonesMatch(a, b) {
  const left = normalizeFePhoneDigits(a);
  const right = normalizeFePhoneDigits(b);
  return Boolean(left && right && left === right);
}

export function isFeClientSmsPaused(client) {
  return Boolean(client?.smsOptedOut);
}

export function readFeRetentionState(installation = null) {
  const raw = installation?.configuration?.feRetention;
  if (!raw || typeof raw !== "object") return emptyFeRetentionState();
  const defaults = emptyFeRetentionState().settings;
  const settings = {
    ...defaults,
    ...(raw.settings && typeof raw.settings === "object" ? raw.settings : {}),
    templates: {
      ...DEFAULT_FE_RETENTION_TEMPLATES,
      ...(raw.settings?.templates && typeof raw.settings.templates === "object"
        ? raw.settings.templates
        : {}),
    },
  };
  // Migrate old Dec-22 default → Dec 25 until the agent customizes the date.
  if (
    Number(settings.holidayMonth) === 12
    && Number(settings.holidayDay) === 22
    && !settings.holidayDateCustomized
  ) {
    settings.holidayDay = 25;
  }
  return {
    version: 1,
    clients: Array.isArray(raw.clients)
      ? raw.clients.map((c) => normalizeClient(c, settings))
      : [],
    messageLog: Array.isArray(raw.messageLog) ? raw.messageLog.slice(0, 500) : [],
    unmatchedCarrierNotices: Array.isArray(raw.unmatchedCarrierNotices)
      ? raw.unmatchedCarrierNotices.map(normalizeUnmatchedNotice).slice(0, 50)
      : [],
    settings,
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Persist feRetention onto Business OS installation.
 * @param {"replace_settings"|"preserve_settings"} [options.settingsMode]
 *   - replace_settings (default for settings PATCH): incoming settings win
 *   - preserve_settings (touchpoints/scheduler): re-read DB settings so concurrent Settings saves aren't clobbered
 */
export async function writeFeRetentionState({
  platformStore,
  installation,
  state,
  actorId = null,
  historyAction = "fe_retention_update",
  settingsMode = "replace_settings",
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("writeFeRetentionState requires platformStore and installation");
  }
  const businessId = installation.businessId;
  let settings = state?.settings ?? emptyFeRetentionState().settings;
  let configurationBase = installation.configuration ?? {};

  if (settingsMode === "preserve_settings" && typeof platformStore.getBusinessOSInstallation === "function") {
    const latestInstall = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (latestInstall) {
      configurationBase = latestInstall.configuration ?? configurationBase;
      const latest = readFeRetentionState(latestInstall);
      settings = {
        ...latest.settings,
        lastSchedulerRunAt: state?.settings?.lastSchedulerRunAt ?? latest.settings?.lastSchedulerRunAt,
        lastGmailLapseRunAt: state?.settings?.lastGmailLapseRunAt ?? latest.settings?.lastGmailLapseRunAt,
      };
      installation = latestInstall;
    }
  }

  const next = {
    ...state,
    version: 1,
    settings,
    updatedAt: nowISO(),
    messageLog: Array.isArray(state.messageLog) ? state.messageLog.slice(0, 500) : [],
  };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${businessId}`,
    businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `fe_retention_${businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "fe_retention",
    planId: installation.planId ?? `plan_fe_${businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? { product: "fe_retention_crm" },
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...configurationBase,
      purchasedPackages: configurationBase?.purchasedPackages
        ?? ["fe_retention_crm"],
      feRetention: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      {
        at: next.updatedAt,
        action: historyAction,
        actorId,
      },
    ].slice(-100),
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? next.updatedAt,
  });
  return next;
}

export function listFeClients(state) {
  return [...(state?.clients ?? [])].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }),
  );
}

export function getFeClient(state, clientId) {
  const id = safeString(clientId);
  return (state?.clients ?? []).find((c) => c.id === id) ?? null;
}

export function upsertFeClient(state, input = {}) {
  const settings = state?.settings ?? emptyFeRetentionState().settings;
  const nextClient = normalizeClient(
    {
      ...input,
      updatedAt: nowISO(),
      createdAt: input.createdAt || nowISO(),
    },
    settings,
  );
  if (!nextClient.name) {
    return { ok: false, reason: "name_required", state, client: null };
  }
  if (!nextClient.phone && !nextClient.email) {
    return { ok: false, reason: "phone_or_email_required", state, client: null };
  }
  const clients = [...(state.clients ?? [])];
  const idx = clients.findIndex((c) => c.id === nextClient.id);
  const isNew = idx < 0;
  if (idx >= 0) {
    nextClient.createdAt = clients[idx].createdAt;
    nextClient.welcomeSentAt = input.welcomeSentAt !== undefined
      ? nextClient.welcomeSentAt
      : clients[idx].welcomeSentAt;
    nextClient.docsMailSentAt = input.docsMailSentAt !== undefined
      ? nextClient.docsMailSentAt
      : clients[idx].docsMailSentAt;
    if (input.smsOptedOut === undefined) {
      nextClient.smsOptedOut = clients[idx].smsOptedOut;
      nextClient.smsOptedOutAt = clients[idx].smsOptedOutAt;
      nextClient.smsOptOutSource = clients[idx].smsOptOutSource;
    }
    if (input.holidayMonth === undefined) nextClient.holidayMonth = clients[idx].holidayMonth;
    if (input.holidayDay === undefined) nextClient.holidayDay = clients[idx].holidayDay;
    if (input.templateOverrides === undefined) {
      nextClient.templateOverrides = clients[idx].templateOverrides;
    }
    if (input.reinstatementStatus === undefined) {
      nextClient.reinstatementStatus = clients[idx].reinstatementStatus;
      nextClient.reinstatementRequestedAt = clients[idx].reinstatementRequestedAt;
    }
    clients[idx] = nextClient;
  } else {
    clients.push(nextClient);
  }
  return {
    ok: true,
    isNew,
    client: nextClient,
    state: { ...state, clients, updatedAt: nowISO() },
  };
}

export function deleteFeClient(state, clientId) {
  const id = safeString(clientId);
  const clients = (state.clients ?? []).filter((c) => c.id !== id);
  if (clients.length === (state.clients ?? []).length) {
    return { ok: false, reason: "not_found", state };
  }
  return { ok: true, state: { ...state, clients, updatedAt: nowISO() } };
}

export function setFeClientPolicyStatus(state, { clientId, status, source = "manual" } = {}) {
  const client = getFeClient(state, clientId);
  if (!client) return { ok: false, reason: "not_found", state, client: null };
  if (!FE_POLICY_STATUSES.includes(String(status))) {
    return { ok: false, reason: "invalid_status", state, client };
  }
  const next = {
    ...client,
    policy: {
      ...client.policy,
      status: String(status),
      statusUpdatedAt: nowISO(),
      statusSource: safeString(source) || "manual",
    },
    updatedAt: nowISO(),
  };
  if (String(status) === "active") {
    next.reinstatementStatus = next.reinstatementStatus === "open" ? "handled" : next.reinstatementStatus;
  }
  const clients = (state.clients ?? []).map((c) => (c.id === next.id ? next : c));
  return {
    ok: true,
    client: next,
    previousStatus: client.policy?.status,
    state: { ...state, clients, updatedAt: nowISO() },
  };
}

export function setFeClientReinstatement(state, { clientId, status = "open", at = null } = {}) {
  const client = getFeClient(state, clientId);
  if (!client) return { ok: false, reason: "not_found", state, client: null };
  const nextStatus = status === "handled" ? "handled" : "open";
  const next = {
    ...client,
    reinstatementStatus: nextStatus,
    reinstatementRequestedAt: nextStatus === "open"
      ? (at ? String(at) : nowISO())
      : client.reinstatementRequestedAt,
    updatedAt: nowISO(),
  };
  const clients = (state.clients ?? []).map((c) => (c.id === next.id ? next : c));
  return { ok: true, client: next, state: { ...state, clients, updatedAt: nowISO() } };
}

export function applyFeTemplateOverrideToClients(state, { kind, template, clientIds = [] } = {}) {
  const key = safeString(kind);
  const text = safeString(template);
  const ids = new Set((Array.isArray(clientIds) ? clientIds : []).map((id) => String(id)));
  if (!key || !ids.size) {
    return { ok: false, reason: "kind_and_clients_required", state, updated: 0 };
  }
  let updated = 0;
  const clients = (state.clients ?? []).map((c) => {
    if (!ids.has(c.id)) return c;
    updated += 1;
    const templateOverrides = { ...(c.templateOverrides ?? {}) };
    if (text) templateOverrides[key] = text;
    else delete templateOverrides[key];
    return { ...c, templateOverrides, updatedAt: nowISO() };
  });
  return { ok: true, updated, state: { ...state, clients, updatedAt: nowISO() } };
}

export function appendUnmatchedCarrierNotice(state, notice = {}) {
  const row = normalizeUnmatchedNotice(notice);
  const existing = state.unmatchedCarrierNotices ?? [];
  if (row.gmailMessageId && existing.some((n) => n.gmailMessageId === row.gmailMessageId)) {
    return { state, entry: existing.find((n) => n.gmailMessageId === row.gmailMessageId) };
  }
  const unmatchedCarrierNotices = [row, ...existing].slice(0, 50);
  return { state: { ...state, unmatchedCarrierNotices, updatedAt: nowISO() }, entry: row };
}

export function dismissUnmatchedCarrierNotice(state, noticeId) {
  const id = safeString(noticeId);
  const unmatchedCarrierNotices = (state.unmatchedCarrierNotices ?? []).map((n) => (
    n.id === id || n.gmailMessageId === id ? { ...n, dismissed: true } : n
  ));
  return { state: { ...state, unmatchedCarrierNotices, updatedAt: nowISO() } };
}

/**
 * Pause or resume automatic SMS for a client (TCPA STOP / START).
 */
export function setFeClientSmsOptOut(state, {
  clientId,
  optedOut = true,
  source = "sms_stop",
  at = null,
} = {}) {
  const client = getFeClient(state, clientId);
  if (!client) return { ok: false, reason: "not_found", state, client: null };
  const paused = Boolean(optedOut);
  const next = {
    ...client,
    smsOptedOut: paused,
    smsOptedOutAt: paused ? (at ? String(at) : nowISO()) : null,
    smsOptOutSource: paused ? (safeString(source) || "sms_stop") : null,
    updatedAt: nowISO(),
  };
  const clients = (state.clients ?? []).map((c) => (c.id === next.id ? next : c));
  return {
    ok: true,
    client: next,
    previouslyOptedOut: Boolean(client.smsOptedOut),
    state: { ...state, clients, updatedAt: nowISO() },
  };
}

export function findFeClientByPhone(state, phone) {
  const needle = normalizeFePhoneDigits(phone);
  if (!needle) return null;
  return (state?.clients ?? []).find((c) => fePhonesMatch(c.phone, phone)) ?? null;
}

export function appendFeMessageLog(state, entry = {}) {
  const row = {
    id: safeString(entry.id) || `fe_msg_${crypto.randomUUID()}`,
    at: entry.at ? String(entry.at) : nowISO(),
    kind: safeString(entry.kind) || "unknown",
    channel: safeString(entry.channel) || "sms",
    clientId: safeString(entry.clientId) || null,
    clientName: safeString(entry.clientName) || null,
    to: safeString(entry.to) || null,
    body: safeString(entry.body) || null,
    ok: entry.ok !== false,
    error: safeString(entry.error) || null,
    externalReference: safeString(entry.externalReference) || null,
  };
  const messageLog = [row, ...(state.messageLog ?? [])].slice(0, 500);
  return { state: { ...state, messageLog, updatedAt: nowISO() }, entry: row };
}

export function updateFeSettings(state, patch = {}) {
  // Only known settings keys — avoid polluting settings with unrelated PATCH body fields.
  const base = state.settings ?? emptyFeRetentionState().settings;
  const settings = { ...base };

  if (patch.agentNotifyEmail != null) {
    settings.agentNotifyEmail = safeString(patch.agentNotifyEmail);
  }
  if (patch.agentNotifyPhone != null) {
    settings.agentNotifyPhone = safeString(patch.agentNotifyPhone);
  }
  if (patch.agentNotifyCustomized != null) {
    settings.agentNotifyCustomized = Boolean(patch.agentNotifyCustomized);
  } else if (patch.agentNotifyEmail != null || patch.agentNotifyPhone != null) {
    settings.agentNotifyCustomized = true;
  }
  if (patch.docsArriveDaysDefault != null) {
    settings.docsArriveDaysDefault = Math.min(60, Math.max(1, Number(patch.docsArriveDaysDefault) || 10));
  }
  if (patch.lastSchedulerRunAt !== undefined) {
    settings.lastSchedulerRunAt = patch.lastSchedulerRunAt;
  }
  if (patch.lastGmailLapseRunAt !== undefined) {
    settings.lastGmailLapseRunAt = patch.lastGmailLapseRunAt;
  }
  if (patch.templates && typeof patch.templates === "object") {
    settings.templates = {
      ...DEFAULT_FE_RETENTION_TEMPLATES,
      ...(base.templates ?? {}),
      ...patch.templates,
    };
  }
  if (patch.reminderDaysBefore != null) {
    settings.reminderDaysBefore = Math.min(14, Math.max(1, Number(patch.reminderDaysBefore) || 3));
  }
  if (patch.holidayMonth != null || patch.holidayDay != null) {
    const nextMonth = patch.holidayMonth != null
      ? Math.min(12, Math.max(1, Number(patch.holidayMonth) || 12))
      : Number(settings.holidayMonth) || 12;
    const maxDay = nextMonth === 2 ? 28 : [4, 6, 9, 11].includes(nextMonth) ? 30 : 31;
    settings.holidayMonth = nextMonth;
    const rawDay = patch.holidayDay != null ? Number(patch.holidayDay) : settings.holidayDay;
    settings.holidayDay = Math.min(maxDay, Math.max(1, Number(rawDay) || 25));
    settings.holidayDateCustomized = true;
  }
  if (patch.holidayDateCustomized != null) {
    settings.holidayDateCustomized = Boolean(patch.holidayDateCustomized);
  }

  // One-time product migration: old code default was Dec 22; product default is now Dec 25.
  if (
    Number(settings.holidayMonth) === 12
    && Number(settings.holidayDay) === 22
    && !settings.holidayDateCustomized
  ) {
    settings.holidayDay = 25;
  }

  return { ...state, settings, updatedAt: nowISO() };
}

export function markClientTouchSent(state, { clientId, field, at = null } = {}) {
  const client = getFeClient(state, clientId);
  if (!client) return state;
  const next = { ...client, updatedAt: nowISO() };
  if (field === "welcome") next.welcomeSentAt = at || nowISO();
  if (field === "docsMail") next.docsMailSentAt = at || nowISO();
  const clients = (state.clients ?? []).map((c) => (c.id === next.id ? next : c));
  return { ...state, clients, updatedAt: nowISO() };
}

export { deepFreeze };
