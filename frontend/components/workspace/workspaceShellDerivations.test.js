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
          id: "nav_section_Workspace",
          title: "Workspace",
          items: [
            { moduleId: "dashboard", title: "Dashboard", visibility: "VISIBLE", status: "READY" },
            { moduleId: "digital_workforce", title: "Digital Workforce", visibility: "VISIBLE", status: "READY" },
          ],
        },
        {
          id: "nav_section_Operations",
          title: "Operations",
          items: [{ moduleId: "work_queue", title: "Work Queue", visibility: "VISIBLE", status: "READY" }],
        },
        // No existing routes yet; should be filtered from derived sidebar.
        {
          id: "nav_section_Knowledge",
          title: "Knowledge",
          items: [{ moduleId: "knowledge", title: "Knowledge", visibility: "VISIBLE", status: "READY" }],
        },
      ],
    },
    modules: {
      id: "modules_view",
      modules: [
        { moduleId: "dashboard", icon: "dashboard", title: "Dashboard", badges: [] },
        { moduleId: "digital_workforce", icon: "users", title: "Digital Workforce", badges: [] },
        { moduleId: "work_queue", icon: "inbox", title: "Work Queue", badges: [] },
        { moduleId: "knowledge", icon: "book", title: "Knowledge", badges: [] },
      ],
    },
  };
}

test("Navigation rendering: derived sidebar uses view-model ordering", () => {
  const vm = makeWorkspaceViewModel();
  const items = deriveSidebarNavItems(vm);

  assert.equal(items.length, 3); // knowledge filtered (no route mapping)
  assert.deepEqual(
    items.map((x) => x.moduleId),
    ["dashboard", "digital_workforce", "work_queue"],
  );
  assert.ok(items.every((x) => Object.isFrozen(x)));
  assert.ok(Object.isFrozen(items));
});

test("Module rendering: active module mapping by pathname", () => {
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
  assert.ok(items.length === 3);
  assert.deepEqual(items.map((x) => x.moduleId), ["dashboard", "digital_workforce", "work_queue"]);
});

