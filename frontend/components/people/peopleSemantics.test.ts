import assert from "node:assert/strict";
import { test } from "node:test";

import {
  derivePeopleCounts,
  filterPeople,
  relationshipText,
  resolvePeopleFilters,
  searchPeople,
} from "./peopleSemantics.ts";
import { MCBRIDE_PEOPLE_FILTERS } from "../../../industries/property-management/config/mcbrideRelationshipRegistry.js";

const parties = [
  {
    partyId: "party_1",
    displayName: "Alex Rivera",
    email: "alex@example.com",
    phone: "8605550100",
    partyStatus: "active",
    relationships: [{ type: "PROSPECT", status: "active" }],
    relationshipTypes: ["PROSPECT"],
    relationshipLabels: ["Prospect"],
    primarySubjectId: "sub_1",
    primarySubjectName: "12 Harbor View",
    subjectCount: 1,
    openRequestCount: 1,
    openWorkCount: 1,
    attentionLevel: "attention",
    lastActivityAt: "2026-07-01T00:00:00.000Z",
    lastActivityLabel: "Today",
    nextActionTitle: "Follow up",
    href: "/b/biz_1/people/party_1",
  },
  {
    partyId: "party_2",
    displayName: "Jordan Owner",
    email: "owner@example.com",
    partyStatus: "active",
    relationships: [{ type: "OWNER", status: "active" }],
    relationshipTypes: ["OWNER"],
    relationshipLabels: ["Owner"],
    subjectCount: 0,
    openRequestCount: 0,
    openWorkCount: 0,
    attentionLevel: "none",
    lastActivityAt: null,
    href: "/b/biz_1/people/party_2",
  },
  {
    partyId: "party_3",
    displayName: "Casey Buyer",
    email: "buyer@example.com",
    partyStatus: "active",
    relationships: [
      { type: "PROSPECT", status: "active" },
      { type: "BUYER", status: "active" },
    ],
    relationshipTypes: ["PROSPECT", "BUYER"],
    relationshipLabels: ["Prospect", "Buyer"],
    subjectCount: 0,
    openRequestCount: 0,
    openWorkCount: 0,
    attentionLevel: "none",
    lastActivityAt: null,
    href: "/b/biz_1/people/party_3",
  },
];

test("people metrics align with VM rows using package filters", () => {
  const counts = derivePeopleCounts(parties, MCBRIDE_PEOPLE_FILTERS);

  assert.equal(counts.totalPeople, 3);
  assert.equal(counts.prospects, 2);
  assert.equal(counts.filters.active_buyers, 1);
  assert.equal(counts.filters.owners, 1);
});

test("filters match package-driven semantics", () => {
  assert.equal(filterPeople(parties, "prospects", MCBRIDE_PEOPLE_FILTERS).length, 2);
  assert.equal(filterPeople(parties, "active_buyers", MCBRIDE_PEOPLE_FILTERS).length, 1);
  assert.equal(filterPeople(parties, "owners", MCBRIDE_PEOPLE_FILTERS).length, 1);
  assert.equal(filterPeople(parties, "with_open_work", MCBRIDE_PEOPLE_FILTERS).length, 1);
});

test("resolvePeopleFilters falls back to legacy filters when package filters absent", () => {
  const filters = resolvePeopleFilters(undefined);
  assert.ok(filters.some((filter) => filter.id === "prospects"));
  assert.ok(!filters.some((filter) => filter.id === "active_buyers"));
});

test("relationship labels are human-readable and enums stay hidden", () => {
  const text = relationshipText(parties[0]);
  assert.equal(text, "Prospect");
  assert.ok(!text?.includes("PROSPECT"));
});

test("search matches contact and property context", () => {
  assert.equal(searchPeople(parties, "harbor").length, 1);
  assert.equal(searchPeople(parties, "owner@example.com").length, 1);
});
