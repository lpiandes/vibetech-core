import assert from "node:assert/strict";
import { test } from "node:test";

import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { BuilderSpecificationAssembler } from "./BuilderSpecificationAssembler.js";
import { createBuilderSession } from "./BuilderSession.js";
import { validateBusinessOSSpecification } from "../business-os/BusinessOSSpecificationValidator.js";
import { getDefaultBusinessOSCapabilityRegistry } from "../business-os/BusinessOSCapabilityRegistry.js";

test("assembly planner prefers gold PM and reusable components", () => {
  const planner = new BuilderAssemblyPlanner();
  const session = createBuilderSession({
    businessSummary: {
      businessName: "McBride Test",
      industry: "property_management",
      integrationNeeds: ["sms"],
    },
  });
  const plan = planner.plan({ session });
  assert.ok(plan.selectedBlueprints.some((entry) => entry.recommendationId === "rec_bp_pm_gold"));
  assert.ok(plan.selectedComponents.length >= 3);
  assert.ok(plan.capabilityGaps.some((gap) => gap.kind === "deferred" || gap.label.includes("sms")));
});

test("specification assembler builds dental universal OS without dental runtime", () => {
  const planner = new BuilderAssemblyPlanner();
  const assembler = new BuilderSpecificationAssembler();
  const session = createBuilderSession({
    sessionId: "abs_dental_1",
    businessSummary: {
      businessName: "Bright Smile Dental",
      industry: "dental",
      services: ["cleanings", "exams"],
      customerTypes: ["patient"],
    },
  });
  const plan = planner.plan({ session });
  const assembled = assembler.assemble({ session, assemblyPlan: plan });
  assert.equal(assembled.ok, true);
  assert.ok(assembled.specification.modules.some((module) => module.label === "Patients"));
  assert.ok(assembled.specification.modules.some((module) => module.moduleId === "appointments"));
  assert.ok(!JSON.stringify(assembled.specification).includes("PatientRuntime"));
  const validation = validateBusinessOSSpecification(assembled.specification, {
    capabilityRegistry: getDefaultBusinessOSCapabilityRegistry(),
    allowUnresolved: true,
  });
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("hockey and McBride assembly reuse fixtures", () => {
  const planner = new BuilderAssemblyPlanner();
  const assembler = new BuilderSpecificationAssembler();
  const hockey = createBuilderSession({
    businessSummary: { businessName: "Northline", industry: "sports" },
  });
  const hockeyPlan = planner.plan({ session: hockey });
  const hockeySpec = assembler.assemble({ session: hockey, assemblyPlan: hockeyPlan });
  assert.equal(hockeySpec.source, "hockey_fixture");
  assert.ok(hockeySpec.specification.modules.some((module) => module.moduleId === "teams"));

  const pm = createBuilderSession({
    businessSummary: { businessName: "McBride", industry: "property_management" },
  });
  const pmSpec = assembler.assemble({ session: pm, assemblyPlan: planner.plan({ session: pm }) });
  assert.equal(pmSpec.source, "mcbride_gold");
  assert.ok(pmSpec.specification.modules.some((module) => module.moduleId === "properties"));
});
