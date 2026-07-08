import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "./BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "./BusinessGraphEventTypes.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-02T00:00:00.000Z";

test("BusinessGraphRuntime: PARTY_CREATED and RELATIONSHIP_CREATED are event-only + immutable", () => {
  const rt = new BusinessGraphRuntime();

  const partyId = "party_person_1";
  rt.applyEvent({
    id: "evt_party_created_1",
    timestampISO: NOW0,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: "John Doe",
        status: "active",
        contactMethods: [],
        externalReferences: ["crm_1"],
        metadata: { any: "thing" },
        createdAt: NOW0,
        updatedAt: NOW0,
      },
    },
  });

  const party = rt.getParty(partyId);
  assert.ok(party);
  assert.equal(String(party.id), partyId);
  assert.ok(Object.isFrozen(party));
  assert.equal(rt.getParties().length, 1);
  assert.equal(rt._state.metrics.partyCount, 1);
  assert.equal(rt._state.metrics.relationshipCount, 0);

  const relationshipId = "rel_1";
  rt.applyEvent({
    id: "evt_rel_created_1",
    timestampISO: NOW1,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id: relationshipId,
        fromEntity: { entityType: "Request", entityId: "req_1" },
        toEntity: { entityType: "Party", entityId: partyId },
        relationshipType: "RELATED_TO",
        status: "active",
        effectiveFrom: NOW0,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW0,
        updatedAt: NOW1,
      },
    },
  });

  const rel = rt.getRelationship(relationshipId);
  assert.ok(rel);
  assert.equal(String(rel.id), relationshipId);
  assert.equal(rt.getRelationships().length, 1);
  assert.ok(Object.isFrozen(rel));
  assert.ok(Object.isFrozen(rt._state));
});

test("BusinessGraphRuntime: invalid partyType throws", () => {
  const rt = new BusinessGraphRuntime();
  assert.throws(() =>
    rt.applyEvent({
      id: "evt_bad_party",
      timestampISO: NOW0,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
      source: "test",
      payload: {
        party: {
          id: "party_bad",
          partyType: "TENANT",
          displayName: "Bad",
          status: "active",
          contactMethods: [],
          externalReferences: [],
          metadata: {},
          createdAt: NOW0,
          updatedAt: NOW0,
        },
      },
    }),
  );
});
