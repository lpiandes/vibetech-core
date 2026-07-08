import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runWebsiteInquiryOperatingLoop,
  runMissedCallOperatingLoop,
  buildOperatingLoopWorkspace,
  HORIZON_DEMO_FORM_SUBMISSION_ID,
  HORIZON_DEMO_EXACT_QUALIFICATION_NOTE,
  HORIZON_DEMO_PROSPECT_EMAIL,
} from "./FirstClientOperatingLoopRunner.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { assertNoRawEventNamesInPresentation } from "../presentation/BusinessActivityLanguageMapper.js";
import { EXTERNAL_ACTION_STATUSES } from "../integrations/actions/ExternalActionRequest.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { createCommunicationPreference } from "../communications/preferences/CommunicationPreference.js";
import { INTEGRATION_CAPABILITIES } from "../integrations/capabilities/IntegrationCapability.js";
import { createExternalActionRequest } from "../integrations/actions/ExternalActionRequest.js";
import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { BusinessSubjectRuntime } from "../business-subject/BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { createBusinessSubject } from "../business-subject/BusinessSubject.js";
import { CommunicationPreferenceRuntime } from "../communications/preferences/CommunicationPreferenceRuntime.js";
import { SegmentDefinitionRuntime } from "../segments/SegmentDefinitionRuntime.js";
import { InboundBusinessOrchestrationService } from "../integrations/inbound/InboundBusinessOrchestrationService.js";
import { createNormalizedInboundEvent } from "../integrations/inbound/NormalizedInboundEvent.js";
import { PROFESSIONAL_SERVICES_FIXTURE_PACKAGE } from "../../../industries/fixtures/professional-services/ProfessionalServicesFixturePackage.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { InteractionRuntime } from "../interactions/InteractionRuntime.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("PRIMARY: website inquiry operating loop end-to-end", async () => {
  const result = await runWebsiteInquiryOperatingLoop({ workspaceId: "ws_epic22_primary", nowISO: NOW });

  assert.equal(result.ingest.accepted, true);
  assert.equal(result.ingest.duplicate, false);

  const dup = result.integrationPlatform.webhookIngressService.ingest({
    providerId: "provider_mock_form",
    payload: {
      formId: "horizon_inquiry",
      submissionId: HORIZON_DEMO_FORM_SUBMISSION_ID,
      email: HORIZON_DEMO_PROSPECT_EMAIL,
    },
  });
  assert.equal(dup.duplicate, true);
  assert.equal(result.stack.businessGraphRuntime.getParties().length, 1);

  const request = result.stack.requestRuntime.getRequest(result.requestId);
  assert.ok(request);
  assert.equal(request.inboundAttribution?.landingPage, "/units/2b");
  assert.equal(request.subjectRefs?.[0]?.entityId, "subj_horizon_unit_2b");
  assert.equal(request.metadata?.qualification?.intent, "leasing");

  assert.equal(result.acknowledgment.status, "sent");

  const interaction = result.stack.interactionRuntime.getInteraction(result.interactionId);
  assert.equal(interaction.notes[0].text, HORIZON_DEMO_EXACT_QUALIFICATION_NOTE);
  assert.equal(interaction.outcome, "showing_requested");

  const runs = result.stack.automationRuntime.getRuns();
  assert.ok(runs.length >= 1, "automation run should occur");

  const showingWork = result.stack.workRuntime
    .getWorkItems()
    .find((w) => String(w.workType) === "showing_coordination");
  assert.ok(showingWork, "showing coordination work created");
  assert.ok(showingWork.assignedTo, "work assigned");
  const member = result.stack.teamRuntime.getMembers().find((m) => String(m.id) === String(showingWork.assignedTo));
  assert.ok(member, "assigned team member exists");

  const interestedAudience = result.audiences.find((a) => a.segmentId === "interested_in_subject");
  assert.ok(interestedAudience?.memberCount >= 1);
  assert.ok(interestedAudience.members[0].reasons.length >= 1);

  assert.equal(result.engagement.partyId, result.partyId);
  assert.ok(result.engagement.subjects.length >= 1);
  assert.ok(result.engagement.interactions.some((i) => i.notes?.[0]?.text === HORIZON_DEMO_EXACT_QUALIFICATION_NOTE));
  assert.ok(result.engagement.segmentMemberships.length >= 1);

  const activity = result.commandCenter.businessActivity ?? [];
  for (const item of activity) {
    assert.equal(assertNoRawEventNamesInPresentation(item), true);
  }
});

test("MISSED CALL: same party resolution and SMS blocked when disconnected", async () => {
  const website = await runWebsiteInquiryOperatingLoop({ workspaceId: "ws_epic22_missed", nowISO: NOW });
  const missed = await runMissedCallOperatingLoop({
    afterWebsiteLoop: true,
    websiteState: website,
    nowISO: "2026-07-01T01:00:00.000Z",
  });

  assert.equal(missed.ingest.accepted, true);
  assert.equal(missed.partyCount, 1);
  assert.equal(missed.partyId, website.partyId);
  assert.ok(missed.smsBlocked || missed.smsAttempt?.status === EXTERNAL_ACTION_STATUSES.BLOCKED);
});

test("PREFERENCE ENFORCEMENT: opt-out blocks SEND_EMAIL", async () => {
  const { stack, integrationPlatform } = buildOperatingLoopWorkspace({
    workspaceId: "ws_epic22_pref",
    nowISO: NOW,
  });
  const conn = integrationPlatform.connectionRuntime.getConnections().find((c) => c.connectionType === "business_email");
  integrationPlatform.connectionService.attachMockCredentials({ connectionId: conn.id, providerType: "provider_mock_email" });
  await integrationPlatform.connectionService.verifyConnection({
    connectionId: conn.id,
    credentialResolver: integrationPlatform.credentialResolver,
  });

  stack.communicationPreferenceRuntime.applyEvent({
    id: "evt_pref_opt_out",
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "test",
    payload: {
      preference: createCommunicationPreference({
        id: "pref_opt_out",
        partyId: "party_blocked",
        workspaceId: stack.workspaceId,
        channel: "email",
        status: "opt_out",
        recordedAt: NOW,
      }),
    },
  });

  const blocked = await integrationPlatform.actionOrchestrator.execute(
    createExternalActionRequest({
      id: "action_blocked_email",
      workspaceId: stack.workspaceId,
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      connectionId: conn.id,
      parameters: { partyId: "party_blocked" },
      idempotencyKey: "blocked_email_key",
    }),
  );
  assert.equal(blocked.status, EXTERNAL_ACTION_STATUSES.BLOCKED);
  assert.match(String(blocked.error), /communication_not_permitted/);
});

test("WORKSPACE ISOLATION: Horizon data does not leak", async () => {
  const horizon = await runWebsiteInquiryOperatingLoop({ workspaceId: "ws_horizon_isolated", nowISO: NOW });
  const otherStack = buildPropertyManagementWorkspaceStack({
    workspaceId: "ws_other_client",
    nowISO: NOW,
    installPackage: true,
  });

  assert.equal(otherStack.businessGraphRuntime.getParties().length, 0);
  assert.equal(otherStack.requestRuntime.getRequests().length, 0);
  assert.ok(horizon.stack.businessGraphRuntime.getParties().length >= 1);
});

test("UNIVERSALITY: professional services fixture inbound + subject linkage", () => {
  const graph = new BusinessGraphRuntime();
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const interactions = new InteractionRuntime();
  const installationResult = {
    inboundRouting: [{ eventKind: "form_submission", requestType: "CLIENT_INTAKE" }],
    segmentTemplates: PROFESSIONAL_SERVICES_FIXTURE_PACKAGE.segmentTemplates,
  };

  subjects.applyEvent({
    id: "evt_subj_ps",
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: createBusinessSubject({
        id: "subj_engagement_x",
        workspaceId: "ws_ps_fixture",
        subjectType: "engagement",
        displayName: "Engagement X",
        externalReferences: ["engagement_x"],
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });

  const orchestrator = new InboundBusinessOrchestrationService({
    workspaceId: "ws_ps_fixture",
    businessGraphRuntime: graph,
    businessSubjectRuntime: subjects,
    requestRuntime: requests,
    interactionRuntime: interactions,
    installationResult,
    nowISO: NOW,
  });

  orchestrator.handleNormalizedEvent(
    createNormalizedInboundEvent({
      externalEventId: "ps_form_1",
      providerId: "provider_mock_form",
      workspaceId: "ws_ps_fixture",
      channel: "website",
      eventKind: "form_submission",
      occurredAt: NOW,
      identityHints: { name: "Client", email: "client@example.com" },
      attribution: { externalObjectId: "engagement_x", subjectType: "engagement" },
      payloadFacts: { message: "Interested in service engagement" },
    }),
  );

  assert.equal(requests.getRequests()[0].requestType, "CLIENT_INTAKE");
  assert.equal(subjects.getSubjects().length, 1);
  assert.equal(graph.getParties().length, 1);
});
