import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveSidebarNavItems,
  validateWorkspaceShellViewModel,
  getActiveModuleIdFromPathname,
} from "./workspaceShellDerivations.js";

function deepFreeze(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Object.isFrozen(obj)) return obj;
  for (const k of Object.keys(obj)) deepFreeze(obj[k]);
  return Object.freeze(obj);
}

function makeWorkspaceViewModel() {
  return {
    navigation: {
      sections: [
        {
          id: "nav_section_Mission_Control",
          title: "Mission Control",
          items: [{ moduleId: "mission_control", title: "Mission Control", visibility: "VISIBLE", status: "READY" }],
        },
        {
          id: "nav_section_Team",
          title: "Team",
          items: [{ moduleId: "digital_workforce", title: "Team", visibility: "VISIBLE", status: "READY" }],
        },
        {
          id: "nav_section_Operations",
          title: "Work",
          items: [{ moduleId: "work_queue", title: "Work", visibility: "VISIBLE", status: "READY" }],
        },
        { id: "nav_section_Knowledge", title: "Knowledge", items: [{ moduleId: "knowledge", title: "Knowledge", visibility: "VISIBLE", status: "READY" }] },
        {
          id: "nav_section_Workspace",
          title: "Company",
          items: [{ moduleId: "dashboard", title: "Company", visibility: "VISIBLE", status: "READY" }],
        },
        { id: "nav_section_Analytics", title: "Analytics", items: [{ moduleId: "analytics", title: "Analytics", visibility: "VISIBLE", status: "READY" }] },
        { id: "nav_section_Settings", title: "Settings", items: [{ moduleId: "settings", title: "Settings", visibility: "VISIBLE", status: "READY" }] },
      ],
    },
    modules: {
      id: "modules_view",
      modules: [
        { moduleId: "mission_control", icon: "sparkles", title: "Mission Control", badges: [] },
        { moduleId: "dashboard", icon: "dashboard", title: "Dashboard", badges: [] },
        { moduleId: "digital_workforce", icon: "users", title: "Digital Workforce", badges: [] },
        { moduleId: "work_queue", icon: "inbox", title: "Work Queue", badges: [] },
        { moduleId: "knowledge", icon: "book", title: "Knowledge", badges: [] },
        { moduleId: "analytics", icon: "chart", title: "Analytics", badges: [] },
        { moduleId: "settings", icon: "sun", title: "Settings", badges: [] },
      ],
    },
  };
}

test("Navigation rendering: derived sidebar uses view-model ordering", () => {
  const vm = makeWorkspaceViewModel();
  const items = deriveSidebarNavItems(vm);

  assert.equal(items.length, 7);
  assert.deepEqual(
    items.map((x) => x.moduleId),
    ["mission_control", "digital_workforce", "work_queue", "knowledge", "dashboard", "analytics", "settings"],
  );
  assert.ok(items.every((x) => Object.isFrozen(x)));
  assert.ok(Object.isFrozen(items));
});

test("Module rendering: active module mapping by pathname", () => {
  assert.equal(getActiveModuleIdFromPathname("/mission-control"), "mission_control");
  assert.equal(getActiveModuleIdFromPathname("/team"), "digital_workforce");
  assert.equal(getActiveModuleIdFromPathname("/work"), "work_queue");
  assert.equal(getActiveModuleIdFromPathname("/work/pm1"), "work_queue");
  assert.equal(getActiveModuleIdFromPathname("/knowledge"), "knowledge");
  assert.equal(getActiveModuleIdFromPathname("/company"), "dashboard");
  assert.equal(getActiveModuleIdFromPathname("/analytics"), "analytics");
  assert.equal(getActiveModuleIdFromPathname("/settings"), "settings");
  assert.equal(getActiveModuleIdFromPathname("/dashboard"), "dashboard");
  assert.equal(getActiveModuleIdFromPathname("/digital-workforce"), "digital_workforce");
  assert.equal(getActiveModuleIdFromPathname("/work-queue"), "work_queue");
  assert.equal(getActiveModuleIdFromPathname("/work-queue/pm1"), "work_queue");
  assert.equal(getActiveModuleIdFromPathname("/unknown"), null);
});

test("Workspace context consumption: validation returns ok for a complete view model", () => {
  const vm = makeWorkspaceViewModel();
  assert.deepEqual(validateWorkspaceShellViewModel(vm), { ok: true });
});

test("Validation: missing icons throws deterministically", () => {
  const vm = makeWorkspaceViewModel();
  vm.modules.modules = vm.modules.modules.map((m) =>
    m.moduleId === "dashboard" ? { ...m, icon: null } : m,
  );

  assert.throws(() => validateWorkspaceShellViewModel(vm), /missing icon for module: dashboard/);
});

test("Validation: duplicate navigation ids throw", () => {
  const vm = makeWorkspaceViewModel();
  // Duplicate moduleId in nav -> duplicate derived nav id -> throws.
  vm.navigation.sections[0].items.push({
    moduleId: "dashboard",
    title: "Dashboard",
    visibility: "VISIBLE",
    status: "READY",
  });

  assert.throws(() => validateWorkspaceShellViewModel(vm), /duplicate navigation ids/);
});

test("Immutability assumptions: helpers do not mutate frozen view models", () => {
  const vm = deepFreeze(makeWorkspaceViewModel());
  const items = deriveSidebarNavItems(vm);
  assert.ok(items.length === 7);
  assert.deepEqual(items.map((x) => x.moduleId), ["mission_control", "digital_workforce", "work_queue", "knowledge", "dashboard", "analytics", "settings"]);
});

