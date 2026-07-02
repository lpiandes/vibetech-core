import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkRuntime } from "../../work/WorkRuntime.js";

import { WorkCreationService } from "./WorkCreationService.js";
import { deterministicWorkEventId } from "./WorkCreationMapper.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

function makeWorkItemInput({ id = "work_1", assignedTo = "tm_1" } = {}) {
  return {
    id,
    title: "Work item",
    description: "Deterministic work item.",
    workType: "inquiry",
    status: "new",
    priority: "medium",
    stageId: "stage_intake",
    queueId: "queue_needs_review",
    assignedTo,
    requestedBy: "owner",
    source: "seed",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    dueAt: null,
    completedAt: null,
    blockedReason: null,
    relatedObjects: ["req_1"],
    requirements: [],
    metadata: {},
  };
}

test("WorkCreationService: successful creation via WorkRuntime.applyEvent", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });
  const service = new WorkCreationService();
  const workItemInput = makeWorkItemInput({ id: "work_created_1", assignedTo: "tm_42" });

  const res = service.createWorkItem({
    workRuntime,
    workItemInput,
    requestConvertedEventId: "evt_req_conv_1",
    convertedAtISO: NOW_ISO,
  });

  assert.equal(res.status, "SUCCESS");
  assert.equal(res.created, true);
  assert.equal(res.workItemId, "work_created_1");
  assert.equal(res.workRuntimeUpdated, true);

  const stored = workRuntime.getWorkItem("work_created_1");
  assert.ok(stored);
  assert.equal(stored.assignedTo, "tm_42");

  const expectedEventId = deterministicWorkEventId({ workItemId: "work_created_1", requestConvertedEventId: "evt_req_conv_1" });
  assert.equal(res.workEventId, expectedEventId);
});

test("WorkCreationService: missing runtime => FAILED with immutable errors", () => {
  const service = new WorkCreationService();
  const workItemInput = makeWorkItemInput();
  const res = service.createWorkItem({ workRuntime: null, workItemInput });

  assert.equal(res.status, "FAILED");
  assert.equal(res.created, false);
  assert.equal(res.errors.length > 0, true);
  assert.ok(Object.isFrozen(res));
  assert.ok(Object.isFrozen(res.errors));
});

test("WorkCreationService: invalid work input => FAILED", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });
  const service = new WorkCreationService();

  const badInput = { id: "work_bad" }; // missing required fields
  const res = service.createWorkItem({ workRuntime, workItemInput: badInput });
  assert.equal(res.status, "FAILED");
  assert.equal(res.workItemId, "work_bad");
});

test("WorkCreationService: applyEvent failure => FAILED", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });
  const service = new WorkCreationService();
  const workItemInput = makeWorkItemInput({ id: "work_fail_1" });

  workRuntime.applyEvent = () => {
    throw new Error("applyEvent boom");
  };

  const res = service.createWorkItem({ workRuntime, workItemInput, requestConvertedEventId: "evt_conv", convertedAtISO: NOW_ISO });
  assert.equal(res.status, "FAILED");
  assert.equal(res.workItemId, "work_fail_1");
  assert.ok(res.errors.some((e) => String(e).includes("applyEvent boom")));
});

test("WorkCreationService: created work item exists afterwards", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });
  const service = new WorkCreationService();
  const workItemInput = makeWorkItemInput({ id: "work_exists_after_1" });

  const res = service.createWorkItem({ workRuntime, workItemInput, requestConvertedEventId: "evt_conv_2", convertedAtISO: NOW_ISO });
  assert.equal(res.status, "SUCCESS");
  assert.ok(workRuntime.getWorkItem("work_exists_after_1"));
});

