import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "./BusinessGraphEventTypes.js";
import { BusinessGraphRuntime } from "./BusinessGraphRuntime.js";
import { BusinessSubjectRuntime } from "../business-subject/BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import {
  ensurePartySubjectRelationship,
  endPartySubjectRelationship,
} from "./partySubjectRelationship.js";

const NOW = "2026-08-04T15:00:00.000Z";

function buildStack() {
  return {
    businessGraphRuntime: new BusinessGraphRuntime(),
    businessSubjectRuntime: new BusinessSubjectRuntime(),
  };
}

function seedParty(stack, partyId = "party_1") {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: "Test Person",
        status: "active",
        contactMethods: [],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return partyId;
}

function seedSubject(stack, subjectId = "subj_1") {
  stack.businessSubjectRuntime.applyEvent({
    id: `evt_subj_${subjectId}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: {
        id: subjectId,
        workspaceId: "ws_test",
        subjectType: "listing",
        displayName: "12 Oak St",
        status: "active",
        keyAttributes: {},
        externalReferences: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return subjectId;
}

test("ensure + end party subject INTERESTED_IN is reusable and idempotent", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  const subjectId = seedSubject(stack);

  const linked = ensurePartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });
  assert.equal(linked.ok, true);
  assert.equal(linked.duplicate, false);

  const again = ensurePartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);

  const ended = endPartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });
  assert.equal(ended.ok, true);
  assert.equal(String(stack.businessGraphRuntime.getRelationship(linked.relationshipId)?.status), "ended");

  const endedAgain = endPartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });
  assert.equal(endedAgain.ok, true);
  assert.equal(endedAgain.duplicate, true);
});

test("link fails cleanly when party or subject is missing", () => {
  const stack = buildStack();
  seedParty(stack, "party_only");
  seedSubject(stack, "subj_only");

  const missingSubject = ensurePartySubjectRelationship({
    stack,
    partyId: "party_only",
    subjectId: "missing",
    nowISO: NOW,
  });
  assert.equal(missingSubject.ok, false);
  assert.equal(missingSubject.reason, "subject_not_found");

  const missingParty = ensurePartySubjectRelationship({
    stack,
    partyId: "missing",
    subjectId: "subj_only",
    nowISO: NOW,
  });
  assert.equal(missingParty.ok, false);
  assert.equal(missingParty.reason, "party_not_found");
});
