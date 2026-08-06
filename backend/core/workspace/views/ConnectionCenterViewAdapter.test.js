import assert from "node:assert/strict";
import { test } from "node:test";

import {
  connectionRequirementsFromEmployees,
  resolveConnectionRequirements,
} from "./ConnectionCenterViewAdapter.js";

test("employee connectionDependencies surface calendar when OS list only has email", () => {
  const reqs = resolveConnectionRequirements({
    businessOsIntegrations: [
      { integrationId: "business_email", label: "Business email", status: "required" },
    ],
    employees: [
      {
        roleId: "revenue_follow_through",
        connectionDependencies: ["business_email", "calendar"],
      },
    ],
    // Already go-live — RFT connect merge stays off so this test isolates employees.
    osConfiguration: { rftLaunch: { goLiveAt: "2026-01-01T00:00:00.000Z" } },
  });
  const ids = reqs.map((r) => r.id).sort();
  assert.deepEqual(ids, ["business_email", "calendar"]);
  assert.equal(reqs.find((r) => r.id === "calendar")?.requirementLevel, "required");
});

test("google_calendar maps onto calendar connection id", () => {
  const fromEmployees = connectionRequirementsFromEmployees([
    { operatingContract: { rules: { connectionDependencies: ["gmail", "google_calendar"] } } },
  ]);
  assert.deepEqual(fromEmployees.map((r) => r.id).sort(), ["business_email", "calendar"]);
});

test("RFT launch path surfaces calendar even when discovery only listed email", () => {
  const reqs = resolveConnectionRequirements({
    businessOsIntegrations: [
      { integrationId: "business_email", label: "Business email", status: "required" },
    ],
    employees: [{ connectionDependencies: ["business_email"] }],
    osConfiguration: { rftLaunch: {} },
  });
  assert.deepEqual(reqs.map((r) => r.id).sort(), ["business_email", "calendar"]);
});

test("after go-live RFT connect channels are not force-added", () => {
  const reqs = resolveConnectionRequirements({
    businessOsIntegrations: [
      { integrationId: "business_email", label: "Business email", status: "required" },
    ],
    employees: [{ connectionDependencies: ["business_email"] }],
    osConfiguration: { rftLaunch: { goLiveAt: "2026-08-01T00:00:00.000Z" } },
  });
  assert.deepEqual(reqs.map((r) => r.id), ["business_email"]);
});
