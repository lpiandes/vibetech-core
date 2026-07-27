/**
 * Durable specialty automation fire ledger on installation.configuration.specialtyFireLedger.
 * Owners use this for “what fired / why” — not session-local activity.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const MAX_ENTRIES = 100;

export function readSpecialtyFireLedger(installation = null) {
  const raw = installation?.configuration?.specialtyFireLedger;
  if (!raw || typeof raw !== "object") {
    return { version: 1, entries: [], updatedAt: null };
  }
  return {
    version: 1,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * @returns {{ ledger: object, entry: object }}
 */
export function appendSpecialtyFireEntry(ledger, entry) {
  const nextEntry = deepFreeze({
    id: String(entry.id ?? `fire_${Date.now().toString(36)}`),
    at: String(entry.at ?? new Date().toISOString()),
    eventType: String(entry.eventType ?? ""),
    eventLabel: entry.eventLabel != null ? String(entry.eventLabel) : null,
    employeeId: entry.employeeId != null ? String(entry.employeeId) : null,
    employeeName: entry.employeeName != null ? String(entry.employeeName) : null,
    ok: entry.ok !== false,
    skipReason: entry.skipReason != null ? String(entry.skipReason) : null,
    workId: entry.workId != null ? String(entry.workId) : null,
    approvalIds: Array.isArray(entry.approvalIds) ? entry.approvalIds.map(String) : [],
    pathNotes: Array.isArray(entry.pathNotes) ? entry.pathNotes : [],
    payloadSummary: entry.payloadSummary != null ? String(entry.payloadSummary).slice(0, 500) : null,
    brief: entry.brief != null ? String(entry.brief).slice(0, 400) : null,
  });
  const entries = [nextEntry, ...(ledger?.entries ?? [])].slice(0, MAX_ENTRIES);
  return {
    ledger: {
      version: 1,
      entries,
      updatedAt: nextEntry.at,
    },
    entry: nextEntry,
  };
}

export async function persistSpecialtyFireLedger({
  platformStore,
  installation,
  ledger,
  actorId = "specialty_fire",
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
      ?? "specialty_fire_ledger",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    configuration: {
      ...(installation.configuration ?? {}),
      specialtyFireLedger: ledger,
    },
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return ledger;
}

export function summarizePayload(payload = {}) {
  try {
    const keys = Object.keys(payload || {}).slice(0, 8);
    if (!keys.length) return null;
    const pick = {};
    for (const k of keys) {
      const v = payload[k];
      if (v == null) continue;
      pick[k] = typeof v === "object" ? "[object]" : String(v).slice(0, 80);
    }
    return JSON.stringify(pick);
  } catch {
    return null;
  }
}
