import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const PACKAGE_READINESS_STATUSES = {
  NOT_STARTED: "NOT_STARTED",
  CONFIGURING: "CONFIGURING",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY: "READY",
};

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Composes existing canonical signals into a deterministic package readiness report.
 */
export function buildIndustryPackageReadinessReport({
  installationResult,
  capabilityRuntime,
  automationRuntime,
  companyRuntime,
  knowledgeReadinessReport,
  connectedSystemsSnapshot,
} = {}) {
  const installed = installationResult ?? null;
  const artifacts = installed?.installedArtifacts ?? {};
  const capabilityIds = safeArray(artifacts.capabilityIds);
  const automationIds = safeArray(artifacts.automationIds);
  const categoryIds = safeArray(artifacts.categoryIds);

  const activeCapabilities = capabilityRuntime?.getCapabilities?.() ?? [];
  const installedCapabilities = activeCapabilities.filter((c) => capabilityIds.includes(String(c.id)));

  const automations = automationRuntime?.getAutomations?.() ?? [];
  const installedAutomations = automations.filter((a) => automationIds.includes(String(a.id)));

  const knowledgeCategories = companyRuntime?.getKnowledgeCategories?.()?.items ?? [];
  const installedCategories = knowledgeCategories.filter((c) => categoryIds.includes(String(c.id)));

  const knowledgeGaps = safeArray(knowledgeReadinessReport?.gaps ?? knowledgeReadinessReport?.missingAreas);
  const connectedMissing = safeArray(connectedSystemsSnapshot?.missingRequired ?? connectedSystemsSnapshot?.missing);

  const requiredKnowledge = safeArray(installed?.knowledgeRequirements);
  const missingKnowledgeRequirements = requiredKnowledge.filter((req) => {
    const reqId = String(req?.categoryId ?? req?.id ?? "");
    const hasActive = knowledgeCategories.some(
      (c) => String(c.id) === reqId && String(c.status) === "ACTIVE" && Number(c.activeKnowledgeCount ?? 0) > 0,
    );
    return reqId && !hasActive;
  });

  const missingConnections = safeArray(installed?.connectedSystemRequirements).filter(
    (r) => String(r.requirementLevel) === "required" && !safeArray(connectedSystemsSnapshot?.connected).includes(String(r.id)),
  );

  let readinessStatus = PACKAGE_READINESS_STATUSES.NOT_STARTED;
  if (installed) readinessStatus = PACKAGE_READINESS_STATUSES.CONFIGURING;
  if (installed && installedCapabilities.length > 0 && installedAutomations.length > 0) {
    readinessStatus = PACKAGE_READINESS_STATUSES.PARTIALLY_READY;
  }
  if (
    installed &&
    missingKnowledgeRequirements.length === 0 &&
    missingConnections.length === 0 &&
    knowledgeGaps.length === 0
  ) {
    readinessStatus = PACKAGE_READINESS_STATUSES.READY;
  }

  return deepFreeze({
    packageId: String(installed?.packageId ?? ""),
    packageVersion: Number(installed?.packageVersion ?? 0),
    workspaceId: String(installed?.workspaceId ?? ""),
    readinessStatus,
    installed: Boolean(installed),
    summary: deepFreeze({
      capabilitiesInstalled: installedCapabilities.length,
      automationsActive: installedAutomations.filter((a) => String(a.status) === "ACTIVE").length,
      knowledgeCategoriesInstalled: installedCategories.length,
      employeesAvailable: safeArray(installed?.employeeDefinitions).length,
      communicationIntents: safeArray(installed?.communicationIntents).length,
    }),
    missing: deepFreeze({
      knowledgeRequirements: deepFreeze(missingKnowledgeRequirements),
      knowledgeGaps: deepFreeze(knowledgeGaps),
      connectedSystems: deepFreeze(missingConnections.length ? missingConnections : connectedMissing),
      approvalConfiguration: safeArray(installed?.approvalPolicies).filter((p) => !p.configured),
    }),
    installedArtifacts: artifacts,
    terminology: installed?.terminology ?? deepFreeze({}),
    requestTypes: installed?.requestTypes ?? deepFreeze([]),
    workTypes: installed?.workTypes ?? deepFreeze([]),
    interactionOutcomes: installed?.interactionOutcomes ?? deepFreeze([]),
    generatedAt: "2026-07-01T00:00:00.000Z",
  });
}
