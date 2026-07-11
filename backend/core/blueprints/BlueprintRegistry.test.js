import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createBlueprintDefinition,
  applyBlueprintOverrides,
} from "./BlueprintDefinition.js";
import {
  createBlueprintRegistry,
  resetDefaultBlueprintRegistryForTests,
  getDefaultBlueprintRegistry,
} from "./BlueprintRegistry.js";
import { createPropertyManagementGoldBlueprint } from "./PropertyManagementGoldBlueprint.js";
import { validateBlueprintCompatibility } from "./BlueprintCompatibilityValidator.js";
import { getDefaultBusinessOSCapabilityRegistry } from "../business-os/BusinessOSCapabilityRegistry.js";
import { hashBusinessOSSpecification } from "../business-os/BusinessOSSpecificationHasher.js";
import { explainBusinessOSSpecification } from "../business-os/BusinessOSExplanationProjection.js";
import { createBusinessModuleDefinition } from "../business-os/BusinessModuleDefinition.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";

test("blueprint registry registers platform, gold, and business overrides", () => {
  resetDefaultBlueprintRegistryForTests();
  const registry = createBlueprintRegistry({ includeDefaults: true });
  assert.ok(registry.get("bp_platform_universal_core"));
  assert.ok(registry.get("bp_gold_property_management_mcbride")?.goldStatus);

  const override = applyBlueprintOverrides(registry.get("bp_gold_property_management_mcbride"), {
    defaultTerminology: { presentation: { BusinessSubject: "Listing asset" } },
  });
  registry.registerBusinessOverride("biz_override", override);
  assert.equal(registry.resolveForBusiness({ businessId: "biz_override" }).source, "business_override");
  assert.equal(registry.get("bp_gold_property_management_mcbride").goldStatus, true);
});

test("gold blueprint is immutable and references McBride assets without duplication", () => {
  const gold = createPropertyManagementGoldBlueprint();
  assert.equal(gold.goldStatus, true);
  assert.equal(gold.metadata.doesNotDuplicateMcBrideConfig, true);
  assert.equal(gold.packageId, "pkg_property_management");
  assert.ok(gold.moduleRecipe.some((module) => module.moduleId === "properties"));
  assert.ok(gold.campaignRecipes.length >= 1);
  assert.ok(gold.roleRecipes.some((role) => role.roleId === "maintenance_technician"));

  assert.throws(
    () => applyBlueprintOverrides(gold, { mutateGold: true }),
    /immutable/i,
  );

  const mcbride = exportMcBrideBusinessOSSpecification();
  assert.equal(gold.metadata.mcbrideContentHash, mcbride.contentHash);
});

test("dependency resolution orders universal core before gold PM", () => {
  const registry = createBlueprintRegistry({ includeDefaults: true });
  const gold = registry.get("bp_gold_property_management_mcbride");
  const resolved = registry.resolveDependencies(gold);
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.order[0], "bp_platform_universal_core");
  assert.ok(resolved.order.includes("bp_gold_property_management_mcbride"));
});

test("compatibility validator rejects prohibited capabilities", () => {
  const bad = createBlueprintDefinition({
    blueprintId: "bp_bad",
    name: "Bad",
    industry: "test",
    requiredCapabilities: ["autonomous_customer_send"],
    supportedCapabilities: ["autonomous_customer_send"],
  });
  const result = validateBlueprintCompatibility(bad, {
    capabilityRegistry: getDefaultBusinessOSCapabilityRegistry(),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === "prohibited_capability"));
});

test("module definition, stable hashing, and explanation projection", () => {
  const module = createBusinessModuleDefinition({
    moduleId: "properties",
    label: "Properties",
    moduleType: "records",
    capabilityIds: ["subject_import"],
    navigationPriority: 4,
  });
  assert.equal(module.moduleId, "properties");
  assert.throws(
    () => createBusinessModuleDefinition({ moduleId: "x", label: "X", moduleType: "not_real" }),
    /moduleType/,
  );

  const spec = createBusinessOSSpecification({
    specificationId: "bos_hash",
    businessProfile: { businessName: "Hash Co" },
    modules: [module],
    roleDefinitions: [{ roleId: "owner", label: "Owner" }],
    assumptions: [{ id: "a1", text: "Email is primary channel" }],
    capabilityGaps: [],
    status: "draft",
  });
  const hashA = hashBusinessOSSpecification(spec);
  const hashB = hashBusinessOSSpecification({ ...spec, updatedAt: "2099-01-01T00:00:00.000Z" });
  assert.equal(hashA, hashB);
  assert.equal(spec.contentHash, hashA);

  const explanation = explainBusinessOSSpecification(spec);
  assert.match(explanation.summary, /Hash Co/);
  assert.ok(explanation.sections.some((section) => section.id === "modules"));
});

test("default registry singleton exposes gold PM blueprint", () => {
  resetDefaultBlueprintRegistryForTests();
  const registry = getDefaultBlueprintRegistry();
  assert.equal(
    registry.resolveForBusiness({ industry: "property_management" }).blueprintId,
    "bp_gold_property_management_mcbride",
  );
});
