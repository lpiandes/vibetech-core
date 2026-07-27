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

test("assembler keeps legacy Gold fixtures out of new Builder recommendations", () => {
  const assembler = new BuilderSpecificationAssembler();
  const pm = createBuilderSession({
    businessSummary: { businessName: "PM Co", industry: "property_management" },
  });
  const pmPlan = new BuilderAssemblyPlanner().plan({ session: pm });
  const pmAssembled = assembler.assemble({ session: pm, assemblyPlan: pmPlan });
  assert.equal(pmAssembled.source, "rec_bp_universal");
  assert.ok(!pmAssembled.specification.modules.some((module) => module.moduleId === "properties"));

  const sportsWithoutBlueprint = createBuilderSession({
    businessSummary: { businessName: "Club", industry: "sports" },
  });
  const forcedUniversal = assembler.assemble({
    session: sportsWithoutBlueprint,
    assemblyPlan: { selectedBlueprints: [], selectedEmployees: [], capabilityGaps: [], assumptions: [] },
  });
  assert.equal(forcedUniversal.source, "universal_assembly");
  assert.ok(!forcedUniversal.specification.modules.some((m) => m.moduleId === "tournaments"));

  const dental = createBuilderSession({
    businessSummary: { businessName: "Dental", industry: "dental" },
  });
  const dentalPlan = new BuilderAssemblyPlanner().plan({ session: dental });
  const dentalAssembled = assembler.assemble({ session: dental, assemblyPlan: dentalPlan });
  assert.equal(dentalAssembled.source, "rec_bp_dental_universal");
  assert.ok(dentalAssembled.specification.modules.some((m) => m.label === "Patients"));
});

test("thin SKU sports industry assembles universal modules without teams/schedule AI team", () => {
  const session = createBuilderSession({
    businessSummary: {
      businessName: "Leo's Whalers",
      industry: "sports",
      purchasedPackages: ["ai_receptionist", "crm_automation"],
      integrationNeeds: ["business_email", "voice_channel", "meta_lead_ads"],
    },
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  assert.equal(plan.selectedBlueprints?.[0]?.recommendationId, "rec_bp_universal");
  const { specification, source } = new BuilderSpecificationAssembler().assemble({ session, assemblyPlan: plan });
  assert.equal(source, "rec_bp_universal");
  const moduleIds = specification.modules.map((m) => m.moduleId);
  assert.ok(moduleIds.includes("people"));
  assert.ok(moduleIds.includes("integrations"));
  assert.ok(moduleIds.includes("pipelines"));
  assert.equal(moduleIds.includes("teams"), false);
  assert.equal(moduleIds.includes("schedule"), false);
  assert.equal(moduleIds.includes("digital_workforce"), false);
  assert.ok(!(specification.metadata?.requiredSetupSteps ?? []).includes("meta_lead_ads"));
  assert.ok((specification.metadata?.requiredSetupSteps ?? []).includes("voice"));
});
