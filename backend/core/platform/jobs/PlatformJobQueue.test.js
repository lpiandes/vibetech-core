import assert from "node:assert/strict";
import test from "node:test";

import {
  DurableWorkflowExecutor,
  InMemoryPlatformJobQueue,
  JOB_TYPES,
} from "./PlatformJobQueue.js";

test("enqueue is idempotent for same business+type+key", async () => {
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => "2026-07-18T12:00:00.000Z" });
  const a = await queue.enqueue({
    businessId: "biz_1",
    jobType: JOB_TYPES.WORKFLOW_STEP,
    idempotencyKey: "lead:1",
    payload: { n: 1 },
  });
  const b = await queue.enqueue({
    businessId: "biz_1",
    jobType: JOB_TYPES.WORKFLOW_STEP,
    idempotencyKey: "lead:1",
    payload: { n: 2 },
  });
  assert.equal(a.id, b.id);
  assert.equal(b.deduped, true);
  assert.equal((await queue.listForBusiness("biz_1")).length, 1);
});

test("lead intake workflow waits for approval and never silent-sends", async () => {
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => "2026-07-18T12:00:00.000Z" });
  const sends = [];
  const executor = new DurableWorkflowExecutor({
    queue,
    nowISO: () => "2026-07-18T12:00:00.000Z",
    sendOutbound: async (payload) => {
      sends.push(payload);
    },
  });

  const started = await executor.startLeadIntakeWorkflow({
    businessId: "biz_sports",
    leadId: "lead_meta_1",
    contact: { name: "Parent Smith" },
    channel: "email",
    outboundApproved: false,
  });
  assert.equal(started.ok, true);

  let guard = 0;
  let waiting = false;
  while (guard < 20) {
    const result = await executor.processNext();
    if (!result) break;
    if (result.waitingApproval) {
      waiting = true;
      break;
    }
    guard += 1;
  }

  assert.equal(waiting, true);
  assert.equal(sends.length, 0);

  const outbound = await queue.enqueue({
    businessId: "biz_sports",
    jobType: JOB_TYPES.OUTBOUND_SEND,
    idempotencyKey: "outbound:lead_meta_1:email",
    payload: { channel: "email", outboundApproved: false, leadId: "lead_meta_1" },
  });
  await executor.processNext();
  const failed = (await queue.listForBusiness("biz_sports")).find((j) => j.id === outbound.id);
  assert.ok(failed.status === "failed" || failed.status === "dead");
  assert.match(String(failed.errorMessage), /outbound_approval/);
});

test("approved outbound send records audit and completes", async () => {
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => "2026-07-18T12:00:00.000Z" });
  const sends = [];
  const executor = new DurableWorkflowExecutor({
    queue,
    sendOutbound: async (p) => sends.push(p),
  });

  await queue.enqueue({
    businessId: "biz_1",
    jobType: JOB_TYPES.OUTBOUND_SEND,
    idempotencyKey: "out:1",
    payload: { channel: "sms", outboundApproved: true },
  });
  const result = await executor.processNext();
  assert.equal(result.ok, true);
  assert.equal(result.sent, true);
  assert.equal(sends.length, 1);
  const audit = queue.getAudit(result.jobId);
  assert.ok(audit.some((a) => a.eventType === "completed"));
});
