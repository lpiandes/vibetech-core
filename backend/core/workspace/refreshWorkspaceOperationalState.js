import { getDefaultIndustryPackageRegistry } from "../industries/IndustryPackageRegistry.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildDigitalEmployeeReadinessReport } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectionDependencyProjection } from "../integrations/dependencies/ConnectionDependencyProjection.js";
import { buildPmProspectCoordinatorPlatformCoverage } from "../platform/knowledge/PlatformKnowledgeReadinessBridge.js";
import { resolveEmployeeDefinitionsForReadiness } from "../workforce/normalizeBosEmployeesForReadiness.js";

/**
 * Recompute integration + employee readiness using durable platform knowledge counts.
 * @param {{
 *   ctx: object,
 *   installationResult: object,
 *   integrationPlatform: object,
 *   activation?: object | null,
 *   platformActiveKnowledgeCount?: number,
 *   bosEmployeeDefinitions?: object[],
 * }} params
 */
export function refreshWorkspaceOperationalState({
  ctx,
  installationResult,
  integrationPlatform,
  activation,
  platformActiveKnowledgeCount = 0,
  bosEmployeeDefinitions = null,
} = {}) {
  if (!ctx || !installationResult || !integrationPlatform) {
    return {};
  }

  const industryPackage =
    (activation?.industryPackageId
      ? getDefaultIndustryPackageRegistry().getPackage(activation.industryPackageId)
      : null)
    ?? null;

  // Prefer installed Business OS employees (incl. owner-added), then package, then activation install.
  const employeeDefinitions = resolveEmployeeDefinitionsForReadiness({
    bosEmployees: bosEmployeeDefinitions
      ?? installationResult?.configuration?.employees
      ?? installationResult?.employeeDefinitions
      ?? [],
    packageEmployees: industryPackage?.employeeDefinitions ?? [],
    installationEmployees: installationResult?.employeeDefinitions ?? [],
  });

  const platformKnowledgeCoverage = buildPmProspectCoordinatorPlatformCoverage(platformActiveKnowledgeCount);

  const connectedSystemsSnapshot = buildConnectedSystemsSnapshot({
    installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
  });

  const connectionDependencyProjection = buildConnectionDependencyProjection({
    installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
    employeeDefinitions,
    automationConfigurations: industryPackage?.automationConfigurations,
  });

  const employeeReadinessReport = buildDigitalEmployeeReadinessReport({
    employeeDefinitions,
    capabilityRuntime: ctx.capabilityRuntime,
    companyRuntime: ctx.companyRuntime,
    connectedSystemsSnapshot,
    connectionRuntime: integrationPlatform.connectionRuntime,
    teamRuntime: ctx.teamRuntime,
    platformKnowledgeCoverage,
  });

  return {
    connectedSystemsSnapshot,
    connectionDependencyProjection,
    employeeReadinessReport,
    platformKnowledgeCoverage,
  };
}
