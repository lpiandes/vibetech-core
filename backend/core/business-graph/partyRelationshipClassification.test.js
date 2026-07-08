import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "./BusinessGraphEventTypes.js";
import { createBusinessParty } from "./BusinessParty.js";
import { BusinessGraphRuntime } from "./BusinessGraphRuntime.js";
import {
  ensurePartyRelationship,
  promotePartyRelationship,
  relationshipIdFor,
  setPartyInactiveStatus,
} from "./partyRelationshipClassification.js";
import { MCBRIDE_LIFECYCLE_TRANSITIONS } from "../../../industries/property-management/config/mcbrideRelationshipRegistry.js";

const NOW = "2026-07-08T12:00:00.000Z";

function seedParty(stack, partyId = "party_test_1") {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: createBusinessParty({
        id: partyId,
        partyType: "PERSON",
        displayName: "Test Person",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
  return partyId;
}

function buildStack() {
  return { businessGraphRuntime: new BusinessGraphRuntime() };
}

test("ensurePartyRelationship is additive and idempotent", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);

  const first = ensurePartyRelationship({ stack, partyId, relationshipType: "PROSPECT", nowISO: NOW });
  const second = ensurePartyRelationship({ stack, partyId, relationshipType: "PROSPECT", nowISO: NOW });
  const buyer = ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });

  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(buyer.ok, true);

  const prospect = stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "PROSPECT"));
  const buyerRel = stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "BUYER"));
  assert.equal(String(prospect.status), "active");
  assert.equal(String(buyerRel.status), "active");
});

test("adding BUYER does not end PROSPECT", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "PROSPECT", nowISO: NOW });
  ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });

  const prospect = stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "PROSPECT"));
  assert.equal(String(prospect.status), "active");
});

test("OWNER and BUYER and INVESTOR can coexist", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });
  ensurePartyRelationship({ stack, partyId, relationshipType: "OWNER", nowISO: NOW });
  ensurePartyRelationship({ stack, partyId, relationshipType: "INVESTOR", nowISO: NOW });

  for (const type of ["BUYER", "OWNER", "INVESTOR"]) {
    assert.equal(
      String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, type)).status),
      "active",
    );
  }
});

test("REFERRAL_SOURCE coexists with PAST_BUYER", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });
  promotePartyRelationship({
    stack,
    partyId,
    fromRelationshipType: "BUYER",
    toRelationshipType: "PAST_BUYER",
    nowISO: NOW,
    lifecycleTransitions: MCBRIDE_LIFECYCLE_TRANSITIONS,
  });
  ensurePartyRelationship({ stack, partyId, relationshipType: "REFERRAL_SOURCE", nowISO: NOW });

  assert.equal(
    String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "PAST_BUYER")).status),
    "active",
  );
  assert.equal(
    String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "REFERRAL_SOURCE")).status),
    "active",
  );
});

test("promote BUYER to PAST_BUYER ends only BUYER and preserves history", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });

  const promoted = promotePartyRelationship({
    stack,
    partyId,
    fromRelationshipType: "BUYER",
    toRelationshipType: "PAST_BUYER",
    nowISO: NOW,
    lifecycleTransitions: MCBRIDE_LIFECYCLE_TRANSITIONS,
  });

  assert.equal(promoted.ok, true);
  const endedBuyer = stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "BUYER"));
  const pastBuyer = stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "PAST_BUYER"));
  assert.equal(String(endedBuyer.status), "ended");
  assert.ok(endedBuyer.effectiveTo);
  assert.equal(String(pastBuyer.status), "active");
});

test("seller lifecycle transitions SELLER_PROSPECT to SELLER to PAST_SELLER", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "SELLER_PROSPECT", nowISO: NOW });

  promotePartyRelationship({
    stack,
    partyId,
    fromRelationshipType: "SELLER_PROSPECT",
    toRelationshipType: "SELLER",
    nowISO: NOW,
    lifecycleTransitions: MCBRIDE_LIFECYCLE_TRANSITIONS,
  });
  promotePartyRelationship({
    stack,
    partyId,
    fromRelationshipType: "SELLER",
    toRelationshipType: "PAST_SELLER",
    nowISO: NOW,
    lifecycleTransitions: MCBRIDE_LIFECYCLE_TRANSITIONS,
  });

  assert.equal(
    String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "SELLER_PROSPECT")).status),
    "ended",
  );
  assert.equal(String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "SELLER")).status), "ended");
  assert.equal(
    String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "PAST_SELLER")).status),
    "active",
  );
});

test("invalid PROSPECT to BUYER promote is rejected", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "PROSPECT", nowISO: NOW });

  const result = promotePartyRelationship({
    stack,
    partyId,
    fromRelationshipType: "PROSPECT",
    toRelationshipType: "BUYER",
    nowISO: NOW,
    lifecycleTransitions: MCBRIDE_LIFECYCLE_TRANSITIONS,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_transition");
  assert.equal(
    String(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "PROSPECT")).status),
    "active",
  );
  assert.equal(stack.businessGraphRuntime.getRelationship(relationshipIdFor(partyId, "BUYER")), null);
});

test("setPartyInactiveStatus updates party status", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  const result = setPartyInactiveStatus({ stack, partyId, nowISO: NOW, status: "inactive" });
  assert.equal(result.ok, true);
  assert.equal(String(stack.businessGraphRuntime.getParty(partyId).status), "inactive");
});
