/**
 * Persist Custom Build Factory progress on installation.configuration.customBuild.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  advanceCustomBuild,
  createCustomBuildRecord,
  presentCustomBuild,
} from "./CustomBuildFactory.js";

export function readCustomBuild(installation = null) {
  const raw = installation?.configuration?.customBuild;
  if (!raw || typeof raw !== "object") return null;
  return deepFreeze({ ...raw });
}

export function presentCustomBuildFromInstallation(installation = null) {
  const record = readCustomBuild(installation);
  return record ? presentCustomBuild(record) : null;
}

export function startCustomBuildOnInstallation(installation, input = {}) {
  const businessId = String(installation?.businessId ?? input.businessId ?? "").trim();
  const existing = readCustomBuild(installation);
  if (existing && !input.force) {
    return deepFreeze({
      installation,
      record: existing,
      view: presentCustomBuild(existing),
      created: false,
    });
  }
  const record = createCustomBuildRecord({
    businessId,
    sheetLine: input.sheetLine,
    offerId: input.offerId,
    packageIds: input.packageIds,
    brief: input.brief,
  });
  const nextInstallation = patchCustomBuild(installation, record);
  return deepFreeze({
    installation: nextInstallation,
    record,
    view: presentCustomBuild(record),
    created: true,
  });
}

export function advanceCustomBuildOnInstallation(installation, stepId, meta = {}) {
  const current = readCustomBuild(installation);
  if (!current) throw new Error("custom_build_not_started");
  const record = advanceCustomBuild(current, stepId, meta);
  const nextInstallation = patchCustomBuild(installation, record);
  return deepFreeze({
    installation: nextInstallation,
    record,
    view: presentCustomBuild(record),
  });
}

export async function persistCustomBuild({
  platformStore,
  installation,
  record,
  actorId = "custom_build",
} = {}) {
  if (!platformStore || !installation || !record) return null;
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "custom_build",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      customBuild: plain(record),
    },
    history: Array.isArray(installation.history) ? installation.history.slice(-50) : [],
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return record;
}

function patchCustomBuild(installation, record) {
  return {
    ...installation,
    configuration: {
      ...(installation?.configuration ?? {}),
      customBuild: plain(record),
    },
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}
