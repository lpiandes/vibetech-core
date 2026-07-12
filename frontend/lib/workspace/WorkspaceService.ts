import { CompanyWorkspaceRuntime } from "../../../backend/core/company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "../../../backend/core/workspace/WorkspaceGenerator.js";
import { WorkspaceViewAdapter } from "../../../backend/core/workspace/views/WorkspaceViewAdapter.js";
import { MockWorkspaceApi } from "./MockWorkspaceApi";

import { ConnectedBusinessWorkspace } from "./ConnectedBusinessWorkspace";
import { buildKnowledgeExecutiveContext } from "../../components/knowledge/knowledgeSemantics";

import { CompanyBriefEngine } from "../../../backend/core/business-intelligence/company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../../../backend/core/business-intelligence/company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../../../backend/core/business-intelligence/insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "../../../backend/core/business-intelligence/opportunities/CompanyOpportunityEngine.js";
import { CompanyRecommendationEngine } from "../../../backend/core/business-intelligence/recommendations/CompanyRecommendationEngine.js";
import { BusinessIntelligenceLayer } from "../../../backend/core/business-intelligence/layer/BusinessIntelligenceLayer.js";
import { adaptBusinessIntelligenceWorkspace } from "../../../backend/core/business-intelligence/layer/views/BusinessIntelligenceViewAdapter.js";
import { MissionControlGenerator } from "../../../backend/core/mission-control/MissionControlGenerator.js";
import { MissionControlViewAdapter } from "../../../backend/core/mission-control/views/MissionControlViewAdapter.js";
import { composeMissionControlExperience } from "../../../backend/core/mission-control/composeMissionControlExperience.js";
import { composeBusinessCommandCenter } from "../../../backend/core/command-center/BusinessCommandCenterComposer.js";
import { adaptBusinessCommandCenterView } from "../../../backend/core/command-center/views/BusinessCommandCenterViewAdapter.js";
import { buildPackageNavigation } from "../../../backend/core/workspace/navigation/PackageNavigationBuilder.js";
import { getDefaultIndustryPackageRegistry } from "../../../backend/core/industries/IndustryPackageRegistry.js";

import { TeamRuntime } from "../../../backend/core/team/TeamRuntime.js";
import { TeamViewAdapter } from "../../../backend/core/team/views/TeamViewAdapter.js";
import { presentDigitalWorkforce } from "../../../backend/core/command-center/DigitalWorkforcePresentation.js";

import { RequestRuntime } from "../../../backend/core/request/RequestRuntime.js";
import { RequestViewAdapter } from "../../../backend/core/request/views/RequestViewAdapter.js";

import { WorkRuntime } from "../../../backend/core/work/WorkRuntime.js";
import { WorkViewAdapter } from "../../../backend/core/work/views/WorkViewAdapter.js";

import { CapabilityRuntime } from "../../../backend/core/capabilities/runtime/CapabilityRuntime.js";
import { CapabilityIntelligenceEngine } from "../../../backend/core/capabilities/intelligence/CapabilityIntelligenceEngine.js";
import { CapabilityViewAdapter } from "../../../backend/core/capabilities/views/CapabilityViewAdapter.js";

import { CommunicationRuntime } from "../../../backend/core/communications/CommunicationRuntime.js";
import { CommunicationViewAdapter } from "../../../backend/core/communications/views/CommunicationViewAdapter.js";

import { AnalyticsRuntime } from "../../../backend/core/analytics/AnalyticsRuntime.js";
import { AnalyticsIntelligenceEngine } from "../../../backend/core/analytics/intelligence/AnalyticsIntelligenceEngine.js";
import { AnalyticsViewAdapter } from "../../../backend/core/analytics/views/AnalyticsViewAdapter.js";

import { SetupViewAdapter } from "../../../backend/core/workspace/views/SetupViewAdapter.js";
import { ConnectionCenterViewAdapter } from "../../../backend/core/workspace/views/ConnectionCenterViewAdapter.js";
import { AutomationCenterViewAdapter } from "../../../backend/core/workspace/views/AutomationCenterViewAdapter.js";

import { workspaceCompositionRegistry } from "./WorkspaceCompositionRegistry.js";
import { EngagementViewAdapter } from "../../../backend/core/engagement/EngagementViewAdapter.js";
import { buildEngagementPartyIndex } from "../../../backend/core/engagement/EngagementPartyIndexBuilder.js";
import { buildRelationshipFollowUpProjection } from "../../../backend/core/relationship-followup/RelationshipFollowUpProjection.js";
import { RelationshipFollowUpWorkConversionService } from "../../../backend/core/relationship-followup/RelationshipFollowUpWorkConversionService.js";
import { RelationshipFollowUpResolutionService } from "../../../backend/core/relationship-followup/RelationshipFollowUpResolutionService.js";
import { RelationshipFollowUpDraftAssistanceService } from "../../../backend/core/work-assistance/RelationshipFollowUpDraftAssistanceService.js";
import { buildRelationshipOperationsIntelligence } from "../../../backend/core/relationship-operations/RelationshipOperationsIntelligenceProjection.js";
import { buildCampaignOperationsView } from "../../../backend/core/campaigns/CampaignOperationsProjection.js";
import { CampaignPreparationService } from "../../../backend/core/campaigns/CampaignPreparationService.js";
import { CampaignDocumentService, buildExpectedApprovalBinding } from "../../../backend/core/campaigns/CampaignDocumentService.js";
import { CampaignDeliveryService } from "../../../backend/core/campaigns/CampaignDeliveryService.js";
import { businessCampaignTemplateService } from "@/lib/server/compose";
import { businessKnowledgeService } from "@/lib/server/compose";
import { buildMcBrideReadinessProjection } from "../../../backend/core/campaigns/McBrideReadinessProjection.js";
import { recordReferralIntroduction, buildReferralOperationsSummary } from "../../../backend/core/campaigns/ReferralLoopService.js";
import { PM_CAMPAIGN_SECTION_TYPES } from "../../../industries/property-management/config/campaignSectionCatalog.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "../../../industries/property-management/config/mcbrideClientTemplate.js";
import { materializeDueRecurringOperations } from "../../../backend/core/campaigns/RecurringOperationService.js";
import { platformStore } from "@/lib/server/compose";
import { buildDemoStorySteps } from "../../../backend/core/demo/buildDemoStorySteps.js";
import { projectSegmentMembership } from "../../../backend/core/segments/SegmentProjectionEngine.js";
import { checkCommunicationPermitted } from "../../../backend/core/communications/preferences/CommunicationPreferenceEnforcer.js";
import { searchWorkspace as projectWorkspaceSearch } from "../../../backend/core/workspace/search/WorkspaceSearchProjection.js";
import { refreshWorkspaceOperationalState as recomputeWorkspaceOperationalState } from "../../../backend/core/workspace/refreshWorkspaceOperationalState.js";
import { connectBusinessEmailDev } from "../../../backend/core/integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../../../backend/core/integration/ProspectInquiryOperatingLoopService.js";
import {
  runMaintenanceRequestOperatingLoop,
  PM_MAINTENANCE_COORDINATOR_ID,
} from "../../../backend/core/integration/MaintenanceRequestOperatingLoopService.js";
import { runShowingCoordinationOperatingLoop } from "../../../backend/core/integration/ShowingCoordinationOperatingLoopService.js";
import { buildCommunicationThreadDetail } from "../../../backend/core/communications/views/buildCommunicationThreadDetail.js";
import { RecordBusinessSubjectService } from "../../../backend/core/business-subject/RecordBusinessSubjectService.js";
import { reconcileHistoricalSubjectInterests } from "../../../backend/core/business-subject/SubjectInterestReconciliationService.js";
import { buildBusinessSubjectIndex } from "../../../backend/core/business-subject/views/buildBusinessSubjectIndex.js";
import { buildSubjectAudiencePreview } from "../../../backend/core/segments/views/buildSubjectAudiencePreview.js";
import { buildBusinessOperatingHomeView } from "../../../backend/core/command-center/buildBusinessOperatingHomeView.js";
import { buildExecutiveWorkspaceHomeView } from "../../../backend/core/command-center/buildExecutiveWorkspaceHomeView.js";
import { buildBusinessSubjectPortfolioIndex } from "../../../backend/core/business-subject/views/buildBusinessSubjectPortfolioIndex.js";
import { buildSubjectOperatingDetail } from "../../../backend/core/business-subject/views/buildSubjectOperatingDetail.js";
import { persistAffectedRuntimes } from "../../../backend/core/persistence/PersistedMutationCoordinator.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "../../../backend/core/persistence/RuntimeSnapshotKinds.js";
import { BusinessIntelligenceEvaluationService } from "../../../backend/core/business-intelligence/evaluation/BusinessIntelligenceEvaluationService.js";
import { projectIntelligenceCandidates } from "../../../backend/core/business-intelligence/candidates/IntelligenceCandidateProjection.js";
import { IntelligenceCandidateLifecycle } from "../../../backend/core/business-intelligence/candidates/IntelligenceCandidateLifecycle.js";
import { IntelligenceToWorkConversionService } from "../../../backend/core/business-intelligence/conversion/IntelligenceToWorkConversionService.js";
import { IntelligenceToArchitectChangeService } from "../../../backend/core/business-intelligence/conversion/IntelligenceToArchitectChangeService.js";
import { buildBusinessMemoryTimeline } from "../../../backend/core/business-intelligence/memory/BusinessMemoryTimeline.js";
import { getDefaultBusinessIntelligenceDefinitionRegistry } from "../../../backend/core/business-intelligence/definitions/BusinessIntelligenceDefinitionRegistry.js";
import { registerPropertyManagementIntelligenceDefinitions } from "../../../industries/property-management/config/propertyManagementIntelligenceDefinitions.js";
import { ContinuousBusinessBuilderService } from "../../../backend/core/ai-builder/ContinuousBusinessBuilderService.js";
import {
  getDigitalEmployeeReadinessEntry,
  isDigitalEmployeeOperationalReady,
} from "../../../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

export const PM_RESIDENT_PROSPECT_COORDINATOR_ID = "pm_resident_prospect_coordinator";
export { PM_MAINTENANCE_COORDINATOR_ID };

const PM_SUBJECT_TYPES = ["property", "listing", "unit"];

export const SELECTED_WORKSPACE_COOKIE_NAME = "vibetech_workspace_id";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

function currentCampaignNowISO() {
  return new Date().toISOString();
}

function describeAudiencePurpose(definition: Record<string, unknown>) {
  const id = String(definition.id ?? "");
  if (id === "interested_in_subject") return "People linked to a property or subject they expressed interest in.";
  if (id === "interested_without_outcome") return "Interested contacts still awaiting a completed outcome.";
  if (id === "matches_availability_preferences") return "Contacts with inquiry and interaction history for follow-up.";
  return `Audience for ${String(definition.name ?? "segment")}.`;
}

function deriveBusinessCapabilities(capabilityRuntime: CapabilityRuntime) {
  const caps = capabilityRuntime.getCapabilities?.() ?? [];
  const items = caps.map((c: { id: string; status: string }) => ({
    id: String(c.id),
    status: String(c.status).toLowerCase() === "active" ? "READY" : "NOT_READY",
  }));

  const readyCount = items.filter((c: { status: string }) => c.status === "READY").length;
  const overallReadiness = items.length === 0 ? "NOT_STARTED" : readyCount === items.length ? "READY" : "PARTIAL";

  return { overallReadiness, capabilities: items };
}

function attachProductContext<T extends Record<string, unknown>>(viewModel: T, connected: ConnectedBusinessWorkspace): T & { productContext: any } {
  return {
    ...viewModel,
    productContext: {
      identity: connected.identityViewModel,
      pageLabels: connected.pageLabels,
      readinessReport: connected.readinessReport,
      employeeReadinessReport: connected.employeeReadinessReport,
      installationResult: connected.installationResult,
    },
  };
}

function humanizeEmployeeBlocker(blocker: { type?: string; message?: string }, blockerLabels: Record<string, string> = {}) {
  const type = String(blocker?.type ?? "");
  if (blockerLabels[type]) return blockerLabels[type];
  if (type === "knowledge") return "Knowledge setup needed";
  if (type === "connection") return "Connection setup needed";
  if (type === "capability") return "Capability setup needed";
  if (type === "integration_capability") return "External integration needed";
  if (type === "approval") return String(blocker?.message ?? "Approval setup needed");
  return "Setup needed";
}

function resolveEmployeeSetupHref(blockers: unknown[], workspaceId: string) {
  const types = (Array.isArray(blockers) ? blockers : []).map((blocker) =>
    String((blocker as { type?: string })?.type ?? ""),
  );
  if (types.includes("knowledge")) return `/b/${workspaceId}/knowledge`;
  if (types.some((t) => t === "connection" || t === "integration_capability" || t === "capability")) {
    return `/b/${workspaceId}/integrations`;
  }
  return `/b/${workspaceId}/integrations`;
}

function isEmployeeReadyStatus(statusKey: string) {
  const s = String(statusKey ?? "").toUpperCase();
  return s === "READY" || s === "ACTIVE";
}

function enrichDigitalEmployeesForTeam(
  presentedEmployees: unknown[],
  connected: ConnectedBusinessWorkspace,
  rawEmployees: unknown[] = [],
  workspaceId = "",
) {
  const presentation =
    connected.installationResult?.executiveExperience?.dashboardPresentation ??
    connected.installationResult?.dashboardPresentation ??
    {};
  const teamPresentation = presentation.team ?? {};
  const statusLabels: Record<string, string> = {
    ACTIVE: "Ready",
    DEGRADED: "Needs setup",
    CONFIGURING: "Needs setup",
    BLOCKED: "Blocked",
    HANDLING: "Handling",
    READY: "Ready",
    UNAVAILABLE: "Blocked",
    ...(teamPresentation.statusLabels ?? {}),
  };
  const blockerLabels = teamPresentation.blockerLabels ?? {};
  const employeeDescriptions = teamPresentation.employeeDescriptions ?? {};
  const businessId = String(workspaceId);

  const rawById = new Map<string, { blockers?: unknown[]; status?: string; role?: string; name?: string }>();
  for (const raw of Array.isArray(rawEmployees) ? rawEmployees : []) {
    const entry = raw as { employeeId?: string; blockers?: unknown[]; status?: string; role?: string; name?: string };
    rawById.set(String(entry.employeeId), entry);
  }

  return (Array.isArray(presentedEmployees) ? presentedEmployees : []).map((entry) => {
    const emp = entry as Record<string, unknown>;
    const employeeId = String(emp.id ?? emp.employeeId ?? "");
    const raw = rawById.get(employeeId) ?? {};
    const blockers = Array.isArray(raw.blockers) ? raw.blockers : [];
    const statusKey = String(raw.status ?? emp.status ?? "").toUpperCase();
    const roleKey = String(raw.role ?? emp.roleKey ?? "");
    const blockerItems = blockers.map((blocker) => humanizeEmployeeBlocker(blocker as { type?: string; message?: string }, blockerLabels));
    const monitoring = Array.isArray(emp.monitoring) ? (emp.monitoring as Array<{ label?: string; count?: number }>) : [];
    const openAssignmentCount =
      monitoring.find((item) => String(item.label ?? "").toLowerCase().includes("assignment"))?.count ?? 0;
    const ready = isEmployeeReadyStatus(statusKey);

    return {
      ...emp,
      employeeId,
      name: emp.name ?? raw.name,
      role: emp.role ?? presentation.roleLabels?.[roleKey] ?? roleKey.replace(/_/g, " "),
      responsibility: emp.responsibility ?? emp.role,
      description: employeeDescriptions[employeeId] ?? null,
      statusKey,
      status: statusKey,
      statusLabel: statusLabels[statusKey] ?? statusKey.replace(/_/g, " ").toLowerCase(),
      isReady: ready,
      blockerItems,
      blockerSummary:
        blockerItems.length === 0
          ? null
          : blockerItems.length === 1
            ? blockerItems[0]
            : `${blockerItems.length} setup items remaining`,
      setupHref: ready ? null : resolveEmployeeSetupHref(blockers, businessId),
      workHref: openAssignmentCount > 0 ? `/b/${businessId}/work` : null,
      openAssignmentCount,
      monitoring,
      currentHandling: emp.currentHandling ?? null,
    };
  });
}

export class WorkspaceService {
  private runtime: CompanyWorkspaceRuntime;
  private adapter: WorkspaceViewAdapter;
  private api: MockWorkspaceApi;
  private generator = new WorkspaceGenerator({ nowISO: NOW_ISO });
  private teamRuntime: TeamRuntime;
  private requestRuntime: RequestRuntime;
  private workRuntime: WorkRuntime;
  private capabilityRuntime: CapabilityRuntime;
  private communicationRuntime: CommunicationRuntime;
  private analyticsRuntime: AnalyticsRuntime;
  private connected: ConnectedBusinessWorkspace;
  private workspaceId: string;

  constructor({
    workspaceId,
    activation,
    runtimeSnapshots,
  }: {
    workspaceId: string;
    activation?: import("./ConnectedBusinessWorkspace").WorkspaceActivationInput | null;
    runtimeSnapshots?: Record<string, unknown>;
  }) {
    if (!workspaceId) {
      throw new Error("WorkspaceService requires a workspaceId");
    }
    this.workspaceId = String(workspaceId);
    this.connected = workspaceCompositionRegistry.getOrCreate(this.workspaceId, ({ workspaceId: resolvedId }) => {
      return new ConnectedBusinessWorkspace({
        nowISO: NOW_ISO,
        workspaceId: resolvedId,
        activation: activation ?? undefined,
        runtimeSnapshots,
      });
    });
    this.runtime = this.connected.ctx.companyRuntime;
    this.teamRuntime = this.connected.ctx.teamRuntime;
    this.requestRuntime = this.connected.ctx.requestRuntime;
    this.workRuntime = this.connected.ctx.workRuntime;
    this.capabilityRuntime = this.connected.ctx.capabilityRuntime;
    this.communicationRuntime = this.connected.ctx.communicationRuntime;
    this.analyticsRuntime = this.connected.ctx.analyticsRuntime;

    this.adapter = new WorkspaceViewAdapter({ runtime: this.runtime });
    this.api = new MockWorkspaceApi({ runtime: this.runtime, seedDemoInquiryEvent: false });
  }

  loadProductContext() {
    return {
      identity: this.connected.identityViewModel,
      pageLabels: this.connected.pageLabels,
      readinessReport: this.connected.readinessReport,
      employeeReadinessReport: this.connected.employeeReadinessReport,
      connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
      connectionDependencyProjection: this.connected.connectionDependencyProjection,
      installationResult: this.connected.installationResult,
    };
  }

  async reconcileHistoricalSubjectInterestsIfNeeded() {
    const connected = this.connected as ConnectedBusinessWorkspace & { subjectInterestReconciliationComplete?: boolean };
    if (connected.subjectInterestReconciliationComplete) {
      return { changed: false, reconciledCount: 0, skippedCount: 0, snapshotKinds: [] };
    }
    const stack = connected.operatingStack ?? connected.ctx;
    const result = reconcileHistoricalSubjectInterests({ stack, nowISO: NOW_ISO });
    if (result.changed) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    connected.subjectInterestReconciliationComplete = true;
    return result;
  }

  async materializeDueRecurringCampaignOperationsIfNeeded() {
    const connected = this.connected as ConnectedBusinessWorkspace & { recurringCampaignMaterializationComplete?: boolean };
    if (connected.recurringCampaignMaterializationComplete) {
      return { ok: true, results: [], snapshotKinds: [] };
    }
    const stack = connected.operatingStack ?? connected.ctx;
    const installation = connected.installationResult as Record<string, unknown>;
    const result = (materializeDueRecurringOperations as any)({
      stack,
      businessId: this.workspaceId,
      operationDefinitions: installation?.recurringOperationDefinitions ?? [],
      campaignTemplates: installation?.campaignTemplates ?? [],
      nowISO: currentCampaignNowISO(),
    });
    if (result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    connected.recurringCampaignMaterializationComplete = true;
    return result;
  }

  private getWorkspaceConfig() {
    return this.generator.generate({
      runtime: this.runtime,
      businessProfile: this.runtime.getBusinessProfile(),
      companyProfile: this.runtime.getCompanyProfile(),
      businessCapabilities: deriveBusinessCapabilities(this.capabilityRuntime),
      nowISO: NOW_ISO,
    });
  }

  loadDashboard() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getDashboardView(workspaceConfig);
  }

  loadDigitalWorkforce() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getDigitalWorkforceView(workspaceConfig);
  }

  loadWorkQueue() {
    const workspaceConfig = this.getWorkspaceConfig();
    return this.adapter.getWorkQueueView(workspaceConfig);
  }

  loadWorkspaceViewModel() {
    const workspaceConfig = this.getWorkspaceConfig();
    const shell = this.adapter.translate(workspaceConfig);
    const packageRegistry = getDefaultIndustryPackageRegistry();
    const industryPackage = this.connected.activation?.industryPackageId
      ? packageRegistry.getPackage(this.connected.activation.industryPackageId)
      : null;

    const commandCenterRaw = composeBusinessCommandCenter({
      identityViewModel: this.connected.identityViewModel,
      readinessReport: this.connected.readinessReport,
      connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
      employeeReadinessReport: this.connected.employeeReadinessReport,
      connectionDependencyProjection: this.connected.connectionDependencyProjection,
      integrationPlatform: this.connected.integrationPlatform,
      terminology: this.connected.installationResult?.terminology,
      installationResult: this.connected.installationResult,
      industryPackage,
      nowISO: NOW_ISO,
      ctx: this.connected.ctx,
    });
    const commandCenterView = adaptBusinessCommandCenterView(commandCenterRaw, {
      pageLabels: this.connected.pageLabels,
    });
    const packageNavigation = (buildPackageNavigation as (input: Record<string, unknown>) => unknown)({
      pageLabels: this.connected.pageLabels,
      packageNavigation: industryPackage?.navigation,
      attentionCount: commandCenterView.needsYourAttention?.length ?? 0,
    });
    return {
      ...shell,
      packageNavigation,
      productContext: this.loadProductContext(),
    };
  }

  loadMissionControlViewModel() {
    const brief = new CompanyBriefEngine({ nowISO: NOW_ISO }).generate({ companyRuntime: this.runtime });
    const health = new CompanyHealthEngine({ nowISO: NOW_ISO }).generate({ companyRuntime: this.runtime, companyBrief: brief });
    const insights = new CompanyInsightEngine({ nowISO: NOW_ISO }).generate({
      previousCompanyHealth: health,
      currentCompanyHealth: health,
    });
    const opportunities = new CompanyOpportunityEngine({ nowISO: NOW_ISO }).generate({
      companyRuntime: this.runtime,
      companyBrief: brief,
      companyHealth: health,
      companyInsights: insights,
    });
    const recommendations = new CompanyRecommendationEngine({ nowISO: NOW_ISO }).generate({
      companyBrief: brief,
      companyHealth: health,
      companyInsights: insights,
      companyOpportunities: opportunities,
    });

    const missionControl = new MissionControlGenerator({ nowISO: NOW_ISO }).generate({
      companyBrief: brief,
      companyHealth: health,
      companyInsights: insights,
      companyOpportunities: opportunities,
      companyRecommendations: recommendations,
    });

    const base = new MissionControlViewAdapter().translate(missionControl);


    const packageRegistry = getDefaultIndustryPackageRegistry();
    const industryPackage = this.connected.activation?.industryPackageId
      ? packageRegistry.getPackage(this.connected.activation.industryPackageId)
      : null;

    const commandCenterRaw = composeBusinessCommandCenter({
      identityViewModel: this.connected.identityViewModel,
      readinessReport: this.connected.readinessReport,
      connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
      employeeReadinessReport: this.connected.employeeReadinessReport,
      connectionDependencyProjection: this.connected.connectionDependencyProjection,
      integrationPlatform: this.connected.integrationPlatform,
      terminology: this.connected.installationResult?.terminology,
      installationResult: this.connected.installationResult,
      industryPackage,
      nowISO: NOW_ISO,
      ctx: this.connected.ctx,
    });
    const commandCenter = adaptBusinessCommandCenterView(commandCenterRaw, {
      pageLabels: this.connected.pageLabels,
    });

    const demoPartyId =
      this.connected.demoBootstrap?.primaryPartyId ??
      this.connected.ctx.businessGraphRuntime.getParties?.()?.[0]?.id ??
      null;
    const engagement =
      demoPartyId != null
        ? new EngagementViewAdapter({ nowISO: NOW_ISO }).translate({
            partyId: String(demoPartyId),
            businessGraphRuntime: this.connected.ctx.businessGraphRuntime,
            businessSubjectRuntime: this.connected.ctx.businessSubjectRuntime,
            communicationPreferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
            segmentDefinitionRuntime: this.connected.ctx.segmentDefinitionRuntime,
            requestRuntime: this.requestRuntime,
            workRuntime: this.workRuntime,
            communicationRuntime: this.communicationRuntime,
            interactionRuntime: this.connected.ctx.interactionRuntime,
            automationRuntime: this.connected.ctx.automationRuntime,
            approvalRuntime: this.connected.ctx.approvalRuntime,
            platformEventStore: this.connected.ctx.platformEventStore,
            analyticsRuntime: this.analyticsRuntime,
          } as Record<string, unknown>)
        : null;
    const audiences = (this.connected.ctx.segmentDefinitionRuntime?.getDefinitions?.() ?? []).map(
      (definition: Record<string, unknown>) => {
        const projection = projectSegmentMembership({
          segmentDefinition: definition,
          businessGraphRuntime: this.connected.ctx.businessGraphRuntime,
          requestRuntime: this.requestRuntime,
          interactionRuntime: this.connected.ctx.interactionRuntime,
          businessSubjectRuntime: this.connected.ctx.businessSubjectRuntime,
          preferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
        } as Record<string, unknown>);
        return {
          segmentId: definition.id,
          segmentName: definition.name,
          memberCount: projection.members.length,
        };
      },
    );
    const demoStorySteps = buildDemoStorySteps({
      identityViewModel: this.connected.identityViewModel,
      engagement,
      commandCenter,
      connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
      audiences,
    });

    const merged = attachProductContext(
      {
        ...base,
        commandCenter,
        hero: commandCenter.hero,
        pulse: commandCenter.pulse,
        businessStateSummary: commandCenter.businessStateSummary,
        businessControlStatus: commandCenter.businessControlStatus,
        operatingStates: commandCenter.operatingStates,
        needsYourAttention: commandCenter.needsYourAttention,
        handledByVibeTech: commandCenter.handledByVibeTech,
        workInProgress: commandCenter.workInProgress,
        workMovingNow: commandCenter.workMovingNow,
        businessEpisodes: commandCenter.businessEpisodes,
        businessEpisodeFeed: commandCenter.businessEpisodeFeed,
        digitalWorkforce: commandCenter.digitalWorkforce,
        businessActivity: commandCenter.businessActivity,
        businessHealth: commandCenter.businessHealth,
        whatHappensNext: commandCenter.whatHappensNext,
        autonomousContinuation: commandCenter.autonomousContinuation,
        autonomousContinuationTitle: commandCenter.autonomousContinuationTitle,
        demoStorySteps,
      },
      this.connected,
    );

    // Compose Business Intelligence + communications into Mission Control experience.
    // Reuses existing engines/loaders only — no new backend engines.
    let intelligenceView: Record<string, unknown> | null = null;
    try {
      intelligenceView = this.loadBusinessIntelligenceWorkspace() as Record<string, unknown>;
    } catch {
      intelligenceView = null;
    }

    let recentCommunications: unknown[] = [];
    try {
      const executiveHome = this.loadExecutiveWorkspaceHomeViewModel({});
      recentCommunications = Array.isArray((executiveHome as any)?.recentCommunications)
        ? (executiveHome as any).recentCommunications
        : [];
    } catch {
      recentCommunications = [];
    }

    return (composeMissionControlExperience as any)({
      missionControlViewModel: merged,
      businessIntelligenceView: intelligenceView,
      recentCommunications,
      upcomingWork: commandCenter.workMovingNow ?? commandCenter.workInProgress ?? [],
    });
  }

  loadAttentionViewModel() {
    const mission = this.loadMissionControlViewModel();
    return {
      ...mission,
      pageTitle: this.connected.pageLabels?.attention ?? "Needs decision",
      attentionItems: mission.needsYourAttention ?? [],
    };
  }

  /**
   * Continuous Business Intelligence workspace — compose existing BI engines + intelligence candidates.
   * Candidate existence never mutates Work by itself.
   */
  loadBusinessIntelligenceWorkspace() {
    const installation = this.connected.installationResult ?? null;
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const businessSummary = {
      businessId: this.workspaceId,
      industry: installation?.configuration?.industry
        ?? installation?.industry
        ?? this.connected.activation?.industryPackageId
        ?? null,
      terminology: installation?.configuration?.terminology ?? installation?.terminology ?? null,
      roles: installation?.configuration?.digitalWorkforce ?? null,
      customerTypes: installation?.configuration?.customerTypes ?? null,
      services: installation?.configuration?.services ?? null,
    };

    const analyticsVm = (() => {
      try {
        return this.loadAnalyticsViewModel?.() ?? null;
      } catch {
        return null;
      }
    })();

    const intelligence = (projectIntelligenceCandidates as any)({
      intelligenceCandidateRuntime: stack?.intelligenceCandidateRuntime,
      businessId: this.workspaceId,
    });
    const memory = (buildBusinessMemoryTimeline as any)({
      intelligenceCandidateRuntime: stack?.intelligenceCandidateRuntime,
      workRuntime: stack?.workRuntime ?? this.workRuntime,
      interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx.interactionRuntime,
      approvalRuntime: stack?.approvalRuntime ?? this.connected.ctx.approvalRuntime,
    });
    const recentImprovements = (memory.events ?? [])
      .filter((entry: { kind?: string }) => (
        entry.kind === "intelligence_candidate_resolved"
        || entry.kind === "intelligence_converted_to_work"
        || entry.kind === "work_state"
      ))
      .slice(0, 12)
      .map((entry: { relatedId?: string; label?: string; at?: string | null }) => ({
        id: String(entry.relatedId ?? entry.label),
        label: entry.label,
        at: entry.at ?? null,
      }));

    const layer = new (BusinessIntelligenceLayer as any)({ nowISO: NOW_ISO });
    const workspace = layer.observeAndRecommend({
      companyRuntime: this.runtime,
      installation,
      analytics: analyticsVm,
      workRuntime: this.workRuntime,
      requestRuntime: this.requestRuntime,
      businessSummary,
      recentImprovements,
    });

    const view = (adaptBusinessIntelligenceWorkspace as any)(workspace, {
      businessId: this.workspaceId,
      businessName: this.connected.identityViewModel?.businessName
        ?? this.connected.identityViewModel?.name
        ?? null,
    });

    return attachProductContext({
      ...view,
      intelligenceCandidates: intelligence.candidates,
      intelligenceHistory: intelligence.history,
      recentImprovements,
      businessMemory: memory,
    } as Record<string, unknown>, this.connected);
  }

  ensureBusinessIntelligenceDefinitionsRegistered() {
    const registry = getDefaultBusinessIntelligenceDefinitionRegistry();
    const packageId = this.connected.activation?.industryPackageId;
    if (packageId === "pkg_property_management") {
      registerPropertyManagementIntelligenceDefinitions(registry);
    }
    return registry;
  }

  async evaluateIntelligenceCandidates(nowISO?: string) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    if (!stack?.intelligenceCandidateRuntime) {
      throw new Error("Intelligence candidate runtime is not available for this workspace.");
    }
    this.ensureBusinessIntelligenceDefinitionsRegistered();
    const service = new BusinessIntelligenceEvaluationService();
    const result = await service.evaluate({
      stack,
      businessId: this.workspaceId,
      nowISO: nowISO ?? NOW_ISO,
      industryPackageId: this.connected.activation?.industryPackageId ?? null,
      platformStore,
      actorUserId: null,
    } as any);
    if (result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  loadIntelligenceCandidates() {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    return (projectIntelligenceCandidates as any)({
      intelligenceCandidateRuntime: stack?.intelligenceCandidateRuntime,
      businessId: this.workspaceId,
    });
  }

  async dismissIntelligenceCandidate(candidateId: string, reason: string, nowISO?: string) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const result = new IntelligenceCandidateLifecycle().dismiss({
      stack,
      candidateId,
      reason,
      nowISO: nowISO ?? NOW_ISO,
      platformStore,
    } as any);
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async convertIntelligenceCandidateToWork(candidateId: string, nowISO?: string) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    if (!stack) throw new Error("Intelligence work conversion is not available for this workspace.");
    const result = await new IntelligenceToWorkConversionService().execute({
      stack,
      candidateId,
      nowISO: nowISO ?? NOW_ISO,
      platformStore,
    } as any);
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async convertIntelligenceCandidateToArchitectChange(
    candidateId: string,
    installedSpecification: Record<string, unknown>,
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    if (!stack) throw new Error("Intelligence Architect conversion is not available for this workspace.");
    const result = await new IntelligenceToArchitectChangeService({
      continuousBuilder: new ContinuousBusinessBuilderService(),
    }).execute({
      stack,
      candidateId,
      businessId: this.workspaceId,
      installedSpecification,
      nowISO: nowISO ?? NOW_ISO,
      platformStore,
    } as any);
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  loadTeamViewModel() {
    const brief = new CompanyBriefEngine({ nowISO: NOW_ISO }).generate({ companyRuntime: this.runtime });
    const adapter = new TeamViewAdapter({ nowISO: NOW_ISO });
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    const rawEmployees = this.connected.employeeReadinessReport?.employees ?? [];
    const workforce = presentDigitalWorkforce({
      employeeReadinessReport: this.connected.employeeReadinessReport,
      workRuntime: this.workRuntime,
      automationRuntime: this.connected.ctx.automationRuntime,
      teamRuntime: this.teamRuntime,
      presentation,
      nowISO: NOW_ISO,
      approvalRuntime: this.connected.ctx.approvalRuntime,
    });
    const digitalEmployees = enrichDigitalEmployeesForTeam(
      workforce.digitalEmployees,
      this.connected,
      rawEmployees,
      this.workspaceId,
    );
    const base = adapter.translate({
      teamRuntime: this.teamRuntime,
      companyRuntime: this.runtime,
      workRuntime: this.workRuntime,
      companyBrief: brief,
      digitalEmployees,
    });
    return attachProductContext(
      {
        ...base,
        digitalEmployees,
      },
      this.connected,
    );
  }

  loadWorkViewModel() {
    const adapter = new WorkViewAdapter({ nowISO: NOW_ISO });
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    return attachProductContext(
      adapter.translate({
        workRuntime: this.workRuntime,
        teamRuntime: this.teamRuntime,
        companyRuntime: this.runtime,
        businessGraphRuntime: this.connected.ctx.businessGraphRuntime,
        businessSubjectRuntime: this.connected.ctx.businessSubjectRuntime,
        requestRuntime: this.requestRuntime,
        communicationRuntime: this.communicationRuntime,
        presentation,
        businessId: this.workspaceId,
      }),
      this.connected,
    );
  }

  loadKnowledgeViewModel() {
    const workspaceConfig = this.getWorkspaceConfig();
    return attachProductContext(this.adapter.getKnowledgeView(workspaceConfig), this.connected);
  }

  loadKnowledgeExecutiveContext() {
    return buildKnowledgeExecutiveContext(this.connected);
  }

  loadRequestViewModel() {
    const adapter = new RequestViewAdapter({ nowISO: NOW_ISO });
    return attachProductContext(
      adapter.translate({
        requestRuntime: this.requestRuntime,
        companyRuntime: this.runtime,
        teamRuntime: this.teamRuntime,
        workRuntime: this.workRuntime,
      }),
      this.connected,
    );
  }

  loadCapabilityViewModel() {
    const report = new CapabilityIntelligenceEngine({ nowISO: NOW_ISO }).generate({
      capabilityRuntime: this.capabilityRuntime,
      teamRuntime: this.teamRuntime,
      workRuntime: this.workRuntime,
      companyWorkspaceRuntime: this.runtime,
      companyId: String(this.connected.identityViewModel?.businessName ?? "company"),
      nowISO: NOW_ISO,
    } as any);

    const adapter = new CapabilityViewAdapter({ nowISO: NOW_ISO });
    return attachProductContext(
      adapter.translate({
        capabilityRuntime: this.capabilityRuntime,
        capabilityIntelligenceReport: report,
      }),
      this.connected,
    );
  }

  loadCommunicationViewModel({ includeProductContext = true }: { includeProductContext?: boolean } = {}) {
    const adapter = new CommunicationViewAdapter({ nowISO: NOW_ISO });
    const vm = adapter.translate({
      communicationRuntime: this.communicationRuntime,
      workRuntime: this.workRuntime,
      teamRuntime: this.teamRuntime,
      companyWorkspaceRuntime: this.runtime,
    });
    return includeProductContext ? attachProductContext(vm, this.connected) : vm;
  }

  loadAnalyticsViewModel() {
    const companyId = String(this.connected.identityViewModel?.businessName ?? "company");
    const analyticsIntelligenceReport = new AnalyticsIntelligenceEngine({ nowISO: NOW_ISO }).generate({
      analyticsRuntime: this.analyticsRuntime,
      companyId: companyId as any,
      nowISO: NOW_ISO,
    } as any);

    const adapter = new AnalyticsViewAdapter({ nowISO: NOW_ISO });
    return attachProductContext(
      adapter.translate({
        analyticsRuntime: this.analyticsRuntime,
        analyticsIntelligenceReport,
      }),
      this.connected,
    );
  }

  loadSetupViewModel() {
    const adapter = new SetupViewAdapter();
    return attachProductContext(
      adapter.translate({
        identity: this.connected.identityViewModel,
        installationResult: this.connected.installationResult,
        readinessReport: this.connected.readinessReport,
        employeeReadinessReport: this.connected.employeeReadinessReport,
        connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
        connectionDependencyProjection: this.connected.connectionDependencyProjection,
      }),
      this.connected,
    );
  }

  loadConnectionCenterViewModel() {
    const adapter = new ConnectionCenterViewAdapter();
    return attachProductContext(
      adapter.translate({
        identity: this.connected.identityViewModel,
        installationResult: this.connected.installationResult,
        connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
        connectionDependencyProjection: this.connected.connectionDependencyProjection,
        providerRegistry: this.connected.integrationPlatform?.providerRegistry,
      }),
      this.connected,
    );
  }

  loadAutomationCenterViewModel() {
    const adapter = new AutomationCenterViewAdapter();
    return attachProductContext(
      adapter.translate({
        identity: this.connected.identityViewModel,
        installationResult: this.connected.installationResult,
        automationRuntime: this.connected.ctx.automationRuntime,
      }),
      this.connected,
    );
  }

  loadEngagementViewModel(partyId: string) {
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    const adapter = new EngagementViewAdapter({ nowISO: NOW_ISO });
    return attachProductContext(
      adapter.translate({
        partyId: String(partyId),
        businessGraphRuntime: this.connected.ctx.businessGraphRuntime,
        businessSubjectRuntime: this.connected.ctx.businessSubjectRuntime,
        communicationPreferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
        segmentDefinitionRuntime: this.connected.ctx.segmentDefinitionRuntime,
        requestRuntime: this.requestRuntime,
        workRuntime: this.workRuntime,
        communicationRuntime: this.communicationRuntime,
        interactionRuntime: this.connected.ctx.interactionRuntime,
        automationRuntime: this.connected.ctx.automationRuntime,
        approvalRuntime: this.connected.ctx.approvalRuntime,
        platformEventStore: this.connected.ctx.platformEventStore,
        analyticsRuntime: this.analyticsRuntime,
        teamRuntime: this.teamRuntime,
        presentation,
      } as Record<string, unknown>),
      this.connected,
    );
  }

  loadEngagementPartyIndex() {
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    const index = buildEngagementPartyIndex({
      businessGraphRuntime: this.connected.ctx.businessGraphRuntime,
      requestRuntime: this.requestRuntime,
      workRuntime: this.workRuntime,
      interactionRuntime: this.connected.ctx.interactionRuntime,
      communicationRuntime: this.communicationRuntime,
      businessSubjectRuntime: this.connected.ctx.businessSubjectRuntime,
      communicationPreferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
      segmentDefinitionRuntime: this.connected.ctx.segmentDefinitionRuntime,
      automationRuntime: this.connected.ctx.automationRuntime,
      approvalRuntime: this.connected.ctx.approvalRuntime,
      presentation,
      businessId: this.workspaceId,
      nowISO: NOW_ISO,
    });
    const relationshipFollowUps = this.loadRelationshipFollowUps({ includeProductContext: false });
    return attachProductContext({ ...index, relationshipFollowUps }, this.connected);
  }

  loadRelationshipFollowUps({ includeProductContext = true }: { includeProductContext?: boolean } = {}) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const projection = buildRelationshipFollowUpProjection({
      businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx.businessGraphRuntime,
      requestRuntime: stack?.requestRuntime ?? this.requestRuntime,
      workRuntime: stack?.workRuntime ?? this.workRuntime,
      interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx.interactionRuntime,
      communicationRuntime: stack?.communicationRuntime ?? this.communicationRuntime,
      businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx.businessSubjectRuntime,
      communicationPreferenceRuntime: stack?.communicationPreferenceRuntime ?? this.connected.ctx.communicationPreferenceRuntime,
      relationshipFollowUpRules: this.connected.installationResult?.relationshipFollowUpRules ?? [],
      relationshipTypes: this.connected.installationResult?.relationshipTypes ?? [],
      nowISO: NOW_ISO,
    } as Parameters<typeof buildRelationshipFollowUpProjection>[0]);
    return includeProductContext ? attachProductContext(projection, this.connected) : projection;
  }

  async createRelationshipFollowUpWork(candidateId: string, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) {
      throw new Error("Relationship follow-up work is not available for this workspace.");
    }
    const result = new RelationshipFollowUpWorkConversionService().execute({
      stack,
      installationResult: this.connected.installationResult,
      candidateId,
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async resolveRelationshipFollowUpWork(
    input: {
      workId: string;
      outcomeId: string;
      note?: string;
      nextFollowUpAt?: string;
      qualificationUpdates?: Record<string, unknown>;
      actorId?: string;
    },
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack;
    if (!stack) {
      throw new Error("Relationship follow-up work is not available for this workspace.");
    }
    const result = new RelationshipFollowUpResolutionService().execute({
      stack,
      installationResult: this.connected.installationResult,
      workId: input.workId,
      outcomeId: input.outcomeId,
      note: input.note,
      nextFollowUpAt: input.nextFollowUpAt,
      qualificationUpdates: input.qualificationUpdates,
      actorId: input.actorId,
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async prepareRelationshipFollowUpDraft(
    input: {
      workId: string;
      actorId?: string;
      knowledgeDocuments?: Array<Record<string, unknown>>;
    },
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack;
    if (!stack) {
      throw new Error("Relationship follow-up draft assistance is not available for this workspace.");
    }
    const result = (new RelationshipFollowUpDraftAssistanceService() as any).execute({
      stack,
      installationResult: this.connected.installationResult,
      businessId: this.workspaceId,
      workId: input.workId,
      actorId: input.actorId,
      knowledgeDocuments: input.knowledgeDocuments ?? [],
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  loadRelationshipOperationsIntelligence() {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const installation = this.connected.installationResult as Record<string, unknown>;
    const intelligence = (buildRelationshipOperationsIntelligence as any)({
      businessId: this.workspaceId,
      workRuntime: stack?.workRuntime ?? this.workRuntime,
      interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx.interactionRuntime,
      businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx.businessGraphRuntime,
      businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx.businessSubjectRuntime,
      communicationRuntime: stack?.communicationRuntime ?? this.communicationRuntime,
      teamRuntime: stack?.teamRuntime ?? this.teamRuntime,
      relationshipTypes: this.connected.installationResult?.relationshipTypes ?? [],
      nowISO: NOW_ISO,
    });
    const campaignOperations = (buildCampaignOperationsView as any)({
      businessId: this.workspaceId,
      stack,
      operationDefinitions: installation?.recurringOperationDefinitions ?? [],
      campaignTemplates: installation?.campaignTemplates ?? [],
      nowISO: currentCampaignNowISO(),
    });
    const referralOperations = buildReferralOperationsSummary({ stack });
    return attachProductContext(
      { ...intelligence, businessId: this.workspaceId, campaignOperations, referralOperations },
      this.connected,
    );
  }

  async prepareCampaign(input: {
    campaignTemplateId?: string;
    businessTemplateId?: string | null;
    subjectId?: string | null;
    operationId?: string | null;
    actorId?: string;
  }, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign preparation is not available for this workspace.");
    const installation = this.connected.installationResult as Record<string, unknown>;
    const templates = Array.isArray(installation?.campaignTemplates) ? installation.campaignTemplates as Array<Record<string, unknown>> : [];
    const operations = Array.isArray(installation?.recurringOperationDefinitions) ? installation.recurringOperationDefinitions as Array<Record<string, unknown>> : [];

    let businessTemplate: Record<string, unknown> | null = null;
    if (input.businessTemplateId) {
      businessTemplate = await businessCampaignTemplateService.getTemplate(String(input.businessTemplateId), this.workspaceId) as Record<string, unknown> | null;
      if (!businessTemplate) throw new Error("Business campaign template not found.");
    }

    const packageTemplateId = input.campaignTemplateId
      || (businessTemplate?.sourceTemplateId ? String(businessTemplate.sourceTemplateId) : null)
      || (businessTemplate?.id ? String(businessTemplate.id) : null);
    const template = templates.find((entry) => String(entry.id) === String(packageTemplateId))
      || (businessTemplate
        ? {
            id: String(businessTemplate.sourceTemplateId || businessTemplate.id),
            name: businessTemplate.name,
            purpose: businessTemplate.purpose || "Review campaign audience and draft.",
            channel: businessTemplate.channel || "email",
            audience: businessTemplate.audience || { type: "all_marketable_contacts" },
            approvalRequired: businessTemplate.approvalRequired !== false,
            defaultSubject: businessTemplate.subjectLine,
            cta: businessTemplate.cta || "",
            guardrails: businessTemplate.guardrails || [],
          }
        : null);
    if (!template) throw new Error("Campaign template not found.");
    const operation = input.operationId ? operations.find((entry) => String(entry.id) === String(input.operationId)) ?? null : null;
    const requiresSubject = String((template.audience as Record<string, unknown> | undefined)?.type ?? "") === "subject_interest";
    const subjectId = input.subjectId ? String(input.subjectId) : null;
    if (requiresSubject && !subjectId) throw new Error("Select a property before preparing this campaign.");
    if (subjectId && !stack.businessSubjectRuntime?.getSubject?.(subjectId)) {
      throw new Error("Selected property does not belong to this business.");
    }
    const effectiveNowISO = nowISO ?? currentCampaignNowISO();
    let knowledgeDocuments: Array<Record<string, unknown>> = [];
    try {
      knowledgeDocuments = await businessKnowledgeService.listOperationalDocuments(this.workspaceId);
    } catch {
      knowledgeDocuments = [];
    }
    const result = (new CampaignPreparationService() as any).execute({
      stack,
      businessId: this.workspaceId,
      campaignTemplate: template,
      businessTemplate,
      operation,
      occurrenceKey: effectiveNowISO,
      subjectId,
      nowISO: effectiveNowISO,
      knowledgeDocuments,
      knowledgeExpectations: (MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE as any).knowledgeExpectations ?? null,
    });
    if (result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async getCampaignWork(workId: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign studio is not available for this workspace.");
    const result = (new CampaignDocumentService() as any).getCampaignWork(stack, workId);
    if (!result.ok) return result;
    return {
      ...result,
      sectionTypes: PM_CAMPAIGN_SECTION_TYPES,
      expectedApprovalBinding: buildExpectedApprovalBinding(result.campaign, workId),
    };
  }

  async updateCampaignDocument(workId: string, input: {
    subjectLine?: string;
    previewText?: string | null;
    sections?: Array<Record<string, unknown>>;
  }, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign studio is not available for this workspace.");
    const result = (new CampaignDocumentService() as any).updateDocument({
      stack,
      workId,
      subjectLine: input.subjectLine,
      previewText: input.previewText,
      sections: input.sections,
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async previewCampaignWork(workId: string, partyId?: string | null) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign studio is not available for this workspace.");
    return (new CampaignDocumentService() as any).preview({
      stack,
      workId,
      partyId: partyId ? String(partyId) : null,
    });
  }

  async refreshCampaignAudience(workId: string, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign studio is not available for this workspace.");
    const loaded = (new CampaignDocumentService() as any).getCampaignWork(stack, workId);
    if (!loaded.ok) return loaded;
    const installation = this.connected.installationResult as Record<string, unknown>;
    const templates = Array.isArray(installation?.campaignTemplates) ? installation.campaignTemplates as Array<Record<string, unknown>> : [];
    const template = templates.find((entry) => String(entry.id) === String(loaded.campaign.campaignTemplateId)) ?? null;
    const result = (new CampaignDocumentService() as any).refreshAudience({
      stack,
      workId,
      campaignTemplate: template,
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async listCampaignTemplates() {
    const installation = this.connected.installationResult as Record<string, unknown>;
    const packageTemplates = Array.isArray(installation?.campaignTemplates)
      ? (installation.campaignTemplates as Array<Record<string, unknown>>).map((template) => ({
          id: String(template.id),
          name: String(template.name ?? template.id),
          purpose: template.purpose ? String(template.purpose) : null,
          channel: String(template.channel ?? "email"),
          audience: template.audience ?? { type: "all_marketable_contacts" },
          subjectLine: String(template.defaultSubject ?? ""),
          origin: "package" as const,
          immutable: true,
        }))
      : [];
    const businessTemplates = await businessCampaignTemplateService.listTemplates(this.workspaceId);
    return {
      packageTemplates,
      businessTemplates,
      sectionTypes: PM_CAMPAIGN_SECTION_TYPES,
    };
  }

  async saveCampaignAsTemplate(workId: string, input: { name?: string; templateId?: string | null; actorId?: string } = {}) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign studio is not available for this workspace.");
    const loaded = (new CampaignDocumentService() as any).getCampaignWork(stack, workId);
    if (!loaded.ok) throw new Error(loaded.reason === "work_not_found" ? "Campaign work not found." : "Not campaign work.");
    const document = loaded.document;
    const campaign = loaded.campaign;
    return businessCampaignTemplateService.saveTemplate({
      businessId: this.workspaceId,
      ...(input.templateId ? { templateId: String(input.templateId) } : {}),
      name: input.name || campaign.campaignName || document.subjectLine || "Saved campaign template",
      purpose: campaign.purpose ?? null,
      channel: document.channel,
      audience: campaign.campaignTemplateId
        ? ((this.connected.installationResult as any)?.campaignTemplates ?? []).find((entry: any) => String(entry.id) === String(campaign.campaignTemplateId))?.audience
          ?? { type: "all_marketable_contacts" }
        : { type: "all_marketable_contacts" },
      subjectLine: document.subjectLine,
      previewText: document.previewText,
      cta: campaign.cta ?? null,
      guardrails: campaign.guardrails ?? [],
      sections: document.sections,
      sourceTemplateId: campaign.campaignTemplateId ?? null,
      approvalRequired: true,
      actorUserId: input.actorId ?? null,
    } as any);
  }

  async approveCampaignWork(workId: string, input: { binding?: Record<string, unknown> | null; actorId?: string } = {}, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign approval is not available for this workspace.");
    const result = (new CampaignPreparationService() as any).approve({
      stack,
      workId,
      binding: input.binding ?? null,
      approvedBy: input.actorId ?? null,
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async previewCampaignSend(workId: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign delivery is not available for this workspace.");
    return (new CampaignDeliveryService() as any).previewSend({
      stack,
      workId,
      integrationPlatform: this.connected.integrationPlatform,
    });
  }

  async sendCampaignWork(workId: string, input: { binding?: Record<string, unknown> | null; actorId?: string } = {}, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign delivery is not available for this workspace.");
    const result = await (new CampaignDeliveryService() as any).executeSend({
      stack,
      workId,
      binding: input.binding ?? null,
      actorId: input.actorId ?? null,
      integrationPlatform: this.connected.integrationPlatform,
      nowISO: nowISO ?? NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  async refreshCampaignKnowledge(workId: string, nowISO?: string) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Campaign studio is not available for this workspace.");
    const loaded = (new CampaignDocumentService() as any).getCampaignWork(stack, workId);
    if (!loaded.ok) return loaded;
    let knowledgeDocuments: Array<Record<string, unknown>> = [];
    try {
      knowledgeDocuments = await businessKnowledgeService.listOperationalDocuments(this.workspaceId);
    } catch {
      knowledgeDocuments = [];
    }
    const { selectCampaignKnowledgeDocuments, campaignKnowledgeCategoryIdsForTemplate, attachKnowledgeToCampaignDocument } = await import("../../../backend/core/campaigns/CampaignKnowledgeAssembler.js") as any;
    const categoryIds = campaignKnowledgeCategoryIdsForTemplate(
      loaded.campaign.campaignTemplateId,
      (MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE as any).knowledgeExpectations,
    );
    const sources = selectCampaignKnowledgeDocuments({
      documents: knowledgeDocuments,
      businessId: this.workspaceId,
      allowedCategoryIds: categoryIds,
      subjectId: loaded.campaign.subject?.id ?? null,
    });
    const attached = attachKnowledgeToCampaignDocument({
      document: loaded.document,
      knowledgeSources: sources,
      knowledgeExpectations: (MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE as any).knowledgeExpectations,
      campaignTemplateId: loaded.campaign.campaignTemplateId,
    });
    return (new CampaignDocumentService() as any).updateDocument({
      stack,
      workId,
      sections: attached.sections,
      nowISO: nowISO ?? NOW_ISO,
    });
  }

  async loadMcBrideReadiness() {
    const stack = this.connected.operatingStack;
    let knowledgeDocumentCount = 0;
    let knowledgeDocuments: Array<Record<string, unknown>> = [];
    let membershipCount = 0;
    try {
      knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(this.workspaceId);
      knowledgeDocuments = await businessKnowledgeService.listDocuments(this.workspaceId);
      membershipCount = (await platformStore.listMembershipsForBusiness(this.workspaceId)).length;
    } catch {
      knowledgeDocumentCount = 0;
    }
    return (buildMcBrideReadinessProjection as any)({
      businessId: this.workspaceId,
      stack,
      integrationPlatform: this.connected.integrationPlatform,
      knowledgeDocumentCount,
      knowledgeDocuments,
      membershipCount,
      template: MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE as any,
    });
  }

  async recordReferralIntroduction(input: {
    referrerPartyId: string;
    introducedPartyId?: string | null;
    introducedDisplayName?: string | null;
    sourceInteractionId?: string | null;
  }) {
    const stack = this.connected.operatingStack;
    if (!stack) throw new Error("Referral loop is not available for this workspace.");
    const result = (recordReferralIntroduction as any)({
      stack,
      referrerPartyId: input.referrerPartyId,
      introducedPartyId: input.introducedPartyId ?? null,
      introducedDisplayName: input.introducedDisplayName ?? null,
      sourceInteractionId: input.sourceInteractionId ?? null,
      nowISO: NOW_ISO,
    });
    if (result.ok && result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }
    return result;
  }

  loadReferralOperationsSummary() {
    return buildReferralOperationsSummary({ stack: this.connected.operatingStack });
  }

  loadAudienceDashboard() {
    const definitions = this.connected.ctx.segmentDefinitionRuntime?.getDefinitions?.() ?? [];
    const audiences = definitions.map((definition: Record<string, unknown>) => {
      const projection = projectSegmentMembership({
        segmentDefinition: definition,
        businessGraphRuntime: this.connected.ctx.businessGraphRuntime,
        requestRuntime: this.requestRuntime,
        interactionRuntime: this.connected.ctx.interactionRuntime,
        businessSubjectRuntime: this.connected.ctx.businessSubjectRuntime,
        preferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
      } as Record<string, unknown>);

      let contactableCount = 0;
      let blockedCount = 0;
      const members = projection.members.map((member: Record<string, unknown>) => {
        const entityId = String(member.entityId);
        const emailOk = checkCommunicationPermitted({
          preferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
          partyId: entityId,
          channel: "email",
        } as Parameters<typeof checkCommunicationPermitted>[0]);
        const smsOk = checkCommunicationPermitted({
          preferenceRuntime: this.connected.ctx.communicationPreferenceRuntime,
          partyId: entityId,
          channel: "sms",
        } as Parameters<typeof checkCommunicationPermitted>[0]);
        const contactable = emailOk.permitted || smsOk.permitted;
        if (contactable) contactableCount += 1;
        else blockedCount += 1;
        const explanation = projection.explanations.find((e: Record<string, unknown>) => e.entityId === entityId);
        const party = this.connected.ctx.businessGraphRuntime.getParty?.(entityId);
        return {
          ...member,
          partyId: entityId,
          displayName: party?.displayName ?? member.displayName,
          matchReasons: explanation?.reasons ?? [],
          contactability: {
            email: emailOk.permitted ? "permitted" : emailOk.reason ?? "blocked",
            sms: smsOk.permitted ? "permitted" : smsOk.reason ?? "blocked",
            contactable,
          },
        };
      });

      return {
        segmentId: definition.id,
        segmentName: definition.name,
        purpose: describeAudiencePurpose(definition),
        targetEntityType: definition.targetEntityType,
        memberCount: projection.members.length,
        contactableCount,
        blockedCount,
        members,
        explanations: projection.explanations,
      };
    });
    return attachProductContext({ generatedAt: NOW_ISO, audiences }, this.connected);
  }

  loadReviewWork(workItemId: string) {
    return this.api.loadReviewWork(workItemId);
  }

  applyReviewDecision(workItemId: string, decision: "APPROVE" | "REJECT") {
    return this.api.applyReviewDecision(workItemId, decision);
  }

  applyOwnerApprovalDecision(approvalId: string, decision: "GRANT" | "REJECT" | "APPROVE") {
    const boundary = this.connected.operationalBoundary;
    if (!boundary?.processOwnerApprovalDecision) {
      throw new Error("Owner approval decisions are not available for this workspace.");
    }
    const normalized = decision === "APPROVE" ? "GRANT" : decision;
    return boundary.processOwnerApprovalDecision({ approvalId, decision: normalized });
  }

  searchWorkspace(query: string) {
    return projectWorkspaceSearch({
      query,
      ctx: this.connected.ctx,
      businessId: this.workspaceId,
    } as never);
  }

  sendReviewCommunication(workItemId: string) {
    return this.api.sendReviewCommunication(workItemId);
  }

  refreshOperationalState(platformActiveKnowledgeCount = 0) {
    const count = Number(platformActiveKnowledgeCount ?? 0);
    const refreshed = recomputeWorkspaceOperationalState({
      ctx: this.connected.ctx,
      installationResult: this.connected.installationResult,
      integrationPlatform: this.connected.integrationPlatform,
      activation: this.connected.activation,
      platformActiveKnowledgeCount: count,
    });
    if (Object.keys(refreshed).length > 0) {
      Object.assign(this.connected, refreshed);
    }
    return refreshed;
  }

  async connectBusinessEmail(platformActiveKnowledgeCount?: number) {
    if (!this.connected.integrationPlatform) {
      throw new Error("Integrations are not available for this workspace.");
    }
    const connection = await connectBusinessEmailDev({
      integrationPlatform: this.connected.integrationPlatform,
      workspaceId: this.workspaceId,
      nowISO: NOW_ISO,
    });
    const knowledgeCount =
      platformActiveKnowledgeCount ??
      this.connected.platformKnowledgeCoverage?.activeDocumentCount ??
      0;
    this.refreshOperationalState(knowledgeCount);
    await persistAffectedRuntimes({
      workspaceId: this.workspaceId,
      stack: this.connected.operatingStack,
      integrationPlatform: this.connected.integrationPlatform,
      kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    });
    return connection;
  }

  async submitProspectInquiry(
    inquiry: { name: string; email: string; message: string; phone?: string; subjectId?: string },
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack;
    if (!stack || !this.connected.integrationPlatform) {
      throw new Error("Prospect inquiries are not available for this workspace.");
    }
    const result = await runProspectInquiryOperatingLoop({
      stack,
      integrationPlatform: this.connected.integrationPlatform,
      workspaceId: this.workspaceId,
      nowISO: nowISO ?? NOW_ISO,
      inquiry,
    });
    if (result.ok) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
      });
    }
    return result;
  }

  async submitMaintenanceRequest(
    request: {
      name: string;
      email: string;
      description: string;
      subjectId: string;
      permissionToContact: boolean;
      phone?: string;
      urgency?: string;
    },
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack;
    if (!stack || !this.connected.integrationPlatform) {
      throw new Error("Maintenance requests are not available for this workspace.");
    }
    const result = await runMaintenanceRequestOperatingLoop({
      stack,
      integrationPlatform: this.connected.integrationPlatform,
      workspaceId: this.workspaceId,
      nowISO: nowISO ?? NOW_ISO,
      request,
    });
    if (result.ok) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
      });
    }
    return result;
  }

  async submitShowingCoordination(
    request: { requestId: string; note?: string; preferredTiming?: string },
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack;
    if (!stack) {
      throw new Error("Showing coordination is not available for this workspace.");
    }
    const result = await runShowingCoordinationOperatingLoop({
      stack,
      workspaceId: this.workspaceId,
      nowISO: nowISO ?? NOW_ISO,
      request,
    });
    if (result.ok) {
      await persistAffectedRuntimes({
        workspaceId: this.workspaceId,
        stack,
        integrationPlatform: this.connected.integrationPlatform,
        kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
      });
    }
    return result;
  }

  loadCommunicationThreadDetail(threadId: string) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    return buildCommunicationThreadDetail({
      threadId,
      communicationRuntime: this.communicationRuntime,
      requestRuntime: this.requestRuntime,
      businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx?.businessGraphRuntime,
      businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
      interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx?.interactionRuntime,
    });
  }

  loadBusinessSubjectIndex(subjectTypes?: string[]) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    return buildBusinessSubjectIndex({
      businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
      subjectTypes,
    });
  }

  loadBusinessSubjectPortfolioIndex(subjectTypes?: string[]) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const types = subjectTypes ?? PM_SUBJECT_TYPES;
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    return buildBusinessSubjectPortfolioIndex({
      ctx: {
        businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
        businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx?.businessGraphRuntime,
        requestRuntime: this.requestRuntime,
        workRuntime: this.workRuntime,
        interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx?.interactionRuntime,
      },
      subjectTypes: types,
      businessId: this.workspaceId,
      nowISO: NOW_ISO,
      presentation,
    } as Parameters<typeof buildBusinessSubjectPortfolioIndex>[0]);
  }

  loadPortfolioPresentation() {
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    const operatingHome = (presentation as { operatingHome?: Record<string, unknown> })?.operatingHome ?? {};
    return {
      metrics: (operatingHome.metrics as Record<string, string>) ?? {},
      portfolioTable: (operatingHome.portfolioTable as Record<string, string>) ?? {},
      portfolioIndex: (operatingHome.portfolioIndex as Record<string, unknown>) ?? {},
      detailMetrics:
        ((operatingHome.portfolioIndex as { detailMetrics?: Record<string, string> })?.detailMetrics as Record<
          string,
          string
        >) ?? {},
      subjectTypeLabels: (operatingHome.subjectTypeLabels as Record<string, string>) ?? {},
      sections: (operatingHome.sections as Record<string, string>) ?? {},
      emptyStates: (operatingHome.emptyStates as Record<string, string>) ?? {},
      unattributedCallout: String(operatingHome.unattributedCallout ?? "{count} inquiries not linked to a property"),
    };
  }

  loadBusinessSubjectAudiencePreview(subjectId: string) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    return buildSubjectAudiencePreview({
      subjectId,
      businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
      businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx?.businessGraphRuntime,
      requestRuntime: this.requestRuntime,
      interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx?.interactionRuntime,
      presentation: {
        interactionOutcomes: this.connected.installationResult?.interactionOutcomes ?? [],
      },
      audienceExplanation: "People with recorded interest in this property.",
      nowISO: NOW_ISO,
    } as Parameters<typeof buildSubjectAudiencePreview>[0]);
  }

  loadBusinessSubjectOperatingDetail(subjectId: string) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    const detail = buildSubjectOperatingDetail({
      subjectId,
      ctx: {
        businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
        businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx?.businessGraphRuntime,
        requestRuntime: this.requestRuntime,
        workRuntime: this.workRuntime,
        interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx?.interactionRuntime,
        communicationRuntime: this.communicationRuntime,
        teamRuntime: this.teamRuntime,
        approvalRuntime: stack?.approvalRuntime ?? this.connected.ctx?.approvalRuntime,
        automationRuntime: stack?.automationRuntime ?? this.connected.ctx?.automationRuntime,
      },
      presentation,
      subjectTypes: PM_SUBJECT_TYPES,
      nowISO: NOW_ISO,
    } as Parameters<typeof buildSubjectOperatingDetail>[0]);
    if (!detail) return null;
    const operatingHome =
      (presentation as { operatingHome?: { detail?: Record<string, string>; metrics?: Record<string, string> } })
        ?.operatingHome ?? {};
    return {
      ...detail,
      sectionLabels: operatingHome.detail ?? {},
      metricLabels: operatingHome.metrics ?? {},
    };
  }

  loadExecutiveWorkspaceHomeViewModel({ checklistComplete = false } = {}) {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    const packageRegistry = getDefaultIndustryPackageRegistry();
    const industryPackage = this.connected.activation?.industryPackageId
      ? packageRegistry.getPackage(this.connected.activation.industryPackageId)
      : null;

    return buildExecutiveWorkspaceHomeView({
      identityViewModel: this.connected.identityViewModel,
      readinessReport: this.connected.readinessReport,
      connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
      employeeReadinessReport: this.connected.employeeReadinessReport,
      connectionDependencyProjection: this.connected.connectionDependencyProjection,
      integrationPlatform: this.connected.integrationPlatform,
      terminology: this.connected.installationResult?.terminology,
      installationResult: this.connected.installationResult,
      industryPackage,
      ctx: {
        businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
        businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx?.businessGraphRuntime,
        requestRuntime: this.requestRuntime,
        workRuntime: this.workRuntime,
        interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx?.interactionRuntime,
        communicationRuntime: this.communicationRuntime,
        teamRuntime: this.teamRuntime,
        approvalRuntime: stack?.approvalRuntime ?? this.connected.ctx?.approvalRuntime,
        automationRuntime: stack?.automationRuntime ?? this.connected.ctx?.automationRuntime,
        platformEventStore: stack?.platformEventStore ?? this.connected.ctx?.platformEventStore,
      },
      presentation,
      nowISO: NOW_ISO,
      businessId: this.workspaceId,
      subjectTypes: PM_SUBJECT_TYPES,
      checklistComplete,
    } as Parameters<typeof buildExecutiveWorkspaceHomeView>[0]);
  }

  loadBusinessOperatingHomeViewModel() {
    const stack = this.connected.operatingStack ?? this.connected.ctx;
    const presentation =
      this.connected.installationResult?.executiveExperience?.dashboardPresentation ??
      this.connected.installationResult?.dashboardPresentation ??
      {};
    return buildBusinessOperatingHomeView({
      ctx: {
        businessSubjectRuntime: stack?.businessSubjectRuntime ?? this.connected.ctx?.businessSubjectRuntime,
        businessGraphRuntime: stack?.businessGraphRuntime ?? this.connected.ctx?.businessGraphRuntime,
        requestRuntime: this.requestRuntime,
        workRuntime: this.workRuntime,
        interactionRuntime: stack?.interactionRuntime ?? this.connected.ctx?.interactionRuntime,
        communicationRuntime: this.communicationRuntime,
        teamRuntime: this.teamRuntime,
        approvalRuntime: stack?.approvalRuntime ?? this.connected.ctx?.approvalRuntime,
        automationRuntime: stack?.automationRuntime ?? this.connected.ctx?.automationRuntime,
      },
      presentation,
      nowISO: NOW_ISO,
      businessId: this.workspaceId,
      subjectTypes: PM_SUBJECT_TYPES,
      readinessReport: this.connected.readinessReport,
      connectedSystemsSnapshot: this.connected.connectedSystemsSnapshot,
      employeeReadinessReport: this.connected.employeeReadinessReport,
    } as Parameters<typeof buildBusinessOperatingHomeView>[0]);
  }

  async createBusinessSubject(
    input: {
      subjectType: string;
      displayName: string;
      address?: string;
      keyAttributes?: Record<string, unknown>;
      externalReferences?: string[];
    },
    nowISO?: string,
  ) {
    const stack = this.connected.operatingStack;
    if (!stack?.businessSubjectRuntime) {
      throw new Error("Business subjects are not available for this workspace.");
    }

    const keyAttributes = { ...(input.keyAttributes ?? {}) };
    if (input.address) keyAttributes.address = input.address;

    const subject = new RecordBusinessSubjectService().execute({
      businessSubjectRuntime: stack.businessSubjectRuntime,
      workspaceId: this.workspaceId,
      subjectInput: {
        subjectType: input.subjectType,
        displayName: input.displayName,
        keyAttributes,
        externalReferences: input.externalReferences ?? [],
      },
      nowISO: nowISO ?? NOW_ISO,
      source: "workspace_service",
    } as Parameters<RecordBusinessSubjectService["execute"]>[0]);

    await persistAffectedRuntimes({
      workspaceId: this.workspaceId,
      stack,
      integrationPlatform: this.connected.integrationPlatform,
      kinds: [RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT],
    });

    return subject;
  }

  hasProspectInquiry() {
    return (this.requestRuntime.getRequests?.() ?? []).some(
      (r: { requestType?: string }) => String(r.requestType) === "PROSPECT_INQUIRY",
    );
  }

  getResidentProspectCoordinatorReadiness() {
    return getDigitalEmployeeReadinessEntry(
      this.connected.employeeReadinessReport,
      PM_RESIDENT_PROSPECT_COORDINATOR_ID,
    );
  }

  isResidentProspectCoordinatorReady() {
    return isDigitalEmployeeOperationalReady(this.getResidentProspectCoordinatorReadiness());
  }

  loadBusinessHomeViewModel({
    activeKnowledgeDocumentCount = null,
    teamInviteChecklistComplete = null,
  }: {
    activeKnowledgeDocumentCount?: number | null;
    teamInviteChecklistComplete?: boolean | null;
  } = {}) {
    const identity = this.connected.identityViewModel ?? {};
    const ctx = this.connected.ctx;
    const isDemo = Boolean(identity.demoConfigurationId);
    const knowledgeCount = activeKnowledgeDocumentCount ?? ctx.companyRuntime.getKnowledgeRepository?.()?.items?.length ?? 0;
    const connections = this.connected.connectedSystemsSnapshot?.connections ?? [];
    const emailConnected = connections.some(
      (c: { id?: string; status?: string }) =>
        String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
    );
    const softwareConnected = connections.some(
      (c: { id?: string; status?: string }) =>
        String(c.id) !== "business_email" && String(c.status).toUpperCase() === "CONNECTED",
    );
    const prospectInquiryComplete = this.hasProspectInquiry();
    const coordinatorReady = this.isResidentProspectCoordinatorReady();
    const prerequisitesForProspect = knowledgeCount > 0 && emailConnected;

    const checklist = [
      {
        id: "team",
        title: "Invite your team",
        actionLabel: "Add people",
        href: `/b/${this.workspaceId}/team`,
        complete: teamInviteChecklistComplete ?? false,
      },
      {
        id: "knowledge",
        title: "Add business knowledge",
        actionLabel: "Add document",
        href: `/b/${this.workspaceId}/knowledge?add=1`,
        complete: knowledgeCount > 0,
      },
      {
        id: "email",
        title: "Connect your email",
        actionLabel: "Connect",
        href: `/b/${this.workspaceId}/integrations?focus=business_email`,
        complete: emailConnected,
      },
      ...(coordinatorReady || prerequisitesForProspect
        ? [
            {
              id: "prospect",
              title: "Send your first prospect response",
              actionLabel: "Add inquiry",
              href: `#prospect-inquiry`,
              complete: prospectInquiryComplete,
            },
          ]
        : []),
      {
        id: "software",
        title: "Connect your software",
        actionLabel: "Connect",
        href: `/b/${this.workspaceId}/integrations?focus=property_management_system`,
        complete: softwareConnected,
      },
    ];

    const checklistComplete = checklist.every((item) => item.complete);

    return {
      businessName: String(identity.businessName ?? "Your business"),
      isDemo,
      checklist,
      checklistComplete,
      showProspectInquiryForm: coordinatorReady && !prospectInquiryComplete,
      coordinatorReady,
      emailConnected,
      knowledgeCount,
      executive: this.loadExecutiveWorkspaceHomeViewModel({ checklistComplete }),
      operating: this.loadBusinessOperatingHomeViewModel(),
    };
  }
}
