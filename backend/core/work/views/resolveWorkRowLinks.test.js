import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../../business-graph/BusinessGraphEventTypes.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../../references/EntityRef.js";
import { resolveBusinessWorkLinks, resolveWorkPartyId } from "./resolveWorkRowLinks.js";

const NOW = "2026-07-01T00:00:00.000Z";

function seedParty(graph, { id, displayName }) {
  graph.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id,
        partyType: "PERSON",
        displayName,
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function seedRequest(requests, { id, requester, subjectId }) {
  requests.applyEvent({
    id: `evt_req_${id}`,
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: {
        id,
        title: "Maintenance request",
        description: "Leak",
        requestType: "MAINTENANCE_REQUEST",
        status: "received",
        priority: "high",
        channel: "website",
        source: "test",
        requester,
        receivedAt: NOW,
        subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })],
        metadata: {},
      },
    },
  });
}

test("resolveWorkPartyId ignores tm_system and prefers request requester", () => {
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedParty(graph, { id: "party_jane", displayName: "Jane Resident" });
  seedRequest(requests, { id: "req_1", requester: "party_jane", subjectId: "subj_1" });

  const partyId = resolveWorkPartyId({
    workItem: {
      id: "work_1",
      requestId: "req_1",
      requestedBy: "tm_system",
      relatedObjects: [],
    },
    requestRuntime: requests,
    businessGraphRuntime: graph,
  });

  assert.equal(partyId, "party_jane");
});

test("resolveBusinessWorkLinks prefers person href and never emits engagement routes", () => {
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedParty(graph, { id: "party_jane", displayName: "Jane Resident" });
  seedRequest(requests, { id: "req_1", requester: "party_jane", subjectId: "subj_main" });

  const links = resolveBusinessWorkLinks({
    businessId: "biz_1",
    businessGraphRuntime: graph,
    requestRuntime: requests,
    workItem: {
      id: "work_1",
      requestId: "req_1",
      requestedBy: "tm_system",
      relatedObjects: [],
    },
  });

  assert.equal(links.personHref, "/b/biz_1/people/party_jane");
  assert.equal(links.rowHref, "/b/biz_1/people/party_jane");
  assert.equal(links.engagementHref, null);
});

test("resolveBusinessWorkLinks falls back to property href when no valid party exists", () => {
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedRequest(requests, { id: "req_1", requester: "tm_system", subjectId: "subj_main" });

  const links = resolveBusinessWorkLinks({
    subjectId: "subj_main",
    businessId: "biz_1",
    businessGraphRuntime: graph,
    requestRuntime: requests,
    workItem: {
      id: "work_1",
      requestId: "req_1",
      requestedBy: "tm_system",
      relatedObjects: [],
    },
  });

  assert.equal(links.personHref, null);
  assert.equal(links.propertyHref, "/b/biz_1/properties/subj_main");
  assert.equal(links.rowHref, "/b/biz_1/properties/subj_main");
});

test("resolveBusinessWorkLinks is not clickable without party or subject", () => {
  const links = resolveBusinessWorkLinks({
    businessId: "biz_1",
    businessGraphRuntime: new BusinessGraphRuntime(),
    requestRuntime: new RequestRuntime({ nowISO: NOW }),
    workItem: { id: "work_1", requestedBy: "tm_system", relatedObjects: [] },
  });

  assert.equal(links.rowHref, null);
});
