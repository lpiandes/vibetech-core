/**
 * Persist operator interventions on installation.configuration.operatorInterventions.
 * Resolve always requires a root-cause enum (Plan 8).
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { assertRootCauseRequired, normalizeRootCause, OPERATOR_ROOT_CAUSE_LABELS } from "./operatorRootCause.js";

const MAX_INTERVENTIONS = 200;

function asString(value, fallback = null) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normalizeBoolean(value) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return null;
}

function normalizeLaborCostClass(value) {
  const text = asString(value, null)?.toLowerCase() ?? null;
  return ["low", "medium", "high"].includes(text) ? text : null;
}

function normalizeIso(value, fallback = null) {
  const text = asString(value, null);
  if (!text) return fallback;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return fallback;
  return new Date(ms).toISOString();
}

function normalizeMinutesSpent({ minutesSpent = null, startedAt = null, endedAt = null } = {}) {
  if (minutesSpent != null && minutesSpent !== "") {
    const n = Number(minutesSpent);
    if (Number.isFinite(n) && n >= 0) {
      return Math.round(n * 100) / 100;
    }
  }
  const startMs = Date.parse(String(startedAt ?? ""));
  const endMs = Date.parse(String(endedAt ?? ""));
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
    return Math.round(((endMs - startMs) / 60_000) * 100) / 100;
  }
  return null;
}

function normalizeCategory(value) {
  const code = normalizeRootCause(value);
  return code
    ? {
      rootCause: code,
      rootCauseLabel: OPERATOR_ROOT_CAUSE_LABELS[code] ?? code,
      category: code,
    }
    : {
      rootCause: null,
      rootCauseLabel: null,
      category: asString(value, null),
    };
}

function normalizeOpenEntry(entry = {}) {
  const category = normalizeCategory(entry.category ?? entry.rootCause ?? null);
  return deepFreeze({
    caseId: asString(entry.caseId, ""),
    kind: asString(entry.kind, null),
    businessId: asString(entry.businessId ?? entry.partnerId, null),
    partnerId: asString(entry.partnerId ?? entry.businessId, null),
    workflowRunId: asString(entry.workflowRunId, null),
    operatorId: asString(entry.operatorId ?? entry.actorId, null),
    actorId: asString(entry.actorId ?? entry.operatorId, null),
    startedAt: normalizeIso(entry.startedAt, null),
    actionPerformed: asString(entry.actionPerformed, null),
    category: category.category,
    rootCause: category.rootCause,
    rootCauseLabel: category.rootCauseLabel,
    openedAt: normalizeIso(entry.openedAt ?? entry.startedAt, null),
  });
}

function normalizeClosedEntry(entry = {}) {
  const category = normalizeCategory(entry.category ?? entry.rootCause ?? null);
  const startedAt = normalizeIso(entry.startedAt, null);
  const endedAt = normalizeIso(entry.endedAt ?? entry.closedAt, null);
  return deepFreeze({
    caseId: asString(entry.caseId, ""),
    kind: asString(entry.kind, null),
    businessId: asString(entry.businessId ?? entry.partnerId, null),
    partnerId: asString(entry.partnerId ?? entry.businessId, null),
    workflowRunId: asString(entry.workflowRunId, null),
    operatorId: asString(entry.operatorId ?? entry.actorId, null),
    actorId: asString(entry.actorId ?? entry.operatorId, null),
    startedAt,
    endedAt,
    closedAt: endedAt,
    minutesSpent: normalizeMinutesSpent({
      minutesSpent: entry.minutesSpent,
      startedAt,
      endedAt,
    }),
    category: category.category,
    rootCause: category.rootCause,
    rootCauseLabel: category.rootCauseLabel,
    actionPerformed: asString(entry.actionPerformed, null),
    wasNecessary: normalizeBoolean(entry.wasNecessary),
    canAutomate: normalizeBoolean(entry.canAutomate),
    laborCostClass: normalizeLaborCostClass(entry.laborCostClass),
    resolutionOutcome: asString(entry.resolutionOutcome, null),
    linkedTraceRef: asString(entry.linkedTraceRef, null),
    note: asString(entry.note, null)?.slice(0, 2000) ?? null,
    payload: entry.payload && typeof entry.payload === "object" ? entry.payload : null,
  });
}

function businessIdFromCaseId(caseId) {
  const parts = String(caseId ?? "").split(":");
  return parts.length >= 2 ? asString(parts[1], null) : null;
}

export function readOperatorInterventions(installation = null) {
  const raw = installation?.configuration?.operatorInterventions;
  if (!raw || typeof raw !== "object") {
    return { version: 1, open: [], closed: [], updatedAt: null };
  }
  return {
    version: 1,
    open: Array.isArray(raw.open) ? raw.open.map(normalizeOpenEntry) : [],
    closed: Array.isArray(raw.closed) ? raw.closed.map(normalizeClosedEntry) : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

export function isCaseResolved(installation, caseId) {
  const state = readOperatorInterventions(installation);
  const id = String(caseId ?? "");
  return state.closed.some((row) => String(row.caseId) === id);
}

/**
 * Record an open intervention row when an operator takes over.
 */
export function openOperatorIntervention({
  installation = null,
  caseId,
  kind,
  businessId = null,
  workflowRunId = null,
  operatorId = "platform_admin",
  startedAt = null,
  actionPerformed = null,
  category = null,
  nowISO = null,
} = {}) {
  const id = asString(caseId, "");
  if (!id) {
    return { ok: false, code: "case_id_required", message: "caseId required." };
  }
  const at = normalizeIso(nowISO ?? new Date().toISOString(), new Date().toISOString());
  const prior = readOperatorInterventions(installation);
  const openedEntry = normalizeOpenEntry({
    caseId: id,
    kind,
    businessId: businessId ?? installation?.businessId ?? null,
    workflowRunId,
    operatorId,
    startedAt: startedAt ?? at,
    actionPerformed,
    category,
    openedAt: at,
  });
  const open = [openedEntry, ...prior.open.filter((row) => String(row.caseId) !== id)].slice(0, MAX_INTERVENTIONS);
  return {
    ok: true,
    intervention: openedEntry,
    state: deepFreeze({
      version: 1,
      open,
      closed: prior.closed,
      updatedAt: at,
    }),
  };
}

/**
 * Record a closed intervention — root cause mandatory.
 */
export function closeOperatorIntervention({
  installation = null,
  caseId,
  kind,
  rootCause,
  category = null,
  note = null,
  businessId = null,
  partnerId = null,
  workflowRunId = null,
  operatorId = null,
  actorId = null,
  startedAt = null,
  endedAt = null,
  closedAt = null,
  minutesSpent = null,
  actionPerformed = null,
  wasNecessary = null,
  canAutomate = null,
  laborCostClass = null,
  resolutionOutcome = null,
  linkedTraceRef = null,
  nowISO = null,
  payload = null,
} = {}) {
  const gate = assertRootCauseRequired(rootCause ?? category);
  if (!gate.ok) {
    return { ok: false, ...gate };
  }
  const id = asString(caseId, "");
  if (!id) {
    return { ok: false, code: "case_id_required", message: "caseId required." };
  }
  const at = normalizeIso(nowISO ?? new Date().toISOString(), new Date().toISOString());
  const prior = readOperatorInterventions(installation);
  const openRow = prior.open.find((row) => String(row.caseId) === id) ?? null;
  const resolvedStartedAt = normalizeIso(startedAt ?? openRow?.startedAt, null);
  const resolvedEndedAt = normalizeIso(endedAt ?? closedAt ?? at, at);
  const resolvedOperatorId = asString(operatorId ?? actorId ?? openRow?.operatorId ?? openRow?.actorId, "platform_admin");
  const resolvedBusinessId = businessId
    ?? partnerId
    ?? openRow?.businessId
    ?? installation?.businessId
    ?? businessIdFromCaseId(id)
    ?? null;
  const closedEntry = normalizeClosedEntry({
    caseId: id,
    kind: kind ?? openRow?.kind ?? null,
    rootCause: gate.rootCause,
    category: gate.rootCause,
    businessId: resolvedBusinessId,
    partnerId: partnerId ?? businessId ?? openRow?.partnerId ?? resolvedBusinessId,
    workflowRunId: workflowRunId ?? openRow?.workflowRunId ?? null,
    operatorId: resolvedOperatorId,
    actorId: resolvedOperatorId,
    startedAt: resolvedStartedAt,
    endedAt: resolvedEndedAt,
    minutesSpent,
    actionPerformed: actionPerformed ?? openRow?.actionPerformed ?? null,
    wasNecessary,
    canAutomate,
    laborCostClass,
    resolutionOutcome,
    linkedTraceRef,
    note,
    payload,
  });
  const open = prior.open.filter((row) => String(row.caseId) !== id);
  const closed = [closedEntry, ...prior.closed.filter((row) => String(row.caseId) !== id)]
    .slice(0, MAX_INTERVENTIONS);
  return {
    ok: true,
    intervention: closedEntry,
    state: deepFreeze({
      version: 1,
      open,
      closed,
      updatedAt: at,
    }),
  };
}

export async function persistOperatorInterventions({
  platformStore,
  installation,
  state,
  actorId = "platform_admin",
} = {}) {
  if (!platformStore || !installation) return null;
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "operator_interventions",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    configuration: {
      ...(installation.configuration ?? {}),
      operatorInterventions: state,
    },
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return state;
}

/**
 * Aggregate closed root causes across businesses for roadmap feed.
 */
export function summarizeRootCauseRoadmap(interventionsByBusiness = []) {
  const counts = {};
  for (const row of interventionsByBusiness) {
    for (const closed of row.closed ?? []) {
      const code = String(closed.rootCause ?? "");
      if (!code) continue;
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  const ranked = Object.entries(counts)
    .map(([rootCause, count]) => ({ rootCause, count }))
    .sort((a, b) => b.count - a.count);
  return deepFreeze({ ranked, totalClosed: ranked.reduce((n, r) => n + r.count, 0) });
}
