import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getDefaultCapabilityPackageRegistry,
  resetCapabilityPackageRegistryForTests,
} from "./CapabilityPackageRegistry.js";
import { createCapabilityPackage } from "./CapabilityPackage.js";

test("default packages publish honesty matrix with no silent-send available", () => {
  const registry = resetCapabilityPackageRegistryForTests();
  const matrix = registry.honestyMatrix();
  assert.ok(matrix.length >= 5);
  assert.ok(matrix.some((row) => row.id === "pkg.weekly_newsletter" && row.status === "available"));
  assert.ok(matrix.some((row) => row.id === "pkg.inquiry_reply_drafts" && row.status === "available"));
  assert.ok(matrix.some((row) => row.id === "pkg.scheduling" && row.status === "available"));
  assert.ok(matrix.some((row) => row.id === "pkg.fundraising" && row.status === "available"));
  assert.ok(matrix.some((row) => row.id === "pkg.calendar_sync" && row.status === "available"));
  assert.ok(matrix.some((row) => row.id === "pkg.sms_messaging" && row.status === "available"));
  assert.ok(matrix.some((row) => row.id === "pkg.facebook_leads" && row.status === "available"));
  const silent = matrix.find((row) => row.id === "pkg.autonomous_customer_email");
  assert.equal(silent.status, "not_yet");
  // Owner-facing matrix must never advertise silent send as available.
  assert.ok(!matrix.some((row) => row.status === "available" && row.id === "pkg.autonomous_customer_email"));
  assert.ok(matrix.every((row) => row.neverSilentSend === true));
});

test("createCapabilityPackage rejects invalid availability", () => {
  assert.throws(
    () => createCapabilityPackage({ id: "x", availability: "live" }),
    /invalid availability/,
  );
});

test("industry filter returns sports packages", () => {
  const registry = getDefaultCapabilityPackageRegistry();
  const sports = registry.list({ industry: "sports", availability: "available" });
  assert.ok(sports.some((pkg) => pkg.id === "pkg.scheduling"));
  assert.ok(sports.some((pkg) => pkg.id === "pkg.fundraising"));
});
