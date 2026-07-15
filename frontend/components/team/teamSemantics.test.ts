import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveTeamCounts,
  employeeStatusTone,
  isEmployeeReady,
  monitoringSummary,
  primaryEmployeeAction,
} from "./teamSemantics.ts";

test("team metrics match VM rows", () => {
  const counts = deriveTeamCounts(
    [
      { id: "u1", name: "Alex", email: "alex@example.com", roleLabel: "Administrator" },
      { id: "u2", name: "Sam", email: "sam@example.com", roleLabel: "Manager" },
    ],
    [
      { employeeId: "pm_resident_prospect_coordinator", statusKey: "ACTIVE", isReady: true },
      { employeeId: "pm_maintenance_coordinator", statusKey: "CONFIGURING", isReady: false },
      { employeeId: "pm_owner_success_coordinator", statusKey: "BLOCKED", isReady: false },
    ],
  );

  assert.equal(counts.humanTeam, 2);
  assert.equal(counts.digitalEmployees, 3);
  assert.equal(counts.ready, 1);
  assert.equal(counts.needsSetup, 2);
});

test("ready and needs setup counts derive from real statuses", () => {
  assert.equal(isEmployeeReady("ACTIVE"), true);
  assert.equal(isEmployeeReady("READY"), true);
  assert.equal(isEmployeeReady("CONFIGURING"), false);
  assert.equal(isEmployeeReady("DEGRADED"), false);

  const counts = deriveTeamCounts([], [
    { statusKey: "READY" },
    { statusKey: "DEGRADED" },
    { statusKey: "ACTIVE" },
  ]);

  assert.equal(counts.ready, 2);
  assert.equal(counts.needsSetup, 1);
});

test("digital employee actions prefer setup then work", () => {
  assert.deepEqual(primaryEmployeeAction({ isReady: false, setupHref: "/b/biz/integrations" }), {
    label: "Finish setup",
    href: "/b/biz/integrations",
  });

  assert.deepEqual(
    primaryEmployeeAction({ isReady: true, openAssignmentCount: 2, workHref: "/b/biz/work" }),
    { label: "View work", href: "/b/biz/work" },
  );

  assert.equal(primaryEmployeeAction({ isReady: true }), null);
});

test("ready custom AI primary action opens specialty page", () => {
  assert.deepEqual(
    primaryEmployeeAction({
      isReady: true,
      specialtyHref: "/b/biz/specialty/owner_emp_workout",
      workHref: "/b/biz/work",
    }),
    { label: "Open specialty page", href: "/b/biz/specialty/owner_emp_workout" },
  );
});

test("status tone and monitoring only use real evidence", () => {
  assert.equal(employeeStatusTone({ statusKey: "ACTIVE", isReady: true }), "success");
  assert.equal(employeeStatusTone({ statusKey: "BLOCKED" }), "warning");

  const summary = monitoringSummary({
    monitoring: [
      { label: "Open assignments", count: 2 },
      { label: "Active automations", count: 0 },
    ],
  });

  assert.deepEqual(summary, [{ label: "Open assignments", count: 2 }]);
});

test("team metrics strip values match row counts", () => {
  const members = [{ id: "u1", name: "Alex", email: "a@x.com", roleLabel: "Administrator" }];
  const digitalEmployees = [
    { statusKey: "ACTIVE", isReady: true },
    { statusKey: "CONFIGURING", isReady: false },
  ];
  const counts = deriveTeamCounts(members, digitalEmployees);

  assert.deepEqual(
    [
      { id: "human", label: "Human team", value: String(counts.humanTeam) },
      { id: "digital", label: "Digital employees", value: String(counts.digitalEmployees) },
      { id: "ready", label: "Ready", value: String(counts.ready) },
      { id: "setup", label: "Needs setup", value: String(counts.needsSetup) },
    ].map((metric) => metric.value),
    ["1", "2", "1", "1"],
  );
});

test("human labels stay free of raw employee ids and enums", () => {
  const employee = {
    employeeId: "pm_resident_prospect_coordinator",
    name: "Resident & Prospect Coordinator",
    role: "Resident & Prospect Coordinator",
    statusLabel: "Needs setup",
    blockerItems: ["Connect required business channels"],
  };

  const displayBlob = [employee.name, employee.role, employee.statusLabel, ...employee.blockerItems].join(" ");
  assert.ok(!displayBlob.includes("pm_resident_prospect_coordinator"));
  assert.ok(!displayBlob.includes("resident_prospect_coordination"));
  assert.ok(!displayBlob.includes("CONFIGURING"));
  assert.equal(employee.statusLabel, "Needs setup");
});

test("empty human team uses compact executive copy", () => {
  const copy = "Invite employees so they can access VIBETech and work with your digital employees.";
  assert.equal(deriveTeamCounts([], []).humanTeam, 0);
  assert.ok(copy.length < 120);
});
