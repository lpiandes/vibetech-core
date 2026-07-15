import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureSpecialtyDigitalEmployees } from "./ensureSpecialtyDigitalEmployees.js";

test("injects missing owner-added employees onto the Team roster", () => {
  const next = ensureSpecialtyDigitalEmployees({
    businessId: "biz_1",
    digitalEmployees: [{ id: "emp_pkg", employeeId: "emp_pkg", name: "Package Coach" }],
    bosEmployees: [
      { employeeId: "emp_pkg", label: "Package Coach" },
      {
        employeeId: "owner_emp_workout",
        label: "Practice & Workout Plan Builder",
        ownerAdded: true,
        purpose: "Build workout plans",
      },
    ],
  });

  assert.equal(next.length, 2);
  const owner = next.find((entry) => entry.employeeId === "owner_emp_workout");
  assert.ok(owner);
  assert.equal(owner.name, "Practice & Workout Plan Builder");
  assert.equal(owner.specialtyHref, "/b/biz_1/specialty/owner_emp_workout");
  assert.equal(owner.ownerAdded, true);
});
