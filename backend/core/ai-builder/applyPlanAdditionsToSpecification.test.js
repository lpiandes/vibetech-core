import assert from "node:assert/strict";
import { test } from "node:test";

import { applyPlanAdditionsToSpecification } from "./applyPlanAdditionsToSpecification.js";
import { BusinessOSCompiler } from "../business-os/BusinessOSCompiler.js";

test("applyPlanAdditionsToSpecification folds owner teammate and maps pkg.scheduling", () => {
  const specification = {
    specificationId: "bos_1",
    status: "proposed",
    schemaVersion: 1,
    businessProfile: { businessName: "new biz" },
    modules: [{ moduleId: "home", label: "Home", moduleType: "operations" }],
    navigation: { primaryItems: [{ moduleId: "home" }], maximumPrimaryItems: 8 },
    employeeDefinitions: [
      { employeeId: "emp_scheduler", label: "Scheduler", archetypeId: "scheduler" },
    ],
    capabilityRequirements: [
      { capabilityId: "work_queue" },
      { capabilityId: "pkg.scheduling", status: "enabled" },
    ],
    dashboardDefinitions: [],
  };

  const session = {
    appearance: {
      planAdditions: {
        modules: [],
        employees: [{
          id: "owner_emp_workout",
          label: "Practice & Workout Plan Builder",
          purpose: "create workout and practice plans daily",
          ownerAdded: true,
        }],
      },
    },
  };

  const next = applyPlanAdditionsToSpecification(specification, session);
  assert.ok(next.employeeDefinitions.some((entry) => entry.employeeId === "owner_emp_workout"));
  assert.ok(next.capabilityRequirements.some((entry) => entry.capabilityId === "scheduling"));
  assert.ok(!next.capabilityRequirements.some((entry) => entry.capabilityId === "pkg.scheduling"));

  const compiled = new BusinessOSCompiler().compile(next);
  assert.equal(compiled.ok, true);
  assert.ok(
    compiled.plan.actions.some((action) => action.label === "Add Practice & Workout Plan Builder"),
  );
});
