import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { createRequest } from "../request/Request.js";
import { WorkRuntime } from "../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { createWorkItem } from "../work/WorkItem.js";
import { createWorkAssignment } from "../work/WorkAssignment.js";
import { ENTITY_TYPES, createEntityRef } from "../references/EntityRef.js";
import { buildEngagementTimeline } from "./EngagementTimelineBuilder.js";
import { TIMELINE_ITEM_TYPES } from "./EngagementDefaults.js";

const PARTY_CREATED_AT = "2026-06-30T12:00:00.000Z";
const RELATIONSHIP_AT = "2026-06-30T12:05:00.000Z";
const REQUEST_ONE_AT = "2026-07-07T22:09:00.000Z";
const REQUEST_TWO_AT = "2026-07-07T22:24:00.000Z";
const STALE_WORK_AT = "2026-06-30T12:00:00.000Z";

function seedParty(graph, { partyId = "party_resident" } = {}) {
  graph.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: PARTY_CREATED_AT,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id: partyId,
        partyType: "PERSON",
        displayName: "Jane Resident",
        status: "active",
        contactMethods: ["jane@example.com"],
        externalReferences: [],
        metadata: {},
        createdAt: PARTY_CREATED_AT,
        updatedAt: PARTY_CREATED_AT,
      },
    },
  });
}

function seedRelationship(graph, { id, type, partyId, subjectId = "subj_main" }) {
  graph.applyEvent({
    id: `evt_rel_${id}`,
    timestampISO: RELATIONSHIP_AT,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "test",
    payload: {
      relationship: {
        id,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
        relationshipType: type,
        status: "active",
        effectiveFrom: RELATIONSHIP_AT,
        effectiveTo: null,
        metadata: {},
        createdAt: RELATIONSHIP_AT,
        updatedAt: RELATIONSHIP_AT,
      },
    },
  });
}

function seedRequest(requests, { id, partyId, receivedAt, title }) {
  requests.applyEvent({
    id: `evt_${id}`,
    timestampISO: receivedAt,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: createRequest({
        id,
        title,
        description: title,
        requestType: "MAINTENANCE_REQUEST",
        status: "received",
        priority: "high",
        channel: "website",
        source: "vibetech_app",
        requester: partyId,
        receivedAt,
        subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_main" })],
      }),
    },
  });
}

function seedWorkWithStaleAssignment(workRuntime, { workId, requestId, partyId, assigneeId, assignedAt }) {
  workRuntime.applyEvent({
    id: `evt_work_created_${workId}`,
    timestampISO: STALE_WORK_AT,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: {
      workItem: createWorkItem({
        id: workId,
        title: `Work for ${requestId}`,
        description: "Maintenance coordination",
        workType: "maintenance_coordination",
        status: "new",
        priority: "high",
        stageId: "stage_execution",
        queueId: "queue_in_progress",
        assignedTo: assigneeId,
        requestedBy: partyId,
        source: "automation",
        dueAt: null,
        createdAt: STALE_WORK_AT,
        updatedAt: STALE_WORK_AT,
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
          createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_main" }),
        ],
        requirements: [],
        metadata: {},
      }),
    },
  });

  workRuntime.applyEvent({
    id: `evt_work_assigned_${workId}`,
    timestampISO: assignedAt,
    type: WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED,
    source: "test",
    payload: {
      assignment: createWorkAssignment({
        id: `assign_${workId}_${assigneeId}`,
        workItemId: workId,
        assigneeId,
        assigneeType: "digital_employee",
        assignedAt,
        assignedBy: "team_os",
        status: "active",
        metadata: {},
      }),
    },
  });
}

test("buildEngagementTimeline: requester-linked maintenance requests use receivedAt, not party createdAt", () => {
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: REQUEST_TWO_AT });

  seedParty(graph);
  seedRequest(requests, {
    id: "req_maint_1",
    partyId: "party_resident",
    receivedAt: REQUEST_TWO_AT,
    title: "Fuse box",
  });

  const timeline = buildEngagementTimeline({
    partyId: "party_resident",
    businessGraphRuntime: graph,
    requestRuntime: requests,
  });

  const requestItem = timeline.find((item) => item.type === TIMELINE_ITEM_TYPES.REQUEST_CREATED);
  assert.ok(requestItem);
  assert.equal(requestItem.occurredAt, REQUEST_TWO_AT);
  assert.notEqual(requestItem.occurredAt, PARTY_CREATED_AT);
});

test("buildEngagementTimeline: preserves old party dates but uses request occurrence for new work assignments", () => {
  const graph = new BusinessGraphRuntime();
  const requests = new RequestRuntime({ nowISO: REQUEST_TWO_AT });
  const workRuntime = new WorkRuntime({ nowISO: STALE_WORK_AT });
  const partyId = "party_resident";

  seedParty(graph, { partyId });
  seedRelationship(graph, { id: "rel_resident", type: "RESIDENT", partyId });
  seedRelationship(graph, { id: "rel_resident_of", type: "RESIDENT_OF", partyId });

  seedRequest(requests, {
    id: "req_maint_1",
    partyId,
    receivedAt: REQUEST_ONE_AT,
    title: "Fuse box",
  });
  seedRequest(requests, {
    id: "req_maint_2",
    partyId,
    receivedAt: REQUEST_TWO_AT,
    title: "Roof leaking",
  });

  seedWorkWithStaleAssignment(workRuntime, {
    workId: "work_maint_1",
    requestId: "req_maint_1",
    partyId,
    assigneeId: "pm_maintenance_coordinator",
    assignedAt: STALE_WORK_AT,
  });
  seedWorkWithStaleAssignment(workRuntime, {
    workId: "work_maint_2",
    requestId: "req_maint_2",
    partyId,
    assigneeId: "pm_maintenance_coordinator",
    assignedAt: STALE_WORK_AT,
  });

  const timeline = buildEngagementTimeline({
    partyId,
    businessGraphRuntime: graph,
    requestRuntime: requests,
    workRuntime,
  });

  const partyCreated = timeline.find((item) => item.type === TIMELINE_ITEM_TYPES.PARTY_CREATED);
  assert.equal(partyCreated?.occurredAt, PARTY_CREATED_AT);

  const relationships = timeline.filter((item) => item.type === TIMELINE_ITEM_TYPES.RELATIONSHIP_CREATED);
  assert.equal(relationships.length, 2);
  assert.ok(relationships.every((item) => item.occurredAt === RELATIONSHIP_AT));

  const requestItems = timeline.filter((item) => item.type === TIMELINE_ITEM_TYPES.REQUEST_CREATED);
  assert.equal(requestItems.length, 2);
  assert.deepEqual(
    requestItems.map((item) => item.occurredAt).sort(),
    [REQUEST_ONE_AT, REQUEST_TWO_AT].sort(),
  );

  const assignedItems = timeline.filter((item) => item.type === TIMELINE_ITEM_TYPES.WORK_ASSIGNED);
  assert.equal(assignedItems.length, 2);
  assert.deepEqual(
    assignedItems.map((item) => item.occurredAt).sort(),
    [REQUEST_ONE_AT, REQUEST_TWO_AT].sort(),
  );
  assert.ok(assignedItems.every((item) => item.occurredAt !== PARTY_CREATED_AT));
});
