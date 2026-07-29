/**
 * Package gate + soft-cap helpers for AI Prospecting.
 */
import {
  businessHasAiProspecting,
  readPurchasedPackagesFromConfig,
  resolvePackageSoftCaps,
} from "../platform/packages/SalesPackageCatalog.js";
import { countRunsOnDay, readProspectingState } from "./ProspectingJobStore.js";

export function assertAiProspectingPurchased(installation) {
  const packages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
  if (!businessHasAiProspecting(packages)) {
    const err = new Error("AI Prospecting package is not purchased for this workspace.");
    err.status = 403;
    err.code = "PACKAGE_REQUIRED";
    throw err;
  }
  return packages;
}

export function resolveProspectingCaps(installation) {
  const packages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
  const caps = resolvePackageSoftCaps(packages);
  // When full-OS / uncapped soft caps, still apply sensible defaults for cost control
  // unless the package itself set limits (thin SKU path).
  const hasProspecting = businessHasAiProspecting(packages);
  return {
    maxRunsPerDay: Number.isFinite(caps.maxProspectingRunsPerDay)
      ? caps.maxProspectingRunsPerDay
      : (hasProspecting ? 20 : 0),
    maxLeadsPerRun: Number.isFinite(caps.maxProspectingLeadsPerRun)
      ? caps.maxProspectingLeadsPerRun
      : (hasProspecting ? 25 : 0),
  };
}

export function assertProspectingQuota(installation) {
  const caps = resolveProspectingCaps(installation);
  const state = readProspectingState(installation);
  const used = countRunsOnDay(state);
  if (used >= caps.maxRunsPerDay) {
    const err = new Error(
      `Daily prospecting run limit reached (${caps.maxRunsPerDay}/day). Try again tomorrow.`,
    );
    err.status = 429;
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }
  return { caps, used };
}
