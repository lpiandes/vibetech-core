import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { buildEmptyCompanySeed } from "../company/buildEmptyCompanySeed.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { WorkRuntime } from "../work/WorkRuntime.js";
import { TeamRuntime } from "../team/TeamRuntime.js";
import { CapabilityRuntime } from "../capabilities/runtime/CapabilityRuntime.js";
import { AnalyticsRuntime } from "../analytics/AnalyticsRuntime.js";
import { CommunicationRuntime } from "../communications/CommunicationRuntime.js";
import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { InteractionRuntime } from "../interactions/InteractionRuntime.js";
import { BusinessSubjectRuntime } from "../business-subject/BusinessSubjectRuntime.js";
import { CommunicationPreferenceRuntime } from "../communications/preferences/CommunicationPreferenceRuntime.js";
import { SegmentDefinitionRuntime } from "../segments/SegmentDefinitionRuntime.js";
import { InboundBusinessOrchestrationService } from "../integrations/inbound/InboundBusinessOrchestrationService.js";
import { createInboundEventSubscriber } from "../integrations/inbound/InboundEventSubscriber.js";
import { SEGMENT_EVENT_TYPES } from "../segments/SegmentDefinition.js";
import { AutomationRuntime } from "../automations/AutomationRuntime.js";
import { AutomationRuleEngine } from "../automations/engine/AutomationRuleEngine.js";
import { ApprovalRuntime } from "../approvals/ApprovalRuntime.js";

import { PlatformEventStore } from "../events/PlatformEventStore.js";
import { PlatformEventBus } from "../events/bus/PlatformEventBus.js";
import { PlatformEventPublisherRegistry } from "../events/publishing/PlatformEventPublisherRegistry.js";
import { PlatformEventPublisher } from "../events/publishing/PlatformEventPublisher.js";

import { REQUEST_OS_PUBLISHER_ID } from "../request/events/RequestPlatformEventDefaults.js";
import { RequestPlatformEventPublisher } from "../request/events/RequestPlatformEventPublisher.js";
import { WORK_OS_PUBLISHER_ID } from "../work/events/WorkPlatformEventDefaults.js";
import { WorkPlatformEventPublisher } from "../work/events/WorkPlatformEventPublisher.js";
import { INTERACTION_OS_PUBLISHER_ID } from "../interactions/events/InteractionPlatformEventDefaults.js";
import { InteractionPlatformEventPublisher } from "../interactions/events/InteractionPlatformEventPublisher.js";
import { AUTOMATION_OS_PUBLISHER_ID } from "../automations/events/AutomationPlatformEventDefaults.js";
import { AutomationPlatformEventPublisher } from "../automations/events/AutomationPlatformEventPublisher.js";
import { APPROVAL_OS_PUBLISHER_ID } from "../approvals/events/ApprovalPlatformEventDefaults.js";
import { ApprovalPlatformEventPublisher } from "../approvals/events/ApprovalPlatformEventPublisher.js";

import { createPlatformEventSubscriberFromHandler } from "../events/subscribers/PlatformEventSubscriberFactory.js";
import { requestToWorkHandle } from "../pipelines/request-to-work/RequestToWorkSubscriber.js";
import { createTeamAssignmentSubscriber } from "../pipelines/work-assignment/TeamAssignmentSubscriber.js";
import { createTeamWorkloadProjectionSubscriber } from "../pipelines/work-assignment/TeamWorkloadProjectionSubscriber.js";
import { createAnalyticsEventSubscriber } from "../analytics/subscribers/AnalyticsEventSubscriber.js";
import { createAutomationEventSubscriber } from "../automations/subscribers/AutomationEventSubscriber.js";
import { createAutomationApprovalEventSubscriber } from "../automations/subscribers/AutomationApprovalEventSubscriber.js";
import { createDefaultAutomationActionExecutorRegistry } from "../automations/actions/AutomationActionExecutorRegistry.js";
import { wireIntegrationLifecycleAnalytics } from "../analytics/subscribers/wireIntegrationLifecycleAnalytics.js";
import { INTEGRATION_ANALYTICS_EVENTS } from "../analytics/subscribers/wireIntegrationLifecycleAnalytics.js";

import { IndustryPackageInstaller } from "../industries/IndustryPackageInstaller.js";
import { IndustryPackageInstallationRuntime } from "../industries/IndustryPackageInstallationRuntime.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyTeamSeed } from "../team/TeamBuilder.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

const ANALYTICS_EVENTS = [
  "REQUEST_RECEIVED",
  "REQUEST_CONVERTED",
  "WORK_CREATED",
  "WORK_ASSIGNED",
  "INTERACTION_RECORDED",
  "INTERACTION_OUTCOME_RECORDED",
  "FOLLOW_UP_SCHEDULED",
  "AUTOMATION_RUN_STARTED",
  "AUTOMATION_RUN_COMPLETED",
  "AUTOMATION_RUN_FAILED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
  "COMMUNICATION_SENT",
  ...INTEGRATION_ANALYTICS_EVENTS,
];

export function buildPropertyManagementWorkspaceStack({
  nowISO = "2026-07-01T00:00:00.000Z",
  workspaceId = "ws_pm_test",
  installPackage = true,
  demoConfiguration = {},
  runtimeSnapshots = {},
} = {}) {
  const snap = (kind) => runtimeSnapshots?.[kind] ?? null;
  const companyName = String(demoConfiguration?.companyName ?? "New Business");
  const companyRuntime = new CompanyWorkspaceRuntime({
    seed: () =>
      buildEmptyCompanySeed({
        companyName,
        industry: "Property Management",
        nowISO,
      }),
  });
  const requestRuntime = new RequestRuntime({
    nowISO,
    seed: snap(RUNTIME_SNAPSHOT_KINDS.REQUEST) ? () => snap(RUNTIME_SNAPSHOT_KINDS.REQUEST) : undefined,
  });
  const workRuntime = new WorkRuntime({
    nowISO,
    seed: snap(RUNTIME_SNAPSHOT_KINDS.WORK) ? () => snap(RUNTIME_SNAPSHOT_KINDS.WORK) : undefined,
  });
  const teamRuntime = new TeamRuntime({ seed: buildEmptyTeamSeed });
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const analyticsRuntime = new AnalyticsRuntime({
    seed: snap(RUNTIME_SNAPSHOT_KINDS.ANALYTICS) ? () => snap(RUNTIME_SNAPSHOT_KINDS.ANALYTICS) : null,
    nowISO,
  });
  const communicationRuntime = new CommunicationRuntime({
    nowISO,
    seed: snap(RUNTIME_SNAPSHOT_KINDS.COMMUNICATION) ? () => snap(RUNTIME_SNAPSHOT_KINDS.COMMUNICATION) : undefined,
  });
  const businessGraphRuntime = new BusinessGraphRuntime({
    seed: snap(RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH) ? () => snap(RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH) : undefined,
  });
  const businessSubjectRuntime = new BusinessSubjectRuntime({
    seed: snap(RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT)
      ? () => snap(RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT)
      : undefined,
  });
  const communicationPreferenceRuntime = new CommunicationPreferenceRuntime({
    seed: snap(RUNTIME_SNAPSHOT_KINDS.COMMUNICATION_PREFERENCE)
      ? () => snap(RUNTIME_SNAPSHOT_KINDS.COMMUNICATION_PREFERENCE)
      : undefined,
  });
  const segmentDefinitionRuntime = new SegmentDefinitionRuntime();
  const interactionRuntime = new InteractionRuntime({
    seed: snap(RUNTIME_SNAPSHOT_KINDS.INTERACTION) ? () => snap(RUNTIME_SNAPSHOT_KINDS.INTERACTION) : undefined,
  });
  const automationRuntime = new AutomationRuntime({ nowISO });
  const automationRuleEngine = new AutomationRuleEngine();
  const approvalRuntime = new ApprovalRuntime({ nowISO });
  const installationRuntime = new IndustryPackageInstallationRuntime();

  const store = new PlatformEventStore({ nowISO });
  const bus = new PlatformEventBus({ nowISO });
  const publisherRegistry = new PlatformEventPublisherRegistry({
    publishers: [
      { id: REQUEST_OS_PUBLISHER_ID, name: "Request OS", operatingSystem: "request_os", allowedEventTypes: ["REQUEST_RECEIVED", "REQUEST_CONVERTED"], version: 1, metadata: {} },
      { id: WORK_OS_PUBLISHER_ID, name: "Work OS", operatingSystem: "work_os", allowedEventTypes: ["WORK_CREATED", "WORK_ASSIGNED"], version: 1, metadata: {} },
      { id: INTERACTION_OS_PUBLISHER_ID, name: "Interaction OS", operatingSystem: "interaction_os", allowedEventTypes: ["INTERACTION_RECORDED", "INTERACTION_OUTCOME_RECORDED", "FOLLOW_UP_SCHEDULED"], version: 1, metadata: {} },
      { id: AUTOMATION_OS_PUBLISHER_ID, name: "Automation OS", operatingSystem: "automation_os", allowedEventTypes: ["AUTOMATION_RUN_STARTED", "AUTOMATION_RUN_COMPLETED", "AUTOMATION_RUN_FAILED"], version: 1, metadata: {} },
      { id: APPROVAL_OS_PUBLISHER_ID, name: "Approval OS", operatingSystem: "approval_os", allowedEventTypes: ["APPROVAL_REQUESTED", "APPROVAL_GRANTED", "APPROVAL_REJECTED"], version: 1, metadata: {} },
    ],
  });

  const requestPublisher = new PlatformEventPublisher({ publisherRegistry, publisherId: REQUEST_OS_PUBLISHER_ID, store, bus, nowISO });
  const workPublisher = new PlatformEventPublisher({ publisherRegistry, publisherId: WORK_OS_PUBLISHER_ID, store, bus, nowISO });
  const interactionPublisher = new PlatformEventPublisher({ publisherRegistry, publisherId: INTERACTION_OS_PUBLISHER_ID, store, bus, nowISO });
  const automationPublisher = new PlatformEventPublisher({ publisherRegistry, publisherId: AUTOMATION_OS_PUBLISHER_ID, store, bus, nowISO });
  const approvalPublisher = new PlatformEventPublisher({ publisherRegistry, publisherId: APPROVAL_OS_PUBLISHER_ID, store, bus, nowISO });

  const osRequestPublisher = new RequestPlatformEventPublisher({ platformEventPublisher: requestPublisher });
  const osWorkPublisher = new WorkPlatformEventPublisher({ platformEventPublisher: workPublisher });
  const osInteractionPublisher = new InteractionPlatformEventPublisher({ platformEventPublisher: interactionPublisher });
  const automationPlatformEventPublisher = new AutomationPlatformEventPublisher({ platformEventPublisher: automationPublisher });
  const approvalPlatformEventPublisher = new ApprovalPlatformEventPublisher({ platformEventPublisher: approvalPublisher });

  const actionExecutorRegistry = createDefaultAutomationActionExecutorRegistry({ workPlatformEventPublisher: osWorkPublisher });

  const analyticsSubscriber = createAnalyticsEventSubscriber({
    id: "sub_analytics_pm",
    analyticsRuntime,
    supportedEvents: ANALYTICS_EVENTS,
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber: createPlatformEventSubscriberFromHandler({
    id: "sub_req_to_work_pm",
    name: "RequestToWorkSubscriber (PM)",
    operatingSystem: "request_to_work_pipeline",
    supportedEvents: ["REQUEST_CONVERTED"],
    handler: (e) => requestToWorkHandle(e, { workRuntime }),
  }) });
  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "WORK_CREATED", subscriber: createTeamAssignmentSubscriber({ workRuntime, teamRuntime, capabilityRuntime, workAssignmentPlatformPublisher: osWorkPublisher }) });
  bus.subscribe({ eventType: "WORK_CREATED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "WORK_ASSIGNED", subscriber: createTeamWorkloadProjectionSubscriber({ teamRuntime }) });
  bus.subscribe({ eventType: "WORK_ASSIGNED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "INTERACTION_RECORDED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "INTERACTION_OUTCOME_RECORDED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "FOLLOW_UP_SCHEDULED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "AUTOMATION_RUN_STARTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "AUTOMATION_RUN_COMPLETED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "AUTOMATION_RUN_FAILED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "APPROVAL_REQUESTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "APPROVAL_GRANTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "APPROVAL_REJECTED", subscriber: analyticsSubscriber });
  bus.subscribe({ eventType: "COMMUNICATION_SENT", subscriber: analyticsSubscriber });
  wireIntegrationLifecycleAnalytics({ bus, analyticsSubscriber });

  const automationEventSubscriber = createAutomationEventSubscriber({
    automationRuntime,
    automationRuleEngine,
    actionExecutorRegistry,
    interactionRuntime,
    workRuntime,
    automationPlatformEventPublisher,
    approvalRuntime,
    approvalPlatformEventPublisher,
  });
  bus.subscribe({ eventType: "INTERACTION_OUTCOME_RECORDED", subscriber: automationEventSubscriber });

  const approvalAutomationSubscriber = createAutomationApprovalEventSubscriber({
    automationRuntime,
    automationRuleEngine,
    actionExecutorRegistry,
    interactionRuntime,
    workRuntime,
    automationPlatformEventPublisher,
    approvalRuntime,
    approvalPlatformEventPublisher,
  });
  bus.subscribe({ eventType: "APPROVAL_GRANTED", subscriber: approvalAutomationSubscriber });
  bus.subscribe({ eventType: "APPROVAL_REJECTED", subscriber: approvalAutomationSubscriber });

  let installationResult = null;
  if (installPackage) {
    const demoCfg = demoConfiguration ?? {};
    const installer = new IndustryPackageInstaller({ installationRuntime });
    installationResult = installer.install({
      industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
      workspaceId,
      configuration: demoCfg,
      companyRuntime,
      capabilityRuntime,
      automationRuntime,
      nowISO,
      automationConfigurationOverrides: {
        pm_prospect_follow_up: { assignedTo: demoCfg.automationAssignedTo?.prospect ?? "unassigned" },
        pm_showing_coordination: { assignedTo: demoCfg.automationAssignedTo?.showing ?? "unassigned" },
        pm_maintenance_coordination: { assignedTo: demoCfg.automationAssignedTo?.maintenance ?? "unassigned" },
        pm_owner_approval: { assignedTo: demoCfg.automationAssignedTo?.owner ?? "unassigned" },
        pm_vendor_action: { assignedTo: demoCfg.automationAssignedTo?.vendor ?? "unassigned" },
      },
    });
  }

  if (installationResult?.segmentTemplates?.length) {
    for (const template of installationResult.segmentTemplates) {
      segmentDefinitionRuntime.applyEvent({
        id: `evt_seg_reg_${template.id}`,
        timestampISO: nowISO,
        type: SEGMENT_EVENT_TYPES.SEGMENT_REGISTERED,
        source: "package_install",
        payload: {
          definition: {
            ...template,
            workspaceId,
            status: "active",
            metadata: {},
          },
        },
      });
    }
  }

  const inboundOrchestrator = new InboundBusinessOrchestrationService({
    workspaceId,
    businessGraphRuntime,
    businessSubjectRuntime,
    requestRuntime,
    interactionRuntime,
    installationResult,
    requestPlatformEventPublisher: osRequestPublisher,
    nowISO,
  });
  bus.subscribe({
    eventType: "INBOUND_EVENT_RECEIVED",
    subscriber: createInboundEventSubscriber({ inboundOrchestrator }),
  });

  return {
    nowISO,
    workspaceId,
    companyRuntime,
    requestRuntime,
    workRuntime,
    teamRuntime,
    capabilityRuntime,
    analyticsRuntime,
    communicationRuntime,
    businessGraphRuntime,
    businessSubjectRuntime,
    communicationPreferenceRuntime,
    segmentDefinitionRuntime,
    interactionRuntime,
    automationRuntime,
    approvalRuntime,
    installationRuntime,
    installationResult,
    actionExecutorRegistry,
    store,
    bus,
    osRequestPublisher,
    osWorkPublisher,
    osInteractionPublisher,
    automationPlatformEventPublisher,
    approvalPlatformEventPublisher,
  };
}
