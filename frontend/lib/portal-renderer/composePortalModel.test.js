import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isRegisteredWidget,
  listModuleRegistry,
  listWidgetRegistry,
  resolveModulePresentation,
  resolveActionHref,
} from "./registries.js";
import {
  applyTerminology,
  composePortalModel,
  enrichModules,
  resolveDashboards,
  sectionIdForModuleType,
  selectHomeDashboardWidgets,
} from "./composePortalModel.js";

test("widget registry rejects unregistered types", () => {
  assert.equal(isRegisteredWidget("work_queue"), true);
  assert.equal(isRegisteredWidget("evil_custom_widget"), false);
  assert.ok(listWidgetRegistry().length >= 10);
});

test("module registry resolves only registered presentations", () => {
  assert.equal(resolveModulePresentation("work").viewType, "work_queue");
  assert.equal(resolveModulePresentation("properties").viewType, "subjects");
  assert.equal(resolveModulePresentation("unknown_module_xyz").allowed, false);
  assert.ok(listModuleRegistry().some((entry) => entry.moduleId === "home"));
});

test("dashboards reject unregistered widgets and keep registered ones", () => {
  const dashboards = resolveDashboards({
    specification: {
      dashboardDefinitions: [{
        dashboardId: "owner_home",
        label: "Home",
        widgets: [
          { id: "w1", componentType: "attention_queue", label: "Attention" },
          { id: "w2", componentType: "made_up_widget", label: "Nope" },
          { id: "w3", componentType: "metric_cards", label: "Metrics" },
        ],
      }],
    },
  });
  assert.equal(dashboards[0].acceptedWidgets.length, 2);
  assert.deepEqual(dashboards[0].rejectedWidgets, ["made_up_widget"]);
});

test("composePortalModel enriches thin install modules from specification", () => {
  const model = composePortalModel({
    businessId: "biz_1",
    role: "OWNER",
    permissions: ["work.view", "team.manage"],
    configuration: {
      modules: [{ moduleId: "work", label: "Work", moduleType: "operations" }],
      dashboards: [],
      terminology: { entityLabels: { Clients: "Patients" } },
    },
    specification: {
      modules: [{
        moduleId: "work",
        label: "Work",
        moduleType: "operations",
        navigationPriority: 2,
        primaryActions: ["open_work"],
        emptyState: "No open work.",
        viewType: "work_queue",
      }],
      dashboardDefinitions: [{
        dashboardId: "owner_home",
        label: "Owner home",
        widgets: [
          { id: "a", componentType: "work_queue", label: "Work" },
          { id: "b", componentType: "digital_workforce", label: "Team" },
        ],
      }],
      terminology: { entityLabels: { person: "patient" } },
    },
  });

  assert.equal(model.drivenByBusinessOS, true);
  assert.equal(model.modules[0].emptyState, "No open work.");
  assert.equal(model.modules[0].navigationPriority, 2);
  assert.ok(model.primaryActions.some((action) => action.id === "open_work"));
  assert.equal(selectHomeDashboardWidgets(model).length, 2);
  assert.equal(applyTerminology("Clients", model.terminology), "Patients");
});

test("different businesses get different portal models without custom frontend", () => {
  const dental = composePortalModel({
    businessId: "dental",
    configuration: {
      modules: [
        { moduleId: "people", label: "Patients", moduleType: "records" },
        { moduleId: "work", label: "Appointments", moduleType: "operations" },
        { moduleId: "knowledge", label: "Knowledge", moduleType: "knowledge" },
      ],
      terminology: { entityLabels: { people: "patients" } },
    },
    specification: {
      dashboardDefinitions: [{
        dashboardId: "home",
        widgets: [{ id: "1", componentType: "calendar_deadlines", label: "Schedule" }],
      }],
    },
  });

  const hockey = composePortalModel({
    businessId: "hockey",
    configuration: {
      modules: [
        { moduleId: "teams", label: "Teams", moduleType: "records" },
        { moduleId: "schedule", label: "Schedule", moduleType: "operations" },
        { moduleId: "performance", label: "Reports", moduleType: "analytics" },
      ],
    },
    specification: {
      dashboardDefinitions: [{
        dashboardId: "home",
        widgets: [
          { id: "1", componentType: "subject_summaries", label: "Teams" },
          { id: "2", componentType: "charts", label: "KPIs" },
        ],
      }],
    },
  });

  assert.notDeepEqual(
    dental.modules.map((module) => module.label),
    hockey.modules.map((module) => module.label),
  );
  assert.equal(dental.homeDashboard.acceptedWidgets[0].componentType, "calendar_deadlines");
  assert.equal(hockey.homeDashboard.acceptedWidgets[1].componentType, "charts");
  assert.equal(sectionIdForModuleType("knowledge"), "business");
  assert.equal(sectionIdForModuleType("configuration"), "system");
});

test("actions only resolve through registered safe routes", () => {
  assert.equal(resolveActionHref("open_work", "biz"), "/b/biz/work");
  assert.equal(resolveActionHref("eval_script", "biz"), null);
});

test("enrichModules preserves McBride-compatible module ids", () => {
  const modules = enrichModules({
    configuration: {
      modules: [
        { moduleId: "home", label: "Home", moduleType: "operations" },
        { moduleId: "properties", label: "Properties", moduleType: "records" },
      ],
    },
    specification: {
      modules: [
        { moduleId: "home", label: "Home", moduleType: "operations", navigationPriority: 1, emptyState: "Quiet." },
        { moduleId: "properties", label: "Properties", moduleType: "records", navigationPriority: 4, primaryActions: ["import_properties"] },
      ],
    },
  });
  assert.equal(modules.find((module) => module.moduleId === "properties")?.primaryActions?.[0], "import_properties");
  assert.equal(modules.find((module) => module.moduleId === "home")?.emptyState, "Quiet.");
});
