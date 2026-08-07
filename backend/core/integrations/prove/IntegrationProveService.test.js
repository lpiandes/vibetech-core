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

test("book_test_slot requires calendar connection and proves a confirmed live booking", async () => {
  const notConnected = await runIntegrationProveTest({
    action: PROVE_ACTIONS.book_test_slot,
    connectionStatus: "NOT_CONNECTED",
  });
  assert.equal(notConnected.ok, false);
  assert.equal(notConnected.status, "needs_setup");

  const confirmed = await runIntegrationProveTest({
    action: PROVE_ACTIONS.book_test_slot,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, liveSlotBook: true, confirmed: true, externalReference: "evt_slot_1" }),
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.status, "proven");
  assert.match(confirmed.message, /confirmed/i);
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

test("CRM prove rejects simulated or missing provider id", async () => {
  const simulated = await runIntegrationProveTest({
    action: PROVE_ACTIONS.sync_test_crm_contact,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, simulated: true, providerId: "hs_1" }),
  });
  assert.equal(simulated.ok, false);
  assert.equal(simulated.reason, "simulated_not_allowed");

  const noId = await runIntegrationProveTest({
    action: PROVE_ACTIONS.sync_test_crm_contact,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, simulated: false }),
  });
  assert.equal(noId.ok, false);
  assert.equal(noId.reason, "missing_provider_reference");

  const live = await runIntegrationProveTest({
    action: PROVE_ACTIONS.sync_test_crm_contact,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, simulated: false, providerId: "hs_99", externalReference: "hs_99" }),
  });
  assert.equal(live.ok, true);
  assert.equal(live.status, "proven");
});

test("outbound campaign call prove requires owner GRANT before dialing", async () => {
  const blocked = await runIntegrationProveTest({
    action: PROVE_ACTIONS.place_test_outbound_call,
    connectionStatus: "CONNECTED",
    outboundApproved: false,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "outbound_approval_required");
  assert.match(blocked.honestLabel, /campaign dial/i);

  const granted = await runIntegrationProveTest({
    action: PROVE_ACTIONS.place_test_outbound_call,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({
      ok: true,
      simulated: false,
      externalReference: "CAxxxx",
      campaignId: "ovc_1",
    }),
  });
  assert.equal(granted.ok, true);
  assert.equal(granted.status, "proven");
});

test("outbound campaign call prove rejects simulated or missing call sid", async () => {
  const simulated = await runIntegrationProveTest({
    action: PROVE_ACTIONS.place_test_outbound_call,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({ ok: true, simulated: true, externalReference: "CAxxxx" }),
  });
  assert.equal(simulated.ok, false);
  assert.equal(simulated.reason, "simulated_not_allowed");

  const missingRef = await runIntegrationProveTest({
    action: PROVE_ACTIONS.place_test_outbound_call,
    connectionStatus: "CONNECTED",
    outboundApproved: true,
    execute: async () => ({ ok: true, simulated: false }),
  });
  assert.equal(missingRef.ok, false);
  assert.equal(missingRef.reason, "missing_provider_reference");
});

test("CRM pull sync prove requires at least one live contact", async () => {
  const empty = await runIntegrationProveTest({
    action: PROVE_ACTIONS.sync_pull_crm_contacts,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, simulated: false, pulled: 0, contacts: [] }),
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "missing_provider_reference");

  const live = await runIntegrationProveTest({
    action: PROVE_ACTIONS.sync_pull_crm_contacts,
    connectionStatus: "CONNECTED",
    execute: async () => ({ ok: true, simulated: false, pulled: 2, contacts: [{ id: "hs_1" }, { id: "hs_2" }] }),
  });
  assert.equal(live.ok, true);
  assert.equal(live.status, "proven");
});
