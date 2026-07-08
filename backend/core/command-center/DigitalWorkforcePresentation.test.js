import assert from "node:assert/strict";
import { test } from "node:test";

import { presentDigitalWorkforce } from "./DigitalWorkforcePresentation.js";
import { DIGITAL_EMPLOYEE_STATUSES } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("presentDigitalWorkforce surfaces degraded and configuring readiness instead of default READY", () => {
  const workforce = presentDigitalWorkforce({
    employeeReadinessReport: {
      employees: [
        {
          employeeId: "pm_maintenance_coordinator",
          name: "Maintenance Coordinator",
          role: "maintenance_coordination",
          status: DIGITAL_EMPLOYEE_STATUSES.DEGRADED,
          blockers: [{ type: "connection", message: "Required connection missing" }],
        },
        {
          employeeId: "pm_owner_success_coordinator",
          name: "Owner Success",
          role: "owner_success",
          status: DIGITAL_EMPLOYEE_STATUSES.CONFIGURING,
          blockers: [{ type: "approval", message: "Approval configuration required" }],
        },
        {
          employeeId: "pm_resident_prospect_coordinator",
          name: "Prospect Coordinator",
          role: "resident_prospect_coordination",
          status: DIGITAL_EMPLOYEE_STATUSES.READY,
          blockers: [],
        },
      ],
    },
    workRuntime: { getWorkItems: () => [] },
    automationRuntime: { getRuns: () => [] },
    teamRuntime: { getMembers: () => [] },
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
    approvalRuntime: { getRequests: () => [] },
  });

  const maint = workforce.digitalEmployees.find((e) => e.id === "pm_maintenance_coordinator");
  const owner = workforce.digitalEmployees.find((e) => e.id === "pm_owner_success_coordinator");
  const prospect = workforce.digitalEmployees.find((e) => e.id === "pm_resident_prospect_coordinator");

  assert.equal(maint?.operatingLabel, "Needs setup");
  assert.equal(maint?.status, "DEGRADED");
  assert.equal(owner?.operatingLabel, "Needs setup");
  assert.equal(owner?.status, "CONFIGURING");
  assert.equal(prospect?.operatingLabel, "Ready");
});
