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
