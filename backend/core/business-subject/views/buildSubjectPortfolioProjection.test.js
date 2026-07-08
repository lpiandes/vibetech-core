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
import { buildSubjectPortfolioProjection } from "./buildSubjectPortfolioProjection.js";
import { updateBusinessSubjectStatus } from "../updateBusinessSubjectStatus.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";

const NOW = "2026-07-07T20:00:00.000Z";
const SUBJECT_TYPES = ["property", "listing", "unit"];
const PM_PRESENTATION = PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION;

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
        workspaceId: "ws_test",
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

function seedInquiry(requests, { id, partyId, subjectId, receivedAt = NOW, status = "received" }) {
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
        receivedAt,
        inboundAttribution: { sourceLabel: "website", channel: "website" },
        subjectRefs: subjectId
          ? [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })]
          : [],
        createdAt: receivedAt,
        updatedAt: receivedAt,
      }),
    },
  });
}

function seedFollowUpWork(workRuntime, { id, requestId, subjectId, dueAt, status = "in_progress" }) {
  workRuntime.applyEvent({
    id: `evt_work_${id}`,
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: {
      workItem: createWorkItem({
        id,
        title: "Prospect follow-up",
        description: "Follow up",
        workType: "prospect_follow_up",
        status,
        priority: "medium",
        stageId: "stage_intake",
        queueId: "queue_needs_review",
        assignedTo: "unassigned",
        requestedBy: "party_a",
        source: "automation",
        dueAt,
        createdAt: NOW,
        updatedAt: NOW,
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
          createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
        ],
        requirements: [],
        metadata: {},
      }),
    },
  });
}

test("buildSubjectPortfolioProjection zero-data workspace", () => {
  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx(),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  assert.equal(portfolio.totals.totalProperties, 0);
  assert.equal(portfolio.totals.openInquiries, 0);
  assert.equal(portfolio.totals.interestedProspects, 0);
  assert.equal(portfolio.totals.openFollowUps, 0);
  assert.equal(portfolio.topProperties.length, 0);
});

test("buildSubjectPortfolioProjection one property one inquiry", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_a", displayName: "742 Harbor Lane" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_a" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_a" });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.totals.activeProperties, 1);
  assert.equal(portfolio.totals.openInquiries, 1);
  assert.equal(portfolio.totals.interestedProspects, 1);
  assert.equal(portfolio.topProperties[0].inquiryCount, 1);
  assert.equal(portfolio.topProperties[0].interestedCount, 1);
});

test("buildSubjectPortfolioProjection repeated inquiries same person", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_a", displayName: "Unit A" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_a" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_a", receivedAt: "2026-07-01T10:00:00.000Z" });
  seedInquiry(requests, { id: "req_2", partyId: "party_a", subjectId: "subj_a", receivedAt: "2026-07-02T10:00:00.000Z" });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.topProperties[0].inquiryCount, 2);
  assert.equal(portfolio.topProperties[0].interestedCount, 1);
  assert.equal(portfolio.totals.interestedProspects, 1);
});

test("buildSubjectPortfolioProjection multiple properties top ordering", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_low", displayName: "AAA Low" });
  seedSubject(subjects, { id: "subj_high", displayName: "ZZZ High" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedParty(graph, { id: "party_b", displayName: "Blair" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_high" });
  seedInterestedIn(graph, { partyId: "party_b", subjectId: "subj_high" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_low" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_high" });
  seedInquiry(requests, { id: "req_2", partyId: "party_b", subjectId: "subj_high" });
  seedInquiry(requests, { id: "req_3", partyId: "party_a", subjectId: "subj_low" });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.topProperties[0].subjectId, "subj_high");
  assert.equal(portfolio.topProperties[0].inquiryCount, 2);
  assert.equal(portfolio.topProperties[0].interestedCount, 2);
  assert.equal(portfolio.topProperties[1].subjectId, "subj_low");
});

test("buildSubjectPortfolioProjection open vs completed follow-up work", () => {
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_a", displayName: "Unit A" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_a" });
  seedFollowUpWork(workRuntime, { id: "work_open", requestId: "req_1", subjectId: "subj_a", dueAt: "2026-07-10T00:00:00.000Z" });
  seedFollowUpWork(workRuntime, {
    id: "work_done",
    requestId: "req_1",
    subjectId: "subj_a",
    dueAt: "2026-07-10T00:00:00.000Z",
    status: "completed",
  });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, requestRuntime: requests, workRuntime }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.totals.openFollowUps, 1);
  assert.equal(portfolio.topProperties[0].openFollowUpCount, 1);
});

test("buildSubjectPortfolioProjection overdue follow-up semantics", () => {
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_a", displayName: "Unit A" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_a" });
  seedFollowUpWork(workRuntime, { id: "work_overdue", requestId: "req_1", subjectId: "subj_a", dueAt: "2026-06-01T00:00:00.000Z" });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, requestRuntime: requests, workRuntime }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.totals.overdueFollowUps, 1);
  assert.equal(portfolio.topProperties[0].overdueFollowUpCount, 1);
});

test("buildSubjectPortfolioProjection inactive property preserves historical metrics", () => {
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

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, businessGraphRuntime: graph, requestRuntime: requests }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.totals.totalProperties, 1);
  assert.equal(portfolio.totals.activeProperties, 0);
  assert.equal(portfolio.topProperties[0].inquiryCount, 1);
  assert.equal(portfolio.topProperties[0].interestedCount, 1);
  assert.equal(portfolio.topProperties[0].status, "archived");
});

test("buildSubjectPortfolioProjection unattributed inquiries", () => {
  const requests = new RequestRuntime({ nowISO: NOW });
  seedInquiry(requests, { id: "req_unattrib", partyId: "party_a", subjectId: null });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ requestRuntime: requests }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.totals.openInquiries, 1);
  assert.equal(portfolio.totals.unattributedInquiries, 1);
  assert.equal(portfolio.topProperties.length, 0);
});

test("buildSubjectPortfolioProjection maintenance requests do not affect inquiry metrics", () => {
  const subjects = new BusinessSubjectRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  seedSubject(subjects, { id: "subj_a", displayName: "123 Oak" });
  seedInquiry(requests, { id: "req_prospect", partyId: "party_a", subjectId: "subj_a" });
  requests.applyEvent({
    id: "evt_req_maint",
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: createRequest({
        id: "req_maint",
        title: "Leak",
        description: "Sink leak",
        requestType: "MAINTENANCE_REQUEST",
        status: "received",
        priority: "high",
        channel: "website",
        source: "app",
        requester: "party_b",
        receivedAt: NOW,
        subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_a" })],
      }),
    },
  });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx({ businessSubjectRuntime: subjects, requestRuntime: requests }),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PM_PRESENTATION,
  });

  assert.equal(portfolio.totals.totalInquiries, 1);
  assert.equal(portfolio.totals.openInquiries, 1);
  assert.equal(portfolio.topProperties[0].inquiryCount, 1);
});
