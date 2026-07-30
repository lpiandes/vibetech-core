import assert from "node:assert/strict";
import { test } from "node:test";

import { composeOrganizationView } from "./composeOrganizationView.js";

test("composeOrganizationView projects departments humans AI employees and coverage", () => {
  const view = composeOrganizationView({
    workforceOrganization: {
      departments: [{ departmentId: "ops", label: "Operations", purpose: "Day to day" }],
      teams: [{ teamId: "ops_team", label: "Ops Team", departmentId: "ops" }],
      humanRoles: [{ roleId: "owner", label: "Owner", membershipRole: "OWNER", reportsTo: null }],
      aiEmployees: [{
        employeeId: "ai_scheduler",
        label: "Scheduler",
        purpose: "Coordinate appointments",
        archetypeId: "scheduler",
        responsibilities: ["Propose schedules"],
        approvals: ["customer_facing_messages"],
        kpis: ["schedule_conflicts_resolved"],
        knowledgeOwnership: ["operating_notes"],
        reportsTo: "owner",
      }],
      reportingLines: [{ from: "ai_scheduler", to: "owner", kind: "ai_employee" }],
      coverageRules: [{ when: "manager_absent", fallback: "owner" }],
      responsibilities: [{ ownerId: "owner", ownerKind: "human", text: "Set priorities" }],
      approvals: [{ ownerId: "ai_scheduler", requires: "customer_facing_messages", escalateTo: "owner" }],
      kpis: [{ ownerId: "ai_scheduler", ownerKind: "ai_employee", kpi: "schedule_conflicts_resolved" }],
      knowledgeOwnership: [{ ownerId: "ai_scheduler", category: "operating_notes" }],
    },
    platformMembers: [{ id: "u1", name: "Alex", email: "a@x.com", roleLabel: "Owner" }],
  });

  assert.equal(view.hasOrganization, true);
  assert.equal(view.departments[0].label, "Operations");
  assert.equal(view.humans[0].label, "Alex");
  assert.equal(view.aiEmployees[0].label, "Scheduler");
  assert.equal(view.coverageRules.length, 1);
  assert.equal(view.metrics.find((entry) => entry.id === "ai")?.value, 1);
});

test("composeOrganizationView falls back to live roster when org sparse", () => {
  const view = composeOrganizationView({
    platformMembers: [{ id: "u1", name: "Sam", email: "s@x.com", roleLabel: "Manager" }],
    digitalEmployees: [{ id: "d1", name: "Coordinator", responsibility: "Intake" }],
  });
  assert.equal(view.hasOrganization, true);
  assert.equal(view.humans.length, 1);
  assert.equal(view.aiEmployees.length, 1);
});

test("composeOrganizationView infers human departmentId from matching role recipe's membership role", () => {
  const view = composeOrganizationView({
    workforceOrganization: {
      departments: [
        { departmentId: "ops", label: "Operations" },
        { departmentId: "admin", label: "Administration" },
      ],
      humanRoles: [
        { roleId: "owner", label: "Owner", membershipRole: "OWNER", departmentId: "admin" },
        { roleId: "manager", label: "Manager", membershipRole: "MANAGER", departmentId: "ops" },
      ],
      aiEmployees: [],
    },
    platformMembers: [
      { id: "u1", name: "Alex", email: "alex@x.com", roleLabel: "Owner", membershipRole: "OWNER" },
      { id: "u2", name: "Sam", email: "sam@x.com", roleLabel: "Manager", membershipRole: "MANAGER" },
      { id: "u3", name: "Jo", email: "jo@x.com", roleLabel: "Team member", membershipRole: "EMPLOYEE" },
    ],
  });

  const byId = Object.fromEntries(view.humans.map((h) => [h.id, h]));
  assert.equal(byId.u1.departmentId, "admin");
  assert.equal(byId.u2.departmentId, "ops");
  assert.equal(byId.u3.departmentId, null, "no role recipe for EMPLOYEE means unassigned, not a guess");
});
