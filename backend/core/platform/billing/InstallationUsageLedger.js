/**
 * Durable usage ledger on installation.configuration.usageMeters.
 * Keeps Settings billing counts across process restarts without a new table.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function monthKey(nowISO = new Date().toISOString()) {
  return String(nowISO).slice(0, 7);
}

export function readUsageMetersFromInstallation(installation = null) {
  const raw = installation?.configuration?.usageMeters;
  return raw && typeof raw === "object" ? { ...raw } : {};
}

export function peekInstallationUsage({
  installation = null,
  meterId,
  nowISO = new Date().toISOString(),
} = {}) {
  const month = monthKey(nowISO);
  const ledger = readUsageMetersFromInstallation(installation);
  const used = Number(ledger?.[month]?.[meterId] ?? 0) || 0;
  return deepFreeze({ month, used });
}

/**
 * Increment a meter on an installation snapshot (pure). Persist via upsertBusinessOSInstallation.
 */
export function incrementInstallationUsage({
  installation,
  meterId,
  quantity = 1,
  nowISO = new Date().toISOString(),
} = {}) {
  if (!installation || !meterId) return null;
  const month = monthKey(nowISO);
  const qty = Math.max(0, Number(quantity) || 0);
  const prev = readUsageMetersFromInstallation(installation);
  const monthRow = { ...(prev[month] && typeof prev[month] === "object" ? prev[month] : {}) };
  const nextUsed = (Number(monthRow[meterId] ?? 0) || 0) + qty;
  monthRow[meterId] = nextUsed;
  const usageMeters = { ...prev, [month]: monthRow };
  return deepFreeze({
    installation: {
      ...installation,
      configuration: {
        ...(installation.configuration ?? {}),
        usageMeters,
      },
    },
    month,
    meterId,
    used: nextUsed,
  });
}

/**
 * Persist usage increment on the business installation.
 */
export async function recordUsageOnInstallation({
  platformStore,
  businessId,
  meterId,
  quantity = 1,
  nowISO = new Date().toISOString(),
  actorId = "usage_meter",
} = {}) {
  if (!platformStore?.getBusinessOSInstallation || !platformStore?.upsertBusinessOSInstallation) {
    return deepFreeze({ ok: false, reason: "store_unavailable" });
  }
  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!installation) return deepFreeze({ ok: false, reason: "installation_missing" });
  const bumped = incrementInstallationUsage({ installation, meterId, quantity, nowISO });
  if (!bumped) return deepFreeze({ ok: false, reason: "increment_failed" });
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${businessId}`,
    businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "usage_meter",
    planId: installation.planId ?? `plan_${businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: bumped.installation.configuration,
    history: Array.isArray(installation.history) ? installation.history.slice(-50) : [],
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return deepFreeze({ ok: true, month: bumped.month, meterId, used: bumped.used });
}

/**
 * Sync adapter for UsageMetering when an installation snapshot is already loaded.
 */
export function createInstallationUsageStore(installation) {
  return {
    getUsageMeter({ meterId, month }) {
      const ledger = readUsageMetersFromInstallation(installation);
      return { used: Number(ledger?.[month]?.[meterId] ?? 0) || 0 };
    },
    incrementUsageMeter({ meterId, month, quantity }) {
      const ledger = readUsageMetersFromInstallation(installation);
      const monthRow = { ...(ledger[month] && typeof ledger[month] === "object" ? ledger[month] : {}) };
      const used = (Number(monthRow[meterId] ?? 0) || 0) + Math.max(0, Number(quantity) || 0);
      monthRow[meterId] = used;
      // Mutate local snapshot so subsequent peeks in-process see the bump.
      if (!installation.configuration) installation.configuration = {};
      installation.configuration.usageMeters = { ...ledger, [month]: monthRow };
      return { used };
    },
  };
}
