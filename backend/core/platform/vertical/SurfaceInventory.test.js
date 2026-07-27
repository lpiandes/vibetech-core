import assert from "node:assert/strict";
import test from "node:test";

import {
  filterModulesForVertical,
  isPropertyManagementWorkspace,
  shouldListConnection,
  SURFACE_INVENTORY,
} from "./SurfaceInventory.js";

test("surface inventory has keep/adapt/quarantine dispositions", () => {
  assert.ok(SURFACE_INVENTORY.length >= 8);
  const dispositions = new Set(SURFACE_INVENTORY.map((row) => row.disposition));
  assert.ok(dispositions.has("keep"));
  assert.ok(dispositions.has("quarantine"));
});

test("PM gate is false for sports/dental by default", () => {
  assert.equal(
    isPropertyManagementWorkspace({ operatingPackId: "youth_sports_v1", industry: "sports" }),
    false,
  );
  assert.equal(
    isPropertyManagementWorkspace({ operatingPackId: "dental_v1", industry: "dental" }),
    false,
  );
});

test("PM gate is true when properties module or PM package is present", () => {
  assert.equal(isPropertyManagementWorkspace({ installedModuleIds: ["home", "properties"] }), true);
  assert.equal(isPropertyManagementWorkspace({ industryPackageId: "pkg_property_management" }), true);
});

test("PMS connection is quarantined from sports/dental", () => {
  assert.equal(
    shouldListConnection("property_management_system", { industry: "sports" }),
    false,
  );
  assert.equal(
    shouldListConnection("business_email", { industry: "sports" }),
    true,
  );
  assert.equal(
    shouldListConnection("property_management_system", { installedModuleIds: ["properties"] }),
    true,
  );
});

test("filterModulesForVertical strips properties for non-PM", () => {
  const filtered = filterModulesForVertical(
    [{ moduleId: "home" }, { moduleId: "properties" }, { moduleId: "work" }],
    { industry: "dental" },
  );
  assert.deepEqual(
    filtered.map((m) => m.moduleId),
    ["home", "work"],
  );
});
