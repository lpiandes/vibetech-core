import { deepFreeze } from "../_utils/deepFreeze.js";

export const WORKSPACE_MODES = {
  GENERIC: "GENERIC",
  INDUSTRY_ACTIVATED: "INDUSTRY_ACTIVATED",
};

export const ACTIVATION_STATUSES = {
  NOT_ACTIVATED: "NOT_ACTIVATED",
  ACTIVATED: "ACTIVATED",
};

function fail(message) {
  throw new Error(`WorkspaceActivation: ${message}`);
}

export function createWorkspaceActivation({
  workspaceId,
  companyId,
  industryPackageId,
  industryPackageVersion,
  packageConfiguration,
  demoConfigurationId,
  workspaceMode,
  activationStatus,
  activatedAt,
} = {}) {
  if (!workspaceId || typeof workspaceId !== "string") fail("workspaceId required.");

  return deepFreeze({
    workspaceId: String(workspaceId),
    companyId: companyId === undefined || companyId === null ? null : String(companyId),
    industryPackageId: industryPackageId === undefined || industryPackageId === null ? null : String(industryPackageId),
    industryPackageVersion:
      industryPackageVersion === undefined || industryPackageVersion === null ? null : Number(industryPackageVersion),
    packageConfiguration:
      packageConfiguration && typeof packageConfiguration === "object"
        ? deepFreeze(packageConfiguration)
        : deepFreeze({}),
    demoConfigurationId:
      demoConfigurationId === undefined || demoConfigurationId === null ? null : String(demoConfigurationId),
    workspaceMode: String(workspaceMode ?? WORKSPACE_MODES.GENERIC),
    activationStatus: String(activationStatus ?? ACTIVATION_STATUSES.NOT_ACTIVATED),
    activatedAt: activatedAt === undefined || activatedAt === null ? null : String(activatedAt),
  });
}

export function resolveWorkspaceActivation({ workspaceId, activation } = {}) {
  const wid = String(workspaceId ?? "demo");
  const input = activation && typeof activation === "object" ? activation : {};

  const industryPackageId = input.industryPackageId ?? null;
  const hasPackage = Boolean(industryPackageId);

  return createWorkspaceActivation({
    workspaceId: wid,
    companyId: input.companyId ?? null,
    industryPackageId,
    industryPackageVersion: input.industryPackageVersion ?? (hasPackage ? 1 : null),
    packageConfiguration: input.packageConfiguration ?? {},
    demoConfigurationId: input.demoConfigurationId ?? null,
    workspaceMode: hasPackage ? WORKSPACE_MODES.INDUSTRY_ACTIVATED : WORKSPACE_MODES.GENERIC,
    activationStatus: hasPackage ? ACTIVATION_STATUSES.ACTIVATED : ACTIVATION_STATUSES.NOT_ACTIVATED,
    activatedAt: hasPackage ? String(input.activatedAt ?? "2026-07-01T00:00:00.000Z") : null,
  });
}
