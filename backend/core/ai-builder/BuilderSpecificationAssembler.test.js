import assert from "node:assert/strict";
import { test } from "node:test";

import { BuilderSpecificationAssembler } from "./BuilderSpecificationAssembler.js";
import { BuilderSpecificationChangePlanner } from "./BuilderSpecificationChangePlanner.js";
import { BuilderSpecificationReconciler } from "./BuilderSpecificationReconciler.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { createBuilderSession } from "./BuilderSession.js";

test("change planner requires dry-run and approval for terminology rename", () => {
  const session = createBuilderSession({
    businessSummary: { businessName: "Dental", industry: "dental" },
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  const { specification } = new BuilderSpecificationAssembler().assemble({ session, assemblyPlan: plan });
  const changed = new BuilderSpecificationChangePlanner().apply({
    specification,
    change: { kind: "terminology_rename", from: "Patients", to: "Clients" },
  });
  assert.equal(changed.requiresDryRun, true);
  assert.equal(changed.requiresApproval, true);
  assert.ok(changed.nextSpecification.modules.some((module) => module.label === "Clients"));
  assert.notEqual(changed.nextSpecification.contentHash, specification.contentHash);
});

test("reconciler versions upgrades against installed specification", () => {
  const session = createBuilderSession({
    businessSummary: { businessName: "Dental", industry: "dental" },
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  const { specification } = new BuilderSpecificationAssembler().assemble({ session, assemblyPlan: plan });
  const upgraded = new BuilderSpecificationChangePlanner().apply({
    specification,
    change: { kind: "add_module", label: "Referrals", moduleId: "referrals" },
  });
  const reconciled = new BuilderSpecificationReconciler().reconcile({
    installedSpecification: specification,
    proposedSpecification: upgraded.nextSpecification,
  });
  assert.equal(reconciled.kind, "upgrade");
  assert.equal(reconciled.nextVersion, 2);
  assert.ok(reconciled.diff.addedModules.includes("referrals"));
});
