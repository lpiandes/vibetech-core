import assert from "node:assert/strict";
import test from "node:test";

import { runSportsGoldenPath } from "./SportsGoldenPath.js";
import { assertNoPhi, runDentalGoldenPath } from "./DentalGoldenPath.js";

test("sports golden path completes lead → registration → approved send → schedule", async () => {
  const result = await runSportsGoldenPath({ outboundApproved: true });
  assert.equal(result.ok, true);
  assert.equal(result.capabilityId, "sports_registration_golden_path");
  assert.match(result.workHref, /workId=work_registration_1/);
  assert.ok(result.events.some((e) => e.type === "lead_captured"));
  assert.ok(result.events.some((e) => e.type === "parent_notification_sent"));
  assert.ok(result.events.some((e) => e.type === "schedule_event_created"));
  assert.equal(result.proof.ok, true);
});

test("sports golden path waits when outbound not approved", async () => {
  const result = await runSportsGoldenPath({ outboundApproved: false });
  assert.equal(result.ok, true);
  assert.equal(result.waitingApproval, true);
  assert.ok(!result.events.some((e) => e.type === "parent_notification_sent"));
});

test("dental golden path blocks PHI fields and completes non-PHI intake", async () => {
  assert.throws(() => assertNoPhi({ diagnosis: "x" }), /PHI/);
  const result = await runDentalGoldenPath({ outboundApproved: true });
  assert.equal(result.ok, true);
  assert.equal(result.capabilityId, "dental_intake_golden_path");
  assert.ok(result.compliance.includes("no_phi_until_privacy_architecture"));
  assert.equal(result.proof.detail.phiStored, false);
  assert.ok(result.events.some((e) => e.type === "appointment_scheduled"));
});
