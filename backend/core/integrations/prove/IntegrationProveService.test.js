import assert from "node:assert/strict";
import test from "node:test";

import {
  proofRecordFromResult,
  PROVE_ACTIONS,
  runIntegrationProveTest,
} from "./IntegrationProveService.js";

test("prove test refuses when not connected", async () => {
  const result = await runIntegrationProveTest({
    action: PROVE_ACTIONS.send_test_email,
    connectionStatus: "NOT_CONNECTED",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "needs_setup");
});

test("Gmail prove requires approval and uses honest label", async () => {
  const blocked = await runIntegrationProveTest({
    action: PROVE_ACTIONS.send_test_email,
    connectionStatus: "CONNECTED",
    outboundApproved: false,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.verified, true);
  assert.match(blocked.honestLabel, /not full inbox/i);

  const proven = await runIntegrationProveTest({
    action: PROVE_ACTIONS.send_test_email,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({ ok: true, messageId: "msg_test", externalReference: "msg_test" }),
  });
  assert.equal(proven.ok, true);
  assert.equal(proven.status, "proven");
  assert.match(proven.message, /Test email/);
});

test("SMS prove rejects simulated or missing Twilio SID", async () => {
  const simulated = await runIntegrationProveTest({
    action: PROVE_ACTIONS.send_test_sms,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({ ok: true, simulated: true }),
  });
  assert.equal(simulated.ok, false);

  const noSid = await runIntegrationProveTest({
    action: PROVE_ACTIONS.send_test_sms,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({ ok: true }),
  });
  assert.equal(noSid.ok, false);

  const live = await runIntegrationProveTest({
    action: PROVE_ACTIONS.send_test_sms,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({ ok: true, externalReference: "SMxxxxxxxx", simulated: false }),
  });
  assert.equal(live.ok, true);
});

test("prove without execute fails closed", async () => {
  const result = await runIntegrationProveTest({
    action: PROVE_ACTIONS.create_test_event,
    connectionStatus: "CONNECTED",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "execute_missing");
});

test("calendar prove creates test event when connected", async () => {
  const result = await runIntegrationProveTest({
    action: PROVE_ACTIONS.create_test_event,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, eventId: "evt_test", externalReference: "evt_test" }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "proven");
});

test("voice prove verifies credentials when execute succeeds", async () => {
  const result = await runIntegrationProveTest({
    action: PROVE_ACTIONS.place_test_call,
    connectionStatus: "CONNECTED",
    execute: async () => ({
      ok: true,
      simulated: false,
      provider: "twilio_voice",
      message: "Twilio Voice credentials verified.",
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "proven");
});

test("proofRecordFromResult maps into capability registry shape", async () => {
  const proven = await runIntegrationProveTest({
    action: PROVE_ACTIONS.ingest_test_lead,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, workId: "work_1" }),
  });
  const record = proofRecordFromResult("meta_lead_intake", proven);
  assert.equal(record.ok, true);
  assert.equal(record.capabilityId, "meta_lead_intake");
});
