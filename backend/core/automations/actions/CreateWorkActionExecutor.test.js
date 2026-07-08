import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkRuntime } from "../../work/WorkRuntime.js";
import { CreateWorkActionExecutor } from "./CreateWorkActionExecutor.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("CreateWorkActionExecutor: creates canonical work + preserves relatedObjects + dueAt", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });

  const workPlatformEventPublisher = {
    publishWorkCreated: () => Object.freeze({ status: "PUBLISHED", errors: [] }),
  };

  const executor = new CreateWorkActionExecutor({ workPlatformEventPublisher });

  const action = Object.freeze({
    id: "act_1",
    actionType: "CREATE_WORK",
    parameters: Object.freeze({
      workItemId: "work_follow_up_int_1",
      workType: "follow_up",
      title: "Follow up",
      description: "deterministic",
      priority: "low",
      assignedTo: "tm_owner",
      dueAt: "2026-07-03T15:00:00.000Z",
      relatedObjects: [{ requestId: "req_1" }, { partyId: "party_1" }],
      stageId: "stage_follow_up",
      queueId: "queue_follow_up",
      status: "new",
      requestedBy: "tm_system",
      source: "automation:follow_up_required",
      metadata: { derivedFrom: { x: 1 } },
    }),
  });

  const res1 = executor.execute({
    action,
    context: { nowISO: NOW0, workRuntime, triggerEventId: "evt_trigger_1" },
  });

  assert.equal(res1.status, "COMPLETED");
  assert.equal(res1.output?.created, true);
  const wi = workRuntime.getWorkItem("work_follow_up_int_1");
  assert.ok(wi);
  assert.equal(String(wi.dueAt), "2026-07-03T15:00:00.000Z");
  assert.deepEqual(wi.relatedObjects, action.parameters.relatedObjects);

  // Idempotency: second execute should not create duplicates.
  const res2 = executor.execute({
    action,
    context: { nowISO: NOW0, workRuntime, triggerEventId: "evt_trigger_1" },
  });
  assert.equal(res2.output?.created, false);
});

test("CreateWorkActionExecutor: invalid action configuration fails deterministically", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW0 });
  const executor = new CreateWorkActionExecutor({
    workPlatformEventPublisher: { publishWorkCreated: () => ({ status: "PUBLISHED" }) },
  });

  assert.throws(
    () =>
      executor.validatePlan({
        action: {
          id: "act_bad",
          actionType: "CREATE_WORK",
          parameters: { workItemId: "work_1", title: "t" },
        },
      }),
    /parameters.description required/,
  );
});
