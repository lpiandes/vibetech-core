import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeBosEmployeeForReadiness,
  resolveEmployeeDefinitionsForReadiness,
} from "./normalizeBosEmployeesForReadiness.js";
import { buildDigitalEmployeeReadiness } from "../industries/employees/DigitalEmployeeReadinessEngine.js";

describe("normalizeBosEmployeesForReadiness", () => {
  it("maps owner-added BOS employees into readiness shape with custom_ai_work", () => {
    const normalized = normalizeBosEmployeeForReadiness({
      employeeId: "owner_emp_workout",
      label: "Practice & Workout Plan Builder",
      purpose: "Build workout plans",
      ownerAdded: true,
      capabilities: ["custom_ai_work"],
    });

    assert.equal(normalized.id, "owner_emp_workout");
    assert.equal(normalized.name, "Practice & Workout Plan Builder");
    assert.equal(normalized.ownerAdded, true);
    assert.equal(normalized.customAiWork, true);
    assert.ok(normalized.capabilities.includes("custom_ai_work"));
  });

  it("prefers BOS employees over industry package employees", () => {
    const resolved = resolveEmployeeDefinitionsForReadiness({
      bosEmployees: [{ employeeId: "owner_emp_workout", label: "Workout Builder", ownerAdded: true }],
      packageEmployees: [{ id: "pm_coordinator", name: "Leasing Coordinator", capabilities: ["intake"] }],
    });

    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].id, "owner_emp_workout");
  });

  it("marks custom AI workers READY for internal work", () => {
    const def = normalizeBosEmployeeForReadiness({
      employeeId: "owner_emp_workout",
      label: "Workout Builder",
      ownerAdded: true,
      capabilities: ["custom_ai_work"],
      connectionDependencies: [],
    });
    const readiness = buildDigitalEmployeeReadiness({
      employeeDefinition: def,
      capabilityRuntime: { getCapability: () => ({ status: "active" }) },
      companyRuntime: {},
      connectedSystemsSnapshot: { connections: [] },
      connectionRuntime: {},
    });

    assert.equal(readiness.ownerAdded, true);
    assert.equal(readiness.customAiWork, true);
    assert.equal(readiness.status, "READY");
    assert.equal(readiness.canCurrently.customAiJobs, true);
    assert.equal(readiness.cannotCurrently.autonomousCustomerSend, true);
  });
});
