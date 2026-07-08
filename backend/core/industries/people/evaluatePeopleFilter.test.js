import assert from "node:assert/strict";
import { test } from "node:test";

import {
  derivePeopleFilterCounts,
  evaluatePeopleFilterPredicate,
  filterPartiesByPeopleFilter,
} from "./evaluatePeopleFilter.js";
import { MCBRIDE_PEOPLE_FILTERS } from "../../../../industries/property-management/config/mcbrideRelationshipRegistry.js";

const sampleParties = [
  {
    partyId: "party_buyer",
    partyStatus: "active",
    relationships: [
      { type: "PROSPECT", status: "active" },
      { type: "BUYER", status: "active" },
    ],
    qualificationProfile: { intent: "buy" },
    openWorkCount: 0,
    subjectCount: 1,
  },
  {
    partyId: "party_rental",
    partyStatus: "active",
    relationships: [{ type: "PROSPECT", status: "active" }],
    qualificationProfile: { intent: "rent" },
    openWorkCount: 0,
    subjectCount: 0,
  },
  {
    partyId: "party_inactive",
    partyStatus: "inactive",
    relationships: [{ type: "BUYER", status: "active" }],
    qualificationProfile: {},
    openWorkCount: 0,
    subjectCount: 0,
  },
  {
    partyId: "party_past",
    partyStatus: "active",
    relationships: [{ type: "PAST_BUYER", status: "active" }],
    qualificationProfile: {},
    openWorkCount: 0,
    subjectCount: 0,
  },
];

test("active buyers filter uses active BUYER and excludes inactive parties", () => {
  const filter = MCBRIDE_PEOPLE_FILTERS.find((f) => f.id === "active_buyers");
  assert.ok(filter);
  const matches = sampleParties.filter((row) => evaluatePeopleFilterPredicate({ partyRow: row, predicate: filter.predicate }));
  assert.deepEqual(matches.map((row) => row.partyId), ["party_buyer"]);
});

test("rental inquiries require active PROSPECT and rental intent", () => {
  const filter = MCBRIDE_PEOPLE_FILTERS.find((f) => f.id === "rental_inquiries");
  const matches = sampleParties.filter((row) => evaluatePeopleFilterPredicate({ partyRow: row, predicate: filter.predicate }));
  assert.deepEqual(matches.map((row) => row.partyId), ["party_rental"]);
});

test("past clients filter matches past buyer and seller types", () => {
  const filter = MCBRIDE_PEOPLE_FILTERS.find((f) => f.id === "past_clients");
  const matches = sampleParties.filter((row) => evaluatePeopleFilterPredicate({ partyRow: row, predicate: filter.predicate }));
  assert.deepEqual(matches.map((row) => row.partyId), ["party_past"]);
});

test("inactive filter matches inactive party status", () => {
  const filter = MCBRIDE_PEOPLE_FILTERS.find((f) => f.id === "inactive");
  const matches = filterPartiesByPeopleFilter({
    parties: sampleParties,
    filterId: "inactive",
    peopleFilters: MCBRIDE_PEOPLE_FILTERS,
  });
  assert.deepEqual(matches.map((row) => row.partyId), ["party_inactive"]);
});

test("derivePeopleFilterCounts uses package filter definitions", () => {
  const counts = derivePeopleFilterCounts({ parties: sampleParties, peopleFilters: MCBRIDE_PEOPLE_FILTERS });
  assert.equal(counts.all, 4);
  assert.equal(counts.active_buyers, 1);
  assert.equal(counts.prospects, 2);
  assert.equal(counts.past_clients, 1);
});
