import crypto from "node:crypto";

import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { stableStringify } from "../knowledge/intelligence/utils/stableStringify.js";

function fail(message) {
  throw new Error(`IndustryPackageInstallationRuntime: ${message}`);
}

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

export const INSTALLATION_STATUSES = {
  INSTALLED: "INSTALLED",
  FAILED: "FAILED",
};

export function computeInstallationFingerprint({ workspaceId, packageId, packageVersion, configuration } = {}) {
  return sha256(
    stableStringify({
      workspaceId: String(workspaceId ?? ""),
      packageId: String(packageId ?? ""),
      packageVersion: Number(packageVersion ?? 0),
      configuration: configuration ?? {},
    }),
  );
}

export function createIndustryPackageInstallationRecord({
  id,
  workspaceId,
  packageId,
  packageVersion,
  configurationFingerprint,
  installedAt,
  status,
  installedArtifacts,
  packageSnapshot,
  configuration,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!workspaceId || typeof workspaceId !== "string") fail("workspaceId required.");
  if (!packageId || typeof packageId !== "string") fail("packageId required.");

  return deepFreeze({
    id: String(id),
    workspaceId: String(workspaceId),
    packageId: String(packageId),
    packageVersion: Number(packageVersion ?? 1),
    configurationFingerprint: String(configurationFingerprint ?? ""),
    installedAt: String(installedAt ?? "2026-07-01T00:00:00.000Z"),
    status: String(status ?? INSTALLATION_STATUSES.INSTALLED),
    installedArtifacts: installedArtifacts && typeof installedArtifacts === "object" ? deepFreeze(installedArtifacts) : deepFreeze({}),
    packageSnapshot: packageSnapshot && typeof packageSnapshot === "object" ? packageSnapshot : null,
    configuration: configuration && typeof configuration === "object" ? deepFreeze(configuration) : deepFreeze({}),
  });
}

/**
 * In-memory installation facts owner.
 * Future persistence boundary: durable store keyed by workspaceId + packageId.
 */
export class IndustryPackageInstallationRuntime {
  constructor({ seed } = {}) {
    this._state = seed ? seed() : deepFreeze({ installations: deepFreeze([]) });
    this._state = deepFreeze(this._state);
  }

  getInstallations() {
    return this._state.installations;
  }

  getInstallationByFingerprint(fingerprint) {
    const fp = String(fingerprint ?? "");
    return this._state.installations.find((i) => String(i.configurationFingerprint) === fp) ?? null;
  }

  getInstallationsForWorkspace(workspaceId) {
    const wid = String(workspaceId ?? "");
    return this._state.installations.filter((i) => String(i.workspaceId) === wid);
  }

  getInstalledPackageIds(workspaceId) {
    return this.getInstallationsForWorkspace(workspaceId).map((i) => String(i.packageId));
  }

  recordInstallation(record) {
    const built = createIndustryPackageInstallationRecord(record);
    const existing = this.getInstallationByFingerprint(built.configurationFingerprint);
    if (existing) return existing;

    const installations = [...this._state.installations, built];
    this._state = deepFreeze({
      installations: deepFreeze(installations),
    });
    return built;
  }
}
