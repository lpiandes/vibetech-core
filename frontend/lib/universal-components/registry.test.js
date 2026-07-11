import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNIVERSAL_COMPONENT_CATALOG,
  UNIVERSAL_COMPONENT_SUPPORTS,
  UNIVERSAL_COMPONENT_TYPES,
  applyUniversalTerminology,
  canRenderUniversalComponent,
  isRegisteredUniversalComponent,
  listUniversalComponentRegistry,
  resolveUniversalComponent,
  validateUniversalComponentRegistry,
} from "./registry.js";
import { UNIVERSAL_REACT_MAP_KEYS } from "./reactMapKeys.js";
import {
  listRegisteredComponentCatalog,
  isRegisteredComponent,
  validateComponentRegistryContract,
} from "../../../backend/core/platform/contracts/ComponentRegistryContract.js";

test("universal catalog covers required business components", () => {
  const required = [
    "metric_cards",
    "kpi_cards",
    "activity_feed",
    "timeline",
    "calendar",
    "kanban_board",
    "work_queue",
    "approval_queue",
    "communication_center",
    "inbox",
    "knowledge_browser",
    "document_viewer",
    "reports",
    "charts",
    "tables",
    "data_grid",
    "search_results",
    "filters",
    "employee_cards",
    "team_directory",
    "organization_chart",
    "customer_list",
    "asset_list",
    "subject_browser",
    "property_browser",
    "patient_browser",
    "player_browser",
    "scheduling_board",
    "task_list",
    "notes",
    "comments",
    "audit_history",
    "attachments",
    "notifications",
    "alerts",
    "quick_actions",
    "dashboard_sections",
    "empty_states",
    "setup_wizards",
    "status_badges",
    "tags",
    "ai_recommendation_cards",
    "insight_cards",
  ];
  for (const type of required) {
    assert.ok(isRegisteredUniversalComponent(type), `missing ${type}`);
  }
  assert.ok(UNIVERSAL_COMPONENT_TYPES.length >= required.length);
});

test("every catalog entry resolves and supports premium contracts", () => {
  const validation = validateUniversalComponentRegistry();
  assert.equal(validation.ok, true, validation.errors.join(", "));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("role_permissions"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("terminology_overrides"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("dark_mode"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("responsive_layouts"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("loading_states"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("empty_states"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("error_states"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("accessibility"));
  assert.ok(UNIVERSAL_COMPONENT_SUPPORTS.includes("theme_tokens"));

  for (const entry of listUniversalComponentRegistry()) {
    assert.equal(entry.family, "universal");
    assert.equal(entry.allowed, true);
    assert.equal(resolveUniversalComponent(entry.type)?.type, entry.type);
  }
});

test("permissions gate restricted components", () => {
  assert.equal(canRenderUniversalComponent("metric_cards", []), true);
  assert.equal(canRenderUniversalComponent("work_queue", []), false);
  assert.equal(canRenderUniversalComponent("work_queue", ["work.view"]), true);
  assert.equal(canRenderUniversalComponent("evil_widget", ["work.view"]), false);
});

test("terminology overrides customize labels without industry-specific code", () => {
  const terminology = { entityLabels: { customer: "Patient", property: "Clinic" } };
  assert.equal(applyUniversalTerminology("customer", terminology, "customer"), "Patient");
  assert.equal(applyUniversalTerminology("property", terminology, "property"), "Clinic");
  assert.equal(applyUniversalTerminology("Work", null), "Work");
});

test("component registry contract includes universal family", () => {
  const catalog = listRegisteredComponentCatalog();
  assert.ok(catalog.families.universal.length >= 40);
  assert.equal(isRegisteredComponent("universal", "kanban_board"), true);
  assert.equal(isRegisteredComponent("universal", "evil_custom_widget"), false);
  const validation = validateComponentRegistryContract();
  assert.equal(validation.ok, true, validation.errors.join(", "));
});

test("catalog entries are unique and categorized", () => {
  const types = UNIVERSAL_COMPONENT_CATALOG.map((entry) => entry.type);
  assert.equal(new Set(types).size, types.length);
  assert.ok(UNIVERSAL_COMPONENT_CATALOG.every((entry) => entry.category && entry.label));
});

test("every registered type has an intended React implementation slot", () => {
  // Static map in components/universal/index.tsx must cover the full catalog.
  // This guards Architect assembly against registered-but-unimplemented gaps.
  assert.deepEqual([...UNIVERSAL_REACT_MAP_KEYS].sort(), [...UNIVERSAL_COMPONENT_TYPES].sort());
});
