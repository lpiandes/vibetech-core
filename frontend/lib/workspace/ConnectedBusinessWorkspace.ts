import { activateWorkspace } from "../../../backend/core/workspace/activation/activateWorkspace.js";

import type { CompanyWorkspaceRuntime } from "../../../backend/core/company/CompanyWorkspaceRuntime.js";
import type { BusinessGraphRuntime } from "../../../backend/core/business-graph/BusinessGraphRuntime.js";
import type { RequestRuntime } from "../../../backend/core/request/RequestRuntime.js";
import type { WorkRuntime } from "../../../backend/core/work/WorkRuntime.js";
import type { TeamRuntime } from "../../../backend/core/team/TeamRuntime.js";
import type { CapabilityRuntime } from "../../../backend/core/capabilities/runtime/CapabilityRuntime.js";
import type { CommunicationRuntime } from "../../../backend/core/communications/CommunicationRuntime.js";
import type { InteractionRuntime } from "../../../backend/core/interactions/InteractionRuntime.js";
import type { AutomationRuntime } from "../../../backend/core/automations/AutomationRuntime.js";
import type { ApprovalRuntime } from "../../../backend/core/approvals/ApprovalRuntime.js";
import type { PlatformEventStore } from "../../../backend/core/events/PlatformEventStore.js";
import type { AnalyticsRuntime } from "../../../backend/core/analytics/AnalyticsRuntime.js";
import type { BusinessSubjectRuntime } from "../../../backend/core/business-subject/BusinessSubjectRuntime.js";
import type { CommunicationPreferenceRuntime } from "../../../backend/core/communications/preferences/CommunicationPreferenceRuntime.js";
import type { SegmentDefinitionRuntime } from "../../../backend/core/segments/SegmentDefinitionRuntime.js";

export type WorkspaceActivationInput = {
  industryPackageId?: string | null;
  industryPackageVersion?: number | null;
  packageConfiguration?: Record<string, unknown>;
  demoConfigurationId?: string | null;
  companyId?: string | null;
  activatedAt?: string | null;
};

export type BusinessRuntimeContext = {
  nowISO: string;
  companyRuntime: CompanyWorkspaceRuntime;
  businessGraphRuntime: BusinessGraphRuntime;
  businessSubjectRuntime: BusinessSubjectRuntime;
  communicationPreferenceRuntime: CommunicationPreferenceRuntime;
  segmentDefinitionRuntime: SegmentDefinitionRuntime;
  requestRuntime: RequestRuntime;
  workRuntime: WorkRuntime;
  teamRuntime: TeamRuntime;
  capabilityRuntime: CapabilityRuntime;
  communicationRuntime: CommunicationRuntime;
  interactionRuntime: InteractionRuntime;
  automationRuntime: AutomationRuntime;
  approvalRuntime: ApprovalRuntime;
  platformEventStore: PlatformEventStore;
  analyticsRuntime: AnalyticsRuntime;
};

/**
 * Shared connected business composition for all executive OS surfaces.
 * Activation is explicit — Property Management only when industryPackageId is set.
 */
export class ConnectedBusinessWorkspace {
  public ctx: BusinessRuntimeContext;
  public activation: any;
  public installationResult: any;
  public readinessReport: any;
  public employeeReadinessReport: any;
  public employeeActivations: any;
  public connectedSystemsSnapshot: any;
  public pageLabels: any;
  public identityViewModel: any;
  public demoConfigurationResult: any;
  public demoBootstrap: any;
  public knowledgeReadinessReport: any;

  public integrationPlatform: any;
  public connectionDependencyProjection: any;
  public operationalBoundary: any;
  public operatingStack: any;
  public platformKnowledgeCoverage: any;

  constructor({
    nowISO,
    workspaceId,
    activation,
    runtimeSnapshots,
  }: {
    nowISO?: string;
    workspaceId?: string;
    activation?: WorkspaceActivationInput | null;
    runtimeSnapshots?: Record<string, unknown>;
  } = {}) {
    const result = activateWorkspace({
      nowISO,
      workspaceId,
      activation: activation ?? undefined,
      runtimeSnapshots,
    });
    this.ctx = result.ctx;
    this.activation = result.activation;
    this.installationResult = result.installationResult;
    this.readinessReport = result.readinessReport;
    this.employeeReadinessReport = result.employeeReadinessReport;
    this.employeeActivations = result.employeeActivations;
    this.connectedSystemsSnapshot = result.connectedSystemsSnapshot;
    this.pageLabels = result.pageLabels;
    this.identityViewModel = result.identityViewModel;
    this.demoConfigurationResult = result.demoConfigurationResult;
    this.demoBootstrap = result.demoBootstrap;
    this.knowledgeReadinessReport = result.knowledgeReadinessReport;
    this.integrationPlatform = result.integrationPlatform ?? null;
    this.connectionDependencyProjection = result.connectionDependencyProjection ?? null;
    this.operationalBoundary = (result as { operationalBoundary?: unknown }).operationalBoundary ?? null;
    this.operatingStack = (result as { operatingStack?: unknown }).operatingStack ?? null;
    this.platformKnowledgeCoverage = null;
  }
}
