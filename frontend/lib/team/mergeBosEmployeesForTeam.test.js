import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeBosEmployeesForTeam } from "./mergeBosEmployeesForTeam.js";

test("merges owner-added employees from specification onto package config employees", () => {
  const merged = mergeBosEmployeesForTeam({
    configuration: {
      employees: [{ employeeId: "pkg_coach", label: "Package Coach" }],
      modules: [],
    },
    specification: {
      employeeDefinitions: [{
        employeeId: "owner_emp_workout",
        label: "Practice & Workout Plan Builder",
        ownerAdded: true,
      }],
    },
  });

  assert.equal(merged.length, 2);
  assert.ok(merged.some((e) => e.employeeId === "pkg_coach"));
  const owner = merged.find((e) => e.employeeId === "owner_emp_workout");
  assert.ok(owner);
  assert.equal(owner.ownerAdded, true);
  assert.equal(owner.label, "Practice & Workout Plan Builder");
});

test("synthesizes employees from specialty_ai modules when definitions are missing", () => {
  const merged = mergeBosEmployeesForTeam({
    configuration: {
      employees: [{ employeeId: "pkg_coach", label: "Package Coach" }],
      modules: [{
        moduleId: "specialty_ai_owner_emp_workout",
        label: "Practice & Workout Plan Builder",
        surfaceKind: "ai_teammate",
        employeeId: "owner_emp_workout",
      }],
    },
    specification: null,
  });

  const owner = merged.find((e) => e.employeeId === "owner_emp_workout");
  assert.ok(owner);
  assert.equal(owner.ownerAdded, true);
});
