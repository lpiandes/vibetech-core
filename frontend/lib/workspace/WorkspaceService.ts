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
import { MissionControlGenerator } from "../../../backend/core/mission-control/MissionControlGenerator.js";
import { MissionControlViewAdapter } from "../../../backend/core/mission-control/views/MissionControlViewAdapter.js";
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
import {
  getDigitalEmployeeReadinessEntry,
  isDigitalEmployeeOperationalReady,
} from "../../../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

export const PM_RESIDENT_PROSPECT_COORDINATOR_ID = "pm_resident_prospect_coordinator";
export { PM_MAINTENANCE_COORDINATOR_ID };

const PM_SUBJECT_TYPES = ["property", "listing", "unit"];

export const SELECTED_WORKSPACE_COOKIE_NAME = "vibetech_workspace_id";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

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

    return attachProductContext(
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
  }

  loadAttentionViewModel() {
    const mission = this.loadMissionControlViewModel();
    return {
      ...mission,
      pageTitle: this.connected.pageLabels?.attention ?? "Needs decision",
      attentionItems: mission.needsYourAttention ?? [],
    };
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
    return attachProductContext(index, this.connected);
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
