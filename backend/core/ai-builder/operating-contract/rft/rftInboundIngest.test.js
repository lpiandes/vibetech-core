import assert from "node:assert/strict";
import { test } from "node:test";

import { ingestRftInboundEvent, escalateRftOnExternalFailure } from "./rftInboundIngest.js";
import { buildDefaultRevenueFollowThroughEmployee } from "./rftBlueprint.js";
import { getRftOpportunityTrace } from "./rftOpportunityRuntime.js";
import { RFT_PIPELINE_ID } from "./rftCatalog.js";

function memoryStore(seedInstallation) {
  let installation = structuredClone(seedInstallation);
  return {
    async getBusinessOSInstallation() {
      return structuredClone(installation);
    },
    async upsertBusinessOSInstallation(next) {
      installation = {
        ...installation,
        ...next,
        configuration: next.configuration ?? installation.configuration,
      };
      return installation;
    },
  };
}

function baseInstallation() {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  return {
    businessId: "biz_rft_loop",
    id: "install_biz_rft_loop",
    specificationId: "spec_1",
    specificationVersion: 1,
    planId: "plan_1",
    status: "installed",
    configuration: {
      employees: [employee],
      crm: { contacts: [], pipelines: [] },
    },
  };
}

test("ingestRftInboundEvent refuses without provider id", async () => {
  const installation = baseInstallation();
  const store = memoryStore(installation);
  const result = await ingestRftInboundEvent({
    platformStore: store,
    installation,
    eventType: "INBOUND_SALES_EMAIL",
    payload: { subject: "Hello", from: { email: "a@b.com" } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_provider_id");
});

test("ingestRftInboundEvent seeds and advances to ApprovalRequired by default", async () => {
  const installation = baseInstallation();
  const store = memoryStore(installation);
  const result = await ingestRftInboundEvent({
    platformStore: store,
    installation,
    eventType: "INBOUND_SALES_EMAIL",
    payload: {
      gmailMessageId: "msg_abc_123",
      subject: "Need a quote",
      from: { name: "Pat", email: "pat@example.com" },
      channel: "gmail",
    },
    actorId: "test",
  });
  assert.equal(result.ok, true);
  assert.ok(result.cardId);
  assert.equal(result.state, "ApprovalRequired");
  assert.equal(result.seeded, true);

  const fresh = await store.getBusinessOSInstallation();
  const trace = getRftOpportunityTrace(fresh, result.cardId);
  assert.equal(trace.rft.state, "ApprovalRequired");
  assert.ok(trace.rft.evidence.some((e) => e.providerId === "msg_abc_123"));
  // Never Verified without more proof path
  assert.notEqual(trace.rft.state, "Verified");
});

test("ingestRftInboundEvent is idempotent on same gmail message id", async () => {
  const installation = baseInstallation();
  const store = memoryStore(installation);
  const payload = {
    gmailMessageId: "msg_dup_1",
    subject: "Again",
    from: { email: "x@y.com", name: "X" },
  };
  const first = await ingestRftInboundEvent({
    platformStore: store,
    installation: await store.getBusinessOSInstallation(),
    eventType: "INBOUND_SALES_EMAIL",
    payload,
  });
  const second = await ingestRftInboundEvent({
    platformStore: store,
    installation: await store.getBusinessOSInstallation(),
    eventType: "INBOUND_SALES_EMAIL",
    payload,
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(first.cardId, second.cardId);

  const fresh = await store.getBusinessOSInstallation();
  const pipe = (fresh.configuration.crm.pipelines ?? []).find((p) => p.id === RFT_PIPELINE_ID);
  const matching = (pipe?.cards ?? []).filter((c) =>
    (c.rft?.evidence ?? []).some((e) => e.providerId === "msg_dup_1"),
  );
  assert.equal(matching.length, 1);
});

test("escalateRftOnExternalFailure moves card to Exception", async () => {
  const installation = baseInstallation();
  const store = memoryStore(installation);
  const seeded = await ingestRftInboundEvent({
    platformStore: store,
    installation,
    eventType: "INBOUND_SALES_EMAIL",
    payload: {
      gmailMessageId: "msg_fail_1",
      from: { email: "f@e.com", name: "F" },
      subject: "Fail path",
    },
  });
  const escalated = await escalateRftOnExternalFailure({
    platformStore: store,
    installation: await store.getBusinessOSInstallation(),
    providerId: "msg_fail_1",
    note: "send_email failed",
  });
  assert.equal(escalated.ok, true);
  assert.equal(escalated.state, "Exception");
  const trace = getRftOpportunityTrace(await store.getBusinessOSInstallation(), seeded.cardId);
  assert.equal(trace.rft.state, "Exception");
});
