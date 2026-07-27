import assert from "node:assert/strict";
import test from "node:test";

import {
  compileVerticalBlueprint,
  validateBlueprintAgainstCapabilities,
} from "./VerticalBlueprintCompiler.js";

test("compiles sports blueprint without PM modules or PMS", () => {
  const result = compileVerticalBlueprint({ vertical: "sports" });
  assert.equal(result.ok, true);
  assert.equal(result.blueprint.packId, "youth_sports_v1");
  assert.ok(result.blueprint.pipelines.length >= 1);
  assert.ok(result.blueprint.aiTeammates.includes("Club Intake Coordinator"));
  assert.ok(!result.blueprint.modules.includes("properties"));
  assert.ok(!result.blueprint.integrations.includes("property_management_system"));
  assert.ok(result.prohibited.includes("arbitrary_codegen"));
});

test("compiles dental blueprint with no-PHI compliance", () => {
  const result = compileVerticalBlueprint({ vertical: "dental" });
  assert.equal(result.ok, true);
  assert.equal(result.blueprint.packId, "dental_v1");
  assert.ok(result.blueprint.compliance.some((c) => /privacy|phi|approval/i.test(c)));
});

test("rejects sports blueprint that sneaks in properties module", () => {
  const compiled = compileVerticalBlueprint({ vertical: "sports" });
  const bad = {
    ...compiled.blueprint,
    modules: [...compiled.blueprint.modules, "properties"],
    integrations: [...compiled.blueprint.integrations, "property_management_system"],
  };
  const validation = validateBlueprintAgainstCapabilities(bad);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => /quarantined/i.test(e)));
});

test("unsupported vertical fails closed", () => {
  const result = compileVerticalBlueprint({ vertical: "veterinary" });
  assert.equal(result.ok, false);
});
