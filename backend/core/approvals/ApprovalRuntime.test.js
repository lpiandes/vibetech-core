import assert from "node:assert/strict";
import { test } from "node:test";

import { ApprovalRuntime } from "./ApprovalRuntime.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "./ApprovalEventTypes.js";
import { createApprovalRequest } from "./ApprovalRequest.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("ApprovalRuntime: starts empty with zero-state metrics", () => {
  const runtime = new ApprovalRuntime({ nowISO: NOW0 });
  assert.equal(runtime.getRequests().length, 0);
  assert.equal(Number(runtime.getMetrics()?.pendingRequests ?? 0), 0);
  assert.equal(Number(runtime.getMetrics()?.grantedRequests ?? 0), 0);
  assert.equal(Number(runtime.getMetrics()?.rejectedRequests ?? 0), 0);
});

test("ApprovalRuntime: request lifecycle is deterministic and immutable", () => {
  const runtime = new ApprovalRuntime({ nowISO: NOW0 });
  const approvalId = "approval_run_1_act_1";

  runtime.applyEvent({
    id: "evt_approval_requested_1",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REQUESTED,
    payload: {
      request: createApprovalRequest({
        id: approvalId,
        requestType: "automation_action",
        source: "automation_os",
        sourceReference: { runId: "run_1", actionId: "act_1" },
        status: "PENDING",
        requestedAt: NOW0,
        requestedBy: "automation_engine",
        requiredApprover: "role:authorized_reviewer",
        context: { actionType: "CREATE_WORK" },
      }),
    },
  });

  assert.equal(runtime.getRequests().length, 1);
  assert.equal(Number(runtime.getMetrics()?.totalRequests ?? 0), 1);
  assert.equal(Number(runtime.getMetrics()?.pendingRequests ?? 0), 1);

  runtime.applyEvent({
    id: "evt_approval_granted_1",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_GRANTED,
    payload: { approvalId, decidedAt: NOW0 },
  });

  const req = runtime.getRequestById(approvalId);
  assert.equal(req.status, "GRANTED");
  assert.equal(Number(runtime.getMetrics()?.grantedRequests ?? 0), 1);

  assert.throws(() => {
    runtime.applyEvent({
      id: "evt_approval_granted_dup",
      timestampISO: NOW0,
      type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_GRANTED,
      payload: { approvalId, decidedAt: NOW0 },
    });
  }, /not pending/);
});

test("ApprovalRuntime: rejection updates metrics deterministically", () => {
  const runtime = new ApprovalRuntime({ nowISO: NOW0 });
  const approvalId = "approval_run_2_act_1";

  runtime.applyEvent({
    id: "evt_approval_requested_2",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REQUESTED,
    payload: {
      request: createApprovalRequest({
        id: approvalId,
        requestType: "automation_action",
        source: "automation_os",
        sourceReference: { runId: "run_2", actionId: "act_1" },
        status: "PENDING",
        requestedAt: NOW0,
        requestedBy: "automation_engine",
        requiredApprover: "role:authorized_reviewer",
        context: { actionType: "CREATE_WORK" },
      }),
    },
  });

  runtime.applyEvent({
    id: "evt_approval_rejected_2",
    timestampISO: NOW0,
    type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REJECTED,
    payload: { approvalId, decidedAt: NOW0 },
  });

  assert.equal(runtime.getRequestById(approvalId).status, "REJECTED");
  assert.equal(Number(runtime.getMetrics()?.rejectedRequests ?? 0), 1);
});
