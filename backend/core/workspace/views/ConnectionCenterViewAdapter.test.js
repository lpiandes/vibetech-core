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
    // No rftLaunch key — isolate employees without RFT listed-channel merge.
    osConfiguration: {},
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
  const ids = reqs.map((r) => r.id);
  assert.ok(ids.includes("business_email"));
  assert.ok(ids.includes("calendar"));
  assert.equal(reqs.find((r) => r.id === "calendar")?.requirementLevel, "required");
});

test("after go-live RFT listed channels stay optional (not force-required)", () => {
  const reqs = resolveConnectionRequirements({
    businessOsIntegrations: [
      { integrationId: "business_email", label: "Business email", status: "required" },
    ],
    employees: [{ connectionDependencies: ["business_email"] }],
    osConfiguration: { rftLaunch: { goLiveAt: "2026-08-01T00:00:00.000Z" } },
  });
  const byId = Object.fromEntries(reqs.map((r) => [r.id, r]));
  assert.equal(byId.business_email?.requirementLevel, "required");
  assert.equal(byId.calendar?.requirementLevel, "optional");
  assert.equal(byId.hubspot?.requirementLevel, "optional");
  assert.ok(byId.website_forms);
});

test("open responsibility connection constraints keep calendar after go-live", () => {
  const reqs = resolveConnectionRequirements({
    businessOsIntegrations: [
      { integrationId: "business_email", label: "Business email", status: "required" },
    ],
    employees: [{ connectionDependencies: ["business_email"] }],
    osConfiguration: {
      rftLaunch: { goLiveAt: "2026-08-01T00:00:00.000Z" },
      responsibilityRequests: [
        {
          title: "Appointment Reminders",
          status: "confirmed",
          constraints: [
            {
              type: "ACCOUNT_CONNECTION_REQUIRED",
              status: "open",
              description: "Calendar required for appointment reminders.",
              resolutionAction: "Connect calendar (OAuth).",
            },
          ],
        },
      ],
    },
  });
  const byId = Object.fromEntries(reqs.map((r) => [r.id, r]));
  assert.ok(byId.business_email);
  assert.ok(byId.calendar);
  // Open ACCOUNT_CONNECTION_REQUIRED wins over optional RFT listed merge.
  assert.equal(byId.calendar.requirementLevel, "required");
});
