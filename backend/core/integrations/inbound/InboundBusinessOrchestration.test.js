import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { BusinessSubjectRuntime } from "../../business-subject/BusinessSubjectRuntime.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { InteractionRuntime } from "../../interactions/InteractionRuntime.js";
import { InboundBusinessOrchestrationService } from "./InboundBusinessOrchestrationService.js";
import { createNormalizedInboundEvent } from "./NormalizedInboundEvent.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("InboundBusinessOrchestrationService: form submission creates party, subject, request", () => {
  const graph = new BusinessGraphRuntime();
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const interactions = new InteractionRuntime();

  const orchestrator = new InboundBusinessOrchestrationService({
    workspaceId: "ws_test",
    businessGraphRuntime: graph,
    businessSubjectRuntime: subjects,
    requestRuntime: requests,
    interactionRuntime: interactions,
    installationResult: {
      inboundRouting: [{ eventKind: "form_submission", requestType: "PROSPECT_INQUIRY" }],
    },
    nowISO: NOW,
  });

  const result = orchestrator.handleNormalizedEvent(
    createNormalizedInboundEvent({
      externalEventId: "sub_1",
      providerId: "provider_mock_form",
      workspaceId: "ws_test",
      channel: "website",
      eventKind: "form_submission",
      occurredAt: NOW,
      identityHints: { name: "Jordan", email: "j@example.com" },
      attribution: {
        sourceLabel: "website",
        landingPage: "/listings/abc",
        externalObjectId: "listing_abc",
        subjectType: "listing",
        subjectDisplayName: "456 Oak Ave",
      },
      payloadFacts: { message: "Interested in this listing" },
    }),
  );

  assert.equal(result.handled, true);
  assert.equal(graph.getParties().length, 1);
  assert.equal(graph.getParty(graph.getParties()[0].id).displayName, "Jordan");
  assert.equal(subjects.getSubjects().length, 1);
  assert.equal(requests.getRequests().length, 1);
  assert.ok(requests.getRequests()[0].inboundAttribution?.landingPage);
});

test("InboundBusinessOrchestrationService: reuses party by email and updates displayName from submitted resident name", () => {
  const graph = new BusinessGraphRuntime();
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const interactions = new InteractionRuntime();

  const orchestrator = new InboundBusinessOrchestrationService({
    workspaceId: "ws_test",
    businessGraphRuntime: graph,
    businessSubjectRuntime: subjects,
    requestRuntime: requests,
    interactionRuntime: interactions,
    installationResult: {
      inboundRouting: [
        {
          eventKind: "maintenance_form_submission",
          requestType: "MAINTENANCE_REQUEST",
          partyRelationshipType: "RESIDENT",
          subjectRelationshipType: "RESIDENT_OF",
        },
      ],
    },
    nowISO: NOW,
  });

  orchestrator.handleNormalizedEvent(
    createNormalizedInboundEvent({
      externalEventId: "sub_1",
      providerId: "provider_mock_form",
      eventKind: "maintenance_form_submission",
      identityHints: { name: "123 main st", email: "jane@example.com" },
      attribution: {
        externalObjectId: "subj_main",
        subjectDisplayName: "123 main st",
      },
      payloadFacts: { message: "Leak" },
    }),
  );

  orchestrator.handleNormalizedEvent(
    createNormalizedInboundEvent({
      externalEventId: "sub_2",
      providerId: "provider_mock_form",
      eventKind: "maintenance_form_submission",
      identityHints: { name: "Jane Resident", email: "jane@example.com" },
      attribution: {
        externalObjectId: "subj_main",
        subjectDisplayName: "123 main st",
      },
      payloadFacts: { message: "Another leak" },
    }),
  );

  assert.equal(graph.getParties().length, 1);
  assert.equal(graph.getParty("party_jane_example_com").displayName, "Jane Resident");
});
