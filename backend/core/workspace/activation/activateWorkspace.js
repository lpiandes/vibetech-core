import { buildPropertyManagementWorkspaceStack } from "../../integration/PropertyManagementScenarioHarness.js";
import { configureHorizonPropertiesWorkspace } from "../../integration/HorizonPropertiesWorkspaceConfigurator.js";
import { bootstrapHorizonPropertiesDemo } from "../../integration/HorizonPropertiesDemoBootstrap.js";
import { buildHorizonPropertiesDemoConfiguration } from "../../../../industries/property-management/demo/HorizonPropertiesDemoConfig.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { getDefaultIndustryPackageRegistry } from "../../industries/IndustryPackageRegistry.js";
import { installPackageEmployees } from "../../industries/install/installPackageEmployees.js";
import { buildIndustryPackageReadinessReport } from "../../industries/IndustryPackageReadinessReport.js";
import { buildConnectedSystemsSnapshot } from "../../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildDigitalEmployeeReadinessReport } from "../../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildPackagePageLabels } from "../../industries/terminology/TerminologyResolver.js";
import { KnowledgeReadinessEngine } from "../../knowledge/readiness/KnowledgeReadinessEngine.js";
import { createIntegrationPlatform } from "../../integrations/createIntegrationPlatform.js";
import { buildConnectionDependencyProjection } from "../../integrations/dependencies/ConnectionDependencyProjection.js";
import { createOperationalBoundary } from "../../approvals/OwnerApprovalDecisionService.js";

import { resolveWorkspaceActivation } from "./WorkspaceActivation.js";
import { workspaceActivationRegistry } from "./WorkspaceActivationRegistry.js";
import { createWorkspaceIdentityViewModel } from "../views/WorkspaceIdentityViewAdapter.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { buildEmptyCompanySeed } from "../../company/buildEmptyCompanySeed.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { TeamRuntime } from "../../team/TeamRuntime.js";
import { buildEmptyTeamSeed } from "../../team/TeamBuilder.js";
import { CapabilityRuntime } from "../../capabilities/runtime/CapabilityRuntime.js";
import { AnalyticsRuntime } from "../../analytics/AnalyticsRuntime.js";
import { CommunicationRuntime } from "../../communications/CommunicationRuntime.js";
import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { InteractionRuntime } from "../../interactions/InteractionRuntime.js";
import { BusinessSubjectRuntime } from "../../business-subject/BusinessSubjectRuntime.js";
import { CommunicationPreferenceRuntime } from "../../communications/preferences/CommunicationPreferenceRuntime.js";
import { SegmentDefinitionRuntime } from "../../segments/SegmentDefinitionRuntime.js";
import { AutomationRuntime } from "../../automations/AutomationRuntime.js";
import { ApprovalRuntime } from "../../approvals/ApprovalRuntime.js";
import { PlatformEventStore } from "../../events/PlatformEventStore.js";
import { IntelligenceCandidateRuntime } from "../../business-intelligence/candidates/IntelligenceCandidateRuntime.js";

export const PROPERTY_MANAGEMENT_PACKAGE_ID = "pkg_property_management";
export const HORIZON_PROPERTIES_DEMO_ID = "horizon_properties";

export function resolveDefaultActivationForWorkspace(_workspaceId) {
  return null;
}

function buildGenericWorkspaceStack({ nowISO, workspaceId, activation }) {
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const companyName = String(activation?.packageConfiguration?.companyName ?? "New Business");
  return {
    nowISO: effectiveNowISO,
    workspaceId: String(workspaceId ?? "demo"),
    companyRuntime: new CompanyWorkspaceRuntime({
      seed: () =>
        buildEmptyCompanySeed({
          companyName,
          industry: String(activation?.packageConfiguration?.industry ?? "General"),
          nowISO: effectiveNowISO,
        }),
    }),
    requestRuntime: new RequestRuntime({ nowISO: effectiveNowISO }),
    workRuntime: new WorkRuntime({ nowISO: effectiveNowISO }),
    teamRuntime: new TeamRuntime({ seed: buildEmptyTeamSeed }),
    capabilityRuntime: new CapabilityRuntime({ seed: null }),
    analyticsRuntime: new AnalyticsRuntime({ seed: null, nowISO: effectiveNowISO }),
    communicationRuntime: new CommunicationRuntime({ nowISO: effectiveNowISO }),
    businessGraphRuntime: new BusinessGraphRuntime(),
    businessSubjectRuntime: new BusinessSubjectRuntime(),
    communicationPreferenceRuntime: new CommunicationPreferenceRuntime(),
    segmentDefinitionRuntime: new SegmentDefinitionRuntime(),
    interactionRuntime: new InteractionRuntime(),
    intelligenceCandidateRuntime: new IntelligenceCandidateRuntime(),
    automationRuntime: new AutomationRuntime({ nowISO: effectiveNowISO }),
    approvalRuntime: new ApprovalRuntime({ nowISO: effectiveNowISO }),
    platformEventStore: new PlatformEventStore({ nowISO: effectiveNowISO }),
    installationResult: null,
    installationRuntime: null,
  };
}

function activateIndustryWorkspace({ workspaceId, activation, nowISO, runtimeSnapshots = {} }) {
  const packageRegistry = getDefaultIndustryPackageRegistry();
  const industryPackage = packageRegistry.getPackage(activation.industryPackageId);
  if (!industryPackage) {
    throw new Error(`activateWorkspace: unknown industry package: ${activation.industryPackageId}`);
  }

  const isHorizonDemo = activation.demoConfigurationId === HORIZON_PROPERTIES_DEMO_ID;

  const demoConfiguration = isHorizonDemo
    ? { ...buildHorizonPropertiesDemoConfiguration(), ...(activation.packageConfiguration ?? {}) }
    : {
        ...buildEmptyPropertyManagementConfiguration({
          companyName: activation.packageConfiguration?.companyName ?? "New Business",
          workspaceId,
        }),
        ...(activation.packageConfiguration ?? {}),
      };

  const stack = buildPropertyManagementWorkspaceStack({
    nowISO,
    workspaceId,
    installPackage: true,
    demoConfiguration,
    runtimeSnapshots,
  });

  const employeeInstall = installPackageEmployees({
    employeeDefinitions: industryPackage.employeeDefinitions,
    humanTeamMembers: demoConfiguration.humanTeamMembers ?? [],
    teamRuntime: stack.teamRuntime,
    nowISO,
  });

  let demoConfigurationResult = null;
  let demoBootstrap = null;
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");

  if (isHorizonDemo) {
    demoConfigurationResult = configureHorizonPropertiesWorkspace({ stack, nowISO: effectiveNowISO });
  }

  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    connectionRuntimeSeed: runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.CONNECTION] ?? null,
    nowISO: effectiveNowISO,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });

  if (isHorizonDemo) {
    demoBootstrap = bootstrapHorizonPropertiesDemo({
      stack,
      integrationPlatform,
      workspaceId,
      nowISO: effectiveNowISO,
    });
  }

  const connectedSystemsSnapshot = buildConnectedSystemsSnapshot({
    installationResult: stack.installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
  });

  const connectionDependencyProjection = buildConnectionDependencyProjection({
    installationResult: stack.installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
    employeeDefinitions: industryPackage.employeeDefinitions,
    automationConfigurations: industryPackage.automationConfigurations,
  });

  const knowledgeReadinessReport = new KnowledgeReadinessEngine({ nowISO: effectiveNowISO }).generate({
    companyId: String(demoConfiguration.companyName ?? workspaceId),
    generatedAt: effectiveNowISO,
    knowledgeRepository: stack.companyRuntime.getKnowledgeRepository?.(),
    knowledgeCategories: stack.companyRuntime.getKnowledgeCategories?.(),
    moduleEnabled: true,
  });

  const readinessReport = buildIndustryPackageReadinessReport({
    installationResult: stack.installationResult,
    capabilityRuntime: stack.capabilityRuntime,
    automationRuntime: stack.automationRuntime,
    companyRuntime: stack.companyRuntime,
    knowledgeReadinessReport,
    connectedSystemsSnapshot,
  });

  const employeeReadinessReport = buildDigitalEmployeeReadinessReport({
    employeeDefinitions: industryPackage.employeeDefinitions,
    capabilityRuntime: stack.capabilityRuntime,
    companyRuntime: stack.companyRuntime,
    connectedSystemsSnapshot,
    connectionRuntime: integrationPlatform.connectionRuntime,
    teamRuntime: stack.teamRuntime,
  });

  const pageLabels = buildPackagePageLabels({
    installationResult: stack.installationResult,
    industryPackage,
  });

  const identityViewModel = createWorkspaceIdentityViewModel({
    activation,
    installationResult: stack.installationResult,
    readinessReport,
    packageDisplayName: industryPackage.displayName ?? industryPackage.name,
    businessName: demoConfiguration.companyName ?? industryPackage.displayName,
    pageLabels,
  });

  const ctx = {
    nowISO: stack.nowISO,
    companyRuntime: stack.companyRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    teamRuntime: stack.teamRuntime,
    capabilityRuntime: stack.capabilityRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    intelligenceCandidateRuntime: stack.intelligenceCandidateRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    platformEventStore: stack.store,
    analyticsRuntime: stack.analyticsRuntime,
    connectionRuntime: integrationPlatform.connectionRuntime,
  };

  return {
    ctx,
    activation,
    installationResult: stack.installationResult,
    readinessReport,
    employeeReadinessReport,
    employeeActivations: employeeInstall,
    connectedSystemsSnapshot,
    connectionDependencyProjection,
    integrationPlatform,
    pageLabels,
    identityViewModel,
    demoConfigurationResult,
    demoBootstrap,
    knowledgeReadinessReport,
    operationalBoundary: createOperationalBoundary(stack, { nowISO: effectiveNowISO }),
    operatingStack: stack,
  };
}

function activateGenericWorkspace({ workspaceId, activation, nowISO }) {
  const stack = buildGenericWorkspaceStack({ nowISO, workspaceId, activation });
  const identityViewModel = createWorkspaceIdentityViewModel({
    activation,
    installationResult: null,
    readinessReport: null,
    packageDisplayName: "Generic",
    businessName: "Workspace",
    pageLabels: {},
  });

  return {
    ctx: {
      nowISO: stack.nowISO,
      companyRuntime: stack.companyRuntime,
      businessGraphRuntime: stack.businessGraphRuntime,
      businessSubjectRuntime: stack.businessSubjectRuntime,
      communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
      segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
      requestRuntime: stack.requestRuntime,
      workRuntime: stack.workRuntime,
      teamRuntime: stack.teamRuntime,
      capabilityRuntime: stack.capabilityRuntime,
      communicationRuntime: stack.communicationRuntime,
      interactionRuntime: stack.interactionRuntime,
      intelligenceCandidateRuntime: stack.intelligenceCandidateRuntime,
      automationRuntime: stack.automationRuntime,
      approvalRuntime: stack.approvalRuntime,
      platformEventStore: stack.platformEventStore,
      analyticsRuntime: stack.analyticsRuntime,
    },
    activation,
    installationResult: null,
    readinessReport: null,
    employeeReadinessReport: null,
    employeeActivations: null,
    connectedSystemsSnapshot: buildConnectedSystemsSnapshot({ installationResult: null }),
    pageLabels: {},
    identityViewModel,
    demoConfigurationResult: null,
    demoBootstrap: null,
    knowledgeReadinessReport: null,
    integrationPlatform: null,
    connectionDependencyProjection: null,
    operationalBoundary: null,
    operatingStack: stack,
  };
}

/**
 * Explicit workspace activation boundary.
 * Future persistence: replace registry with durable activation store keyed by workspaceId.
 */
/**
 * @param {{
 *   workspaceId?: string,
 *   activation?: object,
 *   nowISO?: string,
 *   runtimeSnapshots?: Record<string, unknown>,
 * }} [params]
 */
export function activateWorkspace({ workspaceId, activation, nowISO, runtimeSnapshots = {} } = {}) {
  const wid = String(workspaceId ?? "demo");
  const mergedActivation = activation ?? {};
  const resolvedActivation = workspaceActivationRegistry.ensure(wid, mergedActivation);
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");

  if (resolvedActivation.industryPackageId) {
    return activateIndustryWorkspace({
      workspaceId: wid,
      activation: resolveWorkspaceActivation({ workspaceId: wid, activation: resolvedActivation }),
      nowISO: effectiveNowISO,
      runtimeSnapshots,
    });
  }

  return activateGenericWorkspace({
    workspaceId: wid,
    activation: resolveWorkspaceActivation({ workspaceId: wid, activation: resolvedActivation }),
    nowISO: effectiveNowISO,
  });
}
