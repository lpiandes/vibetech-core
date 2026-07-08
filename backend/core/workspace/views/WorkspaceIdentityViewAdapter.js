import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { ACTIVATION_STATUSES, WORKSPACE_MODES } from "../activation/WorkspaceActivation.js";

export function createWorkspaceIdentityViewModel({
  activation,
  installationResult,
  readinessReport,
  packageDisplayName,
  businessName,
  pageLabels,
} = {}) {
  const act = activation ?? {};
  const installed = installationResult ?? null;

  return deepFreeze({
    workspaceId: String(act.workspaceId ?? ""),
    companyId: act.companyId ?? null,
    businessName: String(businessName ?? act.packageConfiguration?.companyName ?? "Workspace"),
    industryPackageId: act.industryPackageId ?? null,
    industryDisplayName: String(packageDisplayName ?? installed?.packageId ?? "Generic"),
    packageVersion: Number(act.industryPackageVersion ?? installed?.packageVersion ?? 0),
    workspaceMode: String(act.workspaceMode ?? WORKSPACE_MODES.GENERIC),
    installationStatus: installed ? "INSTALLED" : "NOT_INSTALLED",
    activationStatus: String(act.activationStatus ?? ACTIVATION_STATUSES.NOT_ACTIVATED),
    activatedAt: act.activatedAt ?? null,
    readinessStatus: String(readinessReport?.readinessStatus ?? "NOT_STARTED"),
    demoConfigurationId: act.demoConfigurationId ?? null,
    pageLabels: pageLabels ?? deepFreeze({}),
    operatingSystemTitle: String(pageLabels?.operatingSystemTitle ?? "Business Operating System"),
  });
}
