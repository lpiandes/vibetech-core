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
import { InteractionRuntime } from "../../interactions/InteractionRuntime.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { createWorkItem } from "../../work/WorkItem.js";
import { ENTITY_TYPES, createEntityRef } from "../../references/EntityRef.js";
import { buildSubjectOperatingDetail } from "./buildSubjectOperatingDetail.js";
import { buildSubjectPortfolioProjection } from "./buildSubjectPortfolioProjection.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";

const NOW = "2026-07-07T20:00:00.000Z";
const SUBJECT_TYPES = ["property", "listing", "unit"];

function seedSubject(subjects, { id, displayName }) {
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
        subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })],
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
}

test("buildSubjectOperatingDetail matches portfolio row totals", () => {
  const subjects = new BusinessSubjectRuntime();
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: NOW });
  const interactions = new InteractionRuntime();
  const workRuntime = new WorkRuntime({ nowISO: NOW });

  seedSubject(subjects, { id: "subj_a", displayName: "742 Harbor Lane" });
  seedParty(graph, { id: "party_a", displayName: "Alex" });
  seedInterestedIn(graph, { partyId: "party_a", subjectId: "subj_a" });
  seedInquiry(requests, { id: "req_1", partyId: "party_a", subjectId: "subj_a" });
  seedInquiry(requests, { id: "req_2", partyId: "party_a", subjectId: "subj_a" });

  workRuntime.applyEvent({
    id: "evt_work_1",
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: {
      workItem: createWorkItem({
        id: "work_1",
        title: "Prospect follow-up",
        description: "Follow up",
        workType: "prospect_follow_up",
        status: "in_progress",
        priority: "medium",
        stageId: "stage_intake",
        queueId: "queue_needs_review",
        assignedTo: "unassigned",
        requestedBy: "party_a",
        source: "automation",
        dueAt: "2026-06-01T00:00:00.000Z",
        createdAt: NOW,
        updatedAt: NOW,
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: "req_1" }),
          createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_a" }),
        ],
        requirements: [],
        metadata: {},
      }),
    },
  });

  const ctx = {
    businessSubjectRuntime: subjects,
    businessGraphRuntime: graph,
    requestRuntime: requests,
    interactionRuntime: interactions,
    workRuntime,
  };

  const portfolio = buildSubjectPortfolioProjection({
    ctx,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });
  const detail = buildSubjectOperatingDetail({
    subjectId: "subj_a",
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  const row = portfolio.subjects.find((s) => s.subjectId === "subj_a");
  assert.equal(detail.metrics.inquiryCount, row.inquiryCount);
  assert.equal(detail.metrics.interestedCount, row.interestedCount);
  assert.equal(detail.metrics.openFollowUpCount, row.openFollowUpCount);
  assert.equal(detail.recentInquiries.length, 2);
  assert.equal(detail.openWork.length, 1);
  assert.ok(detail.openWork[0].overdue);
});

test("buildSubjectOperatingDetail returns null for unknown subject", () => {
  const detail = buildSubjectOperatingDetail({
    subjectId: "missing",
    ctx: { businessSubjectRuntime: new BusinessSubjectRuntime() },
    nowISO: NOW,
  });
  assert.equal(detail, null);
});
