import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../../business-graph/BusinessGraphEventTypes.js";
import { BusinessSubjectRuntime } from "../BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../BusinessSubjectEventTypes.js";
import { createBusinessSubject } from "../BusinessSubject.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../../request/RequestEventTypes.js";
import { createRequest } from "../../request/Request.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { createWorkItem } from "../../work/WorkItem.js";
import { ENTITY_TYPES, createEntityRef } from "../../references/EntityRef.js";
import { buildBusinessSubjectPortfolioIndex } from "./buildBusinessSubjectPortfolioIndex.js";
import { buildSubjectOperatingDetail } from "./buildSubjectOperatingDetail.js";
import { buildBusinessOperatingHomeView } from "../../command-center/buildBusinessOperatingHomeView.js";
import { updateBusinessSubjectStatus } from "../updateBusinessSubjectStatus.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";

const NOW = "2026-07-07T20:00:00.000Z";
const BUSINESS_ID = "ws_portfolio_index";
const SUBJECT_TYPES = ["property", "listing", "unit"];

function buildCtx(overrides = {}) {
  return {
    businessSubjectRuntime: overrides.businessSubjectRuntime ?? new BusinessSubjectRuntime(),
    businessGraphRuntime: overrides.businessGraphRuntime ?? new BusinessGraphRuntime(),
    requestRuntime: overrides.requestRuntime ?? new RequestRuntime({ nowISO: NOW }),
    workRuntime: overrides.workRuntime ?? new WorkRuntime({ nowISO: NOW }),
    interactionRuntime: overrides.interactionRuntime,
    ...overrides,
  };
}

function seedSubject(subjects, { id, displayName, status = "active" }) {
  subjects.applyEvent({
    id: `evt_${id}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: createBusinessSubject({
        id,
        workspaceId: BUSINESS_ID,
        subjectType: "listing",
        displayName,
        status,
        keyAttributes: { address: displayName },
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
}

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

function seedInterestedIn(graph, { partyId, subjectId }) {
  graph.applyEvent({
    id: `evt_rel_${partyId}_${subjectId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id: `rel_${partyId}_${subjectId}`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
        relationshipType: "INTERESTED_IN",
        status: "active",
        effectiveFrom: NOW,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function seedInquiry(requests, { id, partyId, subjectId, status = "received" }) {
  requests.applyEvent({
    id: `evt_${id}`,
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: createRequest({
        id,
        title: "Inquiry",
        description: "Interested",
        requestType: "PROSPECT_INQUIRY",
        status,
        priority: "medium",
        channel: "website",
        source: "vibetech_app",
        requester: partyId,
        receivedAt: NOW,
        inboundAttribution: { sourceLabel: "website", channel: "website" },
        subjectRefs: subjectId
          ? [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })]
          : [],
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
}

function buildIndex(ctx, businessId = BUSINESS_ID, presentation = PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION) {
  return buildBusinessSubjectPortfolioIndex({
    ctx,
    subjectTypes: SUBJECT_TYPES,
    businessId,
    nowISO: NOW,
    presentation,
  });
}

test("buildBusinessSubjectPortfolioIndex zero properties", () => {
  const index = buildIndex(buildCtx());
  assert.equal(index.rows.length, 0);
  assert.equal(index.totals.totalProperties, 0);
  assert.equal(index.totals.openInquiries, 0);
  assert.equal(index.metrics.find((m) => m.id === "active_properties")?.value, "0");
});

test("buildBusinessSubjectPortfolioIndex row metrics match operating detail", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_a", displayName: "Alpha Listing" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_a" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_a" });

  const ctx = buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests });
  const index = buildIndex(ctx);
  const detail = buildSubjectOperatingDetail({
    subjectId: "subj_a",
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  assert.equal(index.rows.length, 1);
  assert.equal(index.rows[0].inquiryCount, detail.metrics.inquiryCount);
  assert.equal(index.rows[0].interestedCount, detail.metrics.interestedCount);
  assert.equal(index.rows[0].openFollowUpCount, detail.metrics.openFollowUpCount);
  assert.equal(index.rows[0].latestActivityAt, detail.metrics.latestActivityAt);
});

test("buildBusinessSubjectPortfolioIndex sorts by inquiry then interested then name", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_low", displayName: "Zulu House" });
  seedSubject(subjects, { id: "subj_high", displayName: "Alpha House" });
  seedSubject(subjects, { id: "subj_mid", displayName: "Mike House" });
  seedParty(graph, { id: "party_a", displayName: "A" });
  seedParty(graph, { id: "party_b", displayName: "B" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_high" });
  seedInterestedIn(graph, { partyId: "party_b", subjectId: "subj_mid" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_high" });
  seedInquiry(requests, { id: "req_2", partyId: "party_a", subjectId: "subj_high" });
  seedInquiry(requests, { id: "req_3", partyId: "party_b", subjectId: "subj_mid" });

  const index = buildIndex(
    buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests }),
  );

  assert.deepEqual(
    index.rows.map((r) => r.subjectId),
    ["subj_high", "subj_mid", "subj_low"],
  );
});

test("buildBusinessSubjectPortfolioIndex unattributed inquiry", () => {
  const requests = new RequestRuntime({ nowISO: NOW });
  seedInquiry(requests, { id: "req_unattrib", partyId: "party_a", subjectId: null });

  const index = buildIndex(buildCtx({ requestRuntime: requests }));
  assert.equal(index.totals.unattributedInquiries, 1);
  assert.equal(index.rows.length, 0);
});

test("buildBusinessSubjectPortfolioIndex inactive property preserves metrics", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_archived", displayName: "Sold Home" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_archived" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_archived" });
  updateBusinessSubjectStatus({
    businessSubjectRuntime: subjects,
    subjectId: "subj_archived",
    status: "archived",
    nowISO: NOW,
    source: "test",
  });

  const index = buildIndex(buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests }));
  assert.equal(index.rows.length, 1);
  assert.equal(index.rows[0].status, "archived");
  assert.equal(index.rows[0].inquiryCount, 1);
  assert.equal(index.rows[0].interestedCount, 1);
});

test("buildBusinessSubjectPortfolioIndex href mapping", () => {
  const subjects = new BusinessSubjectRuntime();
  seedSubject(subjects, { id: "subj_href", displayName: "Href House" });
  const index = buildIndex(buildCtx({ businessSubjectRuntime: subjects }));
  assert.equal(index.rows[0].href, `/b/${BUSINESS_ID}/properties/subj_href`);
});

test("buildBusinessSubjectPortfolioIndex three-surface metric consistency", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_consistency", displayName: "Consistency House" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_consistency" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_consistency" });

  const ctx = buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests });
  const index = buildIndex(ctx);
  const home = buildBusinessOperatingHomeView({
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
    businessId: BUSINESS_ID,
    subjectTypes: SUBJECT_TYPES,
  });
  const detail = buildSubjectOperatingDetail({
    subjectId: "subj_consistency",
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  const indexRow = index.rows[0];
  const homeRow = home.topProperties[0];

  assert.equal(homeRow.inquiryCount, indexRow.inquiryCount);
  assert.equal(homeRow.interestedCount, indexRow.interestedCount);
  assert.equal(homeRow.openFollowUpCount, indexRow.openFollowUpCount);
  assert.equal(homeRow.latestActivityAt, indexRow.latestActivityAt);
  assert.equal(detail.metrics.inquiryCount, indexRow.inquiryCount);
  assert.equal(detail.metrics.interestedCount, indexRow.interestedCount);
  assert.equal(detail.metrics.openFollowUpCount, indexRow.openFollowUpCount);
  assert.equal(detail.metrics.latestActivityAt, indexRow.latestActivityAt);
});

test("buildBusinessSubjectPortfolioIndex tenant isolation", () => {
  const subjectsA = new BusinessSubjectRuntime();
  const subjectsB = new BusinessSubjectRuntime();
  seedSubject(subjectsA, { id: "subj_a_only", displayName: "Tenant A Listing" });

  const indexA = buildIndex(buildCtx({ businessSubjectRuntime: subjectsA }), "ws_tenant_a");
  const indexB = buildIndex(buildCtx({ businessSubjectRuntime: subjectsB }), "ws_tenant_b");

  assert.equal(indexA.rows.length, 1);
  assert.equal(indexB.rows.length, 0);
  assert.equal(indexA.rows[0].href, "/b/ws_tenant_a/properties/subj_a_only");
});

test("buildBusinessSubjectPortfolioIndex returns human-readable metric labels", () => {
  const index = buildIndex(buildCtx());
  const labels = index.metrics.map((metric) => metric.label);
  assert.deepEqual(labels, [
    "Active properties",
    "Open inquiries",
    "Interested prospects",
    "Open follow-ups",
  ]);
});

test("buildBusinessSubjectPortfolioIndex uses presentation metric labels when provided", () => {
  const index = buildIndex(buildCtx(), BUSINESS_ID, {
    operatingHome: {
      metrics: {
        activeProperties: "Live properties",
        openInquiries: "Open leads",
        interestedProspects: "Warm prospects",
        openFollowUps: "Pending follow-ups",
      },
    },
  });
  assert.deepEqual(
    index.metrics.map((metric) => metric.label),
    ["Live properties", "Open leads", "Warm prospects", "Pending follow-ups"],
  );
});
