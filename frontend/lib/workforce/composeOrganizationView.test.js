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
