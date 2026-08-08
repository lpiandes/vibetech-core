import assert from "node:assert/strict";
import { test } from "node:test";

import {
  describeSmsCarrierStatus,
  normalizeSmsCarrierPhase,
  resolveSmsCarrierPhaseFromConnection,
  smsCarrierOwnerCopy,
  smsConnectStepComplete,
} from "./smsCarrierStatus.js";

test("normalizeSmsCarrierPhase maps known statuses", () => {
  assert.equal(normalizeSmsCarrierPhase("approved"), "approved");
  assert.equal(normalizeSmsCarrierPhase("COMPLETE"), "approved");
  assert.equal(normalizeSmsCarrierPhase("pending"), "pending");
  assert.equal(normalizeSmsCarrierPhase("failed"), "failed");
  assert.equal(normalizeSmsCarrierPhase(""), "unknown");
});

test("resolveSmsCarrierPhaseFromConnection reads metadata", () => {
  assert.equal(
    resolveSmsCarrierPhaseFromConnection({ metadata: { a2pRegistrationStatus: "approved" } }),
    "approved",
  );
  assert.equal(
    resolveSmsCarrierPhaseFromConnection({ a2pRegistrationStatus: "pending" }),
    "pending",
  );
});

test("smsCarrierOwnerCopy is honest about pending delivery", () => {
  const copy = smsCarrierOwnerCopy({ metadata: { a2pRegistrationStatus: "pending" } });
  assert.match(copy, /carrier approval pending/i);
  assert.match(copy, /Refresh status/i);
  const desc = describeSmsCarrierStatus({ a2pRegistrationStatus: "approved" });
  assert.equal(desc.deliveryLikely, true);
});

test("smsConnectStepComplete requires Connected + approved", () => {
  assert.equal(smsConnectStepComplete("CONNECTED"), false);
  assert.equal(smsConnectStepComplete({ status: "CONNECTED", a2pRegistrationStatus: "pending" }), false);
  assert.equal(smsConnectStepComplete({ status: "CONNECTED", a2pRegistrationStatus: "approved" }), true);
});
