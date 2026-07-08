import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { buildHorizonPropertiesDemoConfiguration } from "../../../industries/property-management/demo/HorizonPropertiesDemoConfig.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { composeBusinessCommandCenter } from "../command-center/BusinessCommandCenterComposer.js";
import { projectSegmentMembership } from "../segments/SegmentProjectionEngine.js";
import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import {
  bootstrapHorizonPropertiesDemo,
  runWebsiteInquiryOnWorkspace,
  runMissedCallOnWorkspace,
  runMissedCallSmsSuccessProof,
  verifyDemoConnectionSync,
} from "./HorizonPropertiesDemoBootstrap.js";

export const HORIZON_DEMO_FORM_SUBMISSION_ID = "form_sub_horizon_demo_1";
export const HORIZON_DEMO_MISSED_CALL_ID = "call_horizon_demo_1";
export const HORIZON_DEMO_PROSPECT_EMAIL = "taylor.brooks@example.com";
export const HORIZON_DEMO_PROSPECT_PHONE = "8605550199";
export const HORIZON_DEMO_SUBJECT_EXTERNAL_ID = "horizon_unit_2b";
export const HORIZON_DEMO_EXACT_QUALIFICATION_NOTE =
  "I am looking for a 2-bedroom near downtown and would like to tour Unit 2B this week.";

export function getHorizonTaylorPartyId() {
  return `party_${HORIZON_DEMO_PROSPECT_EMAIL.toLowerCase().replace(/[@.]/g, "_")}`;
}

export function getHorizonTaylorRequestId() {
  return `req_inbound_${HORIZON_DEMO_FORM_SUBMISSION_ID}`;
}

export function buildWebsiteFormPayload({ submissionId = HORIZON_DEMO_FORM_SUBMISSION_ID, nowISO } = {}) {
  return {
    formId: "horizon_inquiry",
    submissionId,
    name: "Taylor Brooks",
    email: HORIZON_DEMO_PROSPECT_EMAIL,
    phone: HORIZON_DEMO_PROSPECT_PHONE,
    source: "website",
    pageUrl: "/units/2b",
    objectId: HORIZON_DEMO_SUBJECT_EXTERNAL_ID,
    subjectType: "unit",
    subjectDisplayName: "Unit 2B — Harbor View",
    message: "Interested in scheduling a showing for Unit 2B.",
    qualification: {
      intent: "leasing",
      timeline: "this week",
      priceRange: "$1,800–$2,200",
    },
    submittedAt: nowISO,
  };
}

export function buildMissedCallPayload({ callId = HORIZON_DEMO_MISSED_CALL_ID, nowISO } = {}) {
  return {
    callId,
    disposition: "missed_call",
    from: HORIZON_DEMO_PROSPECT_PHONE,
    callerName: "Taylor Brooks",
    occurredAt: nowISO,
    voicemailText: "Hi, I called about Unit 2B.",
  };
}

export function buildOperatingLoopWorkspace({
  workspaceId = "ws_horizon_op_loop",
  nowISO = "2026-07-01T00:00:00.000Z",
} = {}) {
  const demoConfiguration = buildHorizonPropertiesDemoConfiguration();
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO,
    workspaceId,
    installPackage: true,
    demoConfiguration,
  });

  installPackageEmployees({
    employeeDefinitions: stack.installationResult?.employeeDefinitions ?? [],
    humanTeamMembers: demoConfiguration.humanTeamMembers ?? [],
    teamRuntime: stack.teamRuntime,
    nowISO,
  });

  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });

  return { stack, integrationPlatform, demoConfiguration };
}

export async function runWebsiteInquiryOperatingLoop({
  workspaceId = "ws_horizon_op_loop",
  nowISO = "2026-07-01T00:00:00.000Z",
} = {}) {
  const { stack, integrationPlatform } = buildOperatingLoopWorkspace({ workspaceId, nowISO });
  const { configureHorizonPropertiesWorkspace } = await import("./HorizonPropertiesWorkspaceConfigurator.js");
  configureHorizonPropertiesWorkspace({ stack, nowISO, includeSecondaryParties: false });
  verifyDemoConnectionSync({
    connectionService: integrationPlatform.connectionService,
    connectionRuntime: integrationPlatform.connectionRuntime,
    workspaceId,
    connectionType: "business_email",
    providerType: "provider_mock_email",
    displayName: "Business Email",
    nowISO,
  });

  const primary = runWebsiteInquiryOnWorkspace({ stack, integrationPlatform, workspaceId, nowISO });
  const compositions = composeOperatingLoopProof({ stack, integrationPlatform, partyId: primary.partyId, nowISO });

  return {
    stack,
    integrationPlatform,
    ingest: primary.ingest,
    partyId: primary.partyId,
    requestId: primary.requestId,
    subjectId: primary.subjectId,
    interactionId: primary.interactionId,
    acknowledgment: primary.acknowledgment,
    ...compositions,
  };
}

export async function runMissedCallOperatingLoop({
  workspaceId = "ws_horizon_op_loop_missed",
  nowISO = "2026-07-01T00:00:00.000Z",
  afterWebsiteLoop = false,
  websiteState = null,
} = {}) {
  let stack;
  let integrationPlatform;
  if (afterWebsiteLoop && websiteState) {
    stack = websiteState.stack;
    integrationPlatform = websiteState.integrationPlatform;
  } else {
    const built = buildOperatingLoopWorkspace({ workspaceId, nowISO });
    stack = built.stack;
    integrationPlatform = built.integrationPlatform;
  }

  const missed = runMissedCallOnWorkspace({ stack, integrationPlatform, workspaceId, nowISO, verifySms: false });
  const smsConnection = integrationPlatform.connectionRuntime
    .getConnections()
    .find((c) => c.connectionType === "sms_channel");
  const smsBlocked =
    !smsConnection || smsConnection.status !== CONNECTION_STATUSES.CONNECTED
      ? { status: "blocked", reason: `connection_not_ready:${smsConnection?.status ?? "missing"}` }
      : null;

  return {
    stack,
    integrationPlatform,
    ingest: missed.ingest,
    partyId: missed.partyId,
    smsBlocked,
    smsAttempt: null,
    partyCount: missed.partyCount,
  };
}

export function composeOperatingLoopProof({ stack, integrationPlatform, partyId, nowISO }) {
  const engagementAdapter = new EngagementViewAdapter({ nowISO });
  const engagement = engagementAdapter.translate({
    partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    platformEventStore: stack.store,
    analyticsRuntime: stack.analyticsRuntime,
  });

  const commandCenter = composeBusinessCommandCenter({
    identityViewModel: {
      businessName: "Horizon Properties",
      workspaceId: stack.workspaceId,
      operatingSystemTitle: "Property Management Operating System",
    },
    readinessReport: { readinessStatus: "READY", summary: { automationsActive: 5 } },
    connectedSystemsSnapshot: {
      connections: integrationPlatform.connectionRuntime.getConnections().map((c) => ({
        id: c.id,
        displayName: c.displayName,
        status: c.status === CONNECTION_STATUSES.CONNECTED ? "CONNECTED" : c.status,
        requirementLevel: c.connectionType === "business_email" ? "required" : "optional",
      })),
    },
    installationResult: stack.installationResult,
    nowISO,
    ctx: stack,
  });

  const audiences = stack.segmentDefinitionRuntime.getDefinitions().map((definition) => {
    const projection = projectSegmentMembership({
      segmentDefinition: definition,
      businessGraphRuntime: stack.businessGraphRuntime,
      requestRuntime: stack.requestRuntime,
      interactionRuntime: stack.interactionRuntime,
      businessSubjectRuntime: stack.businessSubjectRuntime,
      preferenceRuntime: stack.communicationPreferenceRuntime,
      contactableOnly: false,
    });
    const members = projection.members.map((member) => {
      const emailOk = checkCommunicationPermitted({
        preferenceRuntime: stack.communicationPreferenceRuntime,
        partyId: member.entityId,
        channel: "email",
      });
      const smsOk = checkCommunicationPermitted({
        preferenceRuntime: stack.communicationPreferenceRuntime,
        partyId: member.entityId,
        channel: "sms",
      });
      const explanation = projection.explanations.find((e) => e.entityId === member.entityId);
      return {
        ...member,
        matched: true,
        reasons: explanation?.reasons ?? [],
        contactable: { email: emailOk.permitted, sms: smsOk.permitted },
      };
    });
    return {
      segmentId: definition.id,
      segmentName: definition.name,
      memberCount: members.length,
      members,
    };
  });

  return { engagement, commandCenter, audiences };
}
