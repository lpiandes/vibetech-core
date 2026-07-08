import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PeopleExecutiveLayout from "./PeopleExecutiveLayout";
import PeopleDetailLayout from "./PeopleDetailLayout";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import { WorkspaceNavigationProvider } from "@/components/workspace/WorkspaceNavigationContext";
import type { EngagementPartyIndexViewModel, EngagementViewModel } from "@/lib/workspace/EngagementTypes";

function renderPeople(index: EngagementPartyIndexViewModel) {
  return renderToStaticMarkup(
    <BusinessScopeProvider
      value={{
        businessId: "biz_1",
        role: "owner",
        permissions: [],
        businessName: "Magna Mare",
      }}
    >
      <WorkspaceNavigationProvider>
        <PeopleExecutiveLayout index={index} />
      </WorkspaceNavigationProvider>
    </BusinessScopeProvider>,
  );
}

const makeIndex = (): EngagementPartyIndexViewModel => ({
  generatedAt: "2026-07-01T00:00:00.000Z",
  parties: [
    {
      partyId: "party_1",
      displayName: "Alex Rivera",
      partyType: "PERSON",
      partyTypeLabel: "Person",
      email: "alex@example.com",
      phone: null,
      relationshipTypes: ["PROSPECT"],
      relationshipLabels: ["Prospect"],
      primarySubjectId: "sub_1",
      primarySubjectName: "12 Harbor View",
      subjectNames: ["12 Harbor View"],
      subjectCount: 1,
      openRequestCount: 1,
      openWorkCount: 1,
      attentionLevel: "attention",
      lastActivityAt: "2026-07-01T00:00:00.000Z",
      lastActivityLabel: "Today",
      nextActionTitle: "Follow up on inquiry",
      href: "/b/biz_1/people/party_1",
    },
  ],
});

const makeDetail = (): EngagementViewModel =>
  ({
    version: 1,
    partyId: "party_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    party: {
      displayName: "Alex Rivera",
      partyType: "PERSON",
      contactMethods: ["alex@example.com"],
    },
    relationshipSummary: [{ relationshipLabel: "Prospect" }],
    currentContext: {},
    timeline: [
      {
        id: "tl_1",
        type: "REQUEST",
        category: "request",
        occurredAt: "2026-07-01T00:00:00.000Z",
        title: "Inquiry received",
        description: "Looking for a 2-bedroom near downtown.",
        status: "open",
        actor: null,
        relatedObjects: [],
        sourceReference: { sourceType: "request", sourceId: "req_1" },
        metadata: {},
      },
    ],
    openWork: [{ id: "wi_1", title: "Prospect follow-up", workTypeLabel: "Prospect follow-up", subjectName: "12 Harbor View" }],
    openRequests: [{ id: "req_1", title: "Inquiry", requestTypeLabel: "Inquiry" }],
    communications: [],
    interactions: [],
    followUps: [],
    pendingApprovals: [],
    automationActivity: [],
    attention: { summary: "1 item needs attention.", items: [{ id: "att_1" }] },
    nextActions: [{ id: "na_1", title: "Follow up", description: "Confirm next step with prospect." }],
    subjects: [{ id: "sub_1", displayName: "12 Harbor View" }],
    communicationPreferences: { items: [], contactable: { email: true, sms: true } },
    segmentMemberships: [],
    qualificationSummary: [],
    metrics: {},
    metadata: {},
  }) as EngagementViewModel;

test("PeopleExecutiveLayout renders executive people surface", () => {
  const html = renderPeople(makeIndex());

  assert.ok(html.includes("People"));
  assert.ok(html.includes("Contacts and relationships VIBETech is tracking for this business."));
  assert.ok(html.includes("People and relationships"));
  assert.ok(html.includes("Alex Rivera"));
  assert.ok(html.includes("Prospect"));
  assert.ok(html.includes("12 Harbor View"));
  assert.ok(html.includes("/b/biz_1/people/party_1"));
  assert.ok(!html.includes("PROSPECT"));
});

test("PeopleExecutiveLayout renders compact empty state", () => {
  const html = renderPeople({ generatedAt: "2026-07-01T00:00:00.000Z", parties: [] });
  assert.ok(html.includes("Residents, prospects, owners, and vendors will appear here"));
});

test("PeopleDetailLayout renders contact, property interest, and open work", () => {
  const html = renderToStaticMarkup(<PeopleDetailLayout businessId="biz_1" viewModel={makeDetail()} />);

  assert.ok(html.includes("People"));
  assert.ok(html.includes("Alex Rivera"));
  assert.ok(html.includes("alex@example.com"));
  assert.ok(html.includes("Property interest"));
  assert.ok(html.includes("12 Harbor View"));
  assert.ok(html.includes("Open requests and work"));
  assert.ok(html.includes("Prospect follow-up"));
});
