import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOM_AI_CAPABILITY_ID,
  CUSTOM_AI_WORK_TYPE,
  compileCustomAiEmployee,
  compileCustomAiEmployeesOnSpecification,
} from "./CustomAiWorkerCompiler.js";

describe("CustomAiWorkerCompiler", () => {
  it("binds owner-added employees to custom_ai_work + work type + automation", () => {
    const employee = compileCustomAiEmployee({
      employeeId: "owner_emp_workout",
      label: "Workout Builder",
      purpose: "Build practice plans",
    }, { ownerAdded: true });

    assert.ok(employee.capabilities.includes(CUSTOM_AI_CAPABILITY_ID));
    assert.ok(employee.acceptedWorkTypes.includes(CUSTOM_AI_WORK_TYPE));
    assert.equal(employee.communicationPermissions.customerFacingRequiresApproval, true);
    assert.ok(employee.prohibitedActions.includes("autonomous_customer_send"));
    assert.equal(employee.automationDefinitions.length, 1);
    assert.equal(employee.automationDefinitions[0].actions[0].requiresApproval, false);
  });

  it("adds capability + work definition onto a specification", () => {
    const next = compileCustomAiEmployeesOnSpecification({
      employeeDefinitions: [{
        employeeId: "owner_emp_workout",
        label: "Workout Builder",
        ownerAdded: true,
      }],
      capabilityRequirements: [],
      workDefinitions: [],
    });

    assert.ok(next.capabilityRequirements.some((entry) => entry.capabilityId === CUSTOM_AI_CAPABILITY_ID));
    assert.ok(next.workDefinitions.some((entry) => entry.workType === CUSTOM_AI_WORK_TYPE));
  });
});
