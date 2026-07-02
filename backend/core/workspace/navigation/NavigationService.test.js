import assert from "node:assert/strict";
import { test } from "node:test";

import { NavigationService } from "./NavigationService.js";
import { MODULE_REGISTRY } from "../WorkspaceDefaults.js";
import { createWorkspaceModule } from "../WorkspaceModule.js";
import { validateNavigationDefinition } from "./NavigationValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeAllEnabledModules() {
  return MODULE_REGISTRY.map((m) => createWorkspaceModule(m));
}

test("Navigation generation: produces primary groups in deterministic priority order", () => {
  const service = new NavigationService({ nowISO: NOW0 });
  const modules = makeAllEnabledModules();
  const nav = service.generate({ modules });

  const sections = nav.items.map((s) => String(s.section));
  assert.deepEqual(sections, ["Mission Control", "Team", "Work", "Knowledge", "Company", "Analytics", "Settings"]);
});

test("Module placement: selects canonical primary module per destination group", () => {
  const service = new NavigationService({ nowISO: NOW0 });
  const modules = makeAllEnabledModules();
  const nav = service.generate({ modules });

  const pick = (section) => {
    const sec = nav.items.find((s) => String(s.section) === section);
    assert.ok(sec);
    assert.equal(sec.items.length, 1);
    return sec.items[0].moduleId;
  };

  assert.equal(pick("Mission Control"), "mission_control");
  assert.equal(pick("Team"), "digital_workforce");
  assert.equal(pick("Work"), "work_queue");
  assert.equal(pick("Knowledge"), "knowledge");
  assert.equal(pick("Company"), "dashboard");
  assert.equal(pick("Analytics"), "analytics");
  assert.equal(pick("Settings"), "settings");
});

test("Legacy compatibility: primary navigation does not use legacy routes", () => {
  const service = new NavigationService({ nowISO: NOW0 });
  const modules = makeAllEnabledModules();
  const nav = service.generate({ modules });

  // Indirect legacy-compatibility: primary navigation must pick canonical primary modules
  // (not secondary modules that would normally map to legacy destinations in the shell).
  const disallowed = new Set(["communications", "connections", "company_health", "recommendations"]);
  const allItems = nav.items.flatMap((s) => s.items);
  for (const it of allItems) {
    assert.ok(!disallowed.has(it.moduleId), `primary navigation must not select ${it.moduleId}`);
  }
});

test("Validation: no duplicate module ids in generated navigation", () => {
  const service = new NavigationService({ nowISO: NOW0 });
  const modules = makeAllEnabledModules();
  const nav = service.generate({ modules });

  const ids = nav.items.flatMap((s) => s.items.map((it) => it.moduleId));
  const dupe = ids.find((id, idx) => ids.indexOf(id) !== idx);
  assert.equal(dupe, undefined);
});

test("Validation: missing icon throws", () => {
  const def = {
    id: "navigation_definition",
    version: "1",
    groups: [
      {
        title: "Mission Control",
        priority: 1,
        icon: "sparkles",
        description: "",
        items: [
          { id: "nav_item_mc", title: "Mission Control", moduleId: "mission_control", route: "/mission-control", icon: null, enabled: true, badge: {}, priority: 1, metadata: {} },
        ],
      },
      {
        title: "Team",
        priority: 2,
        icon: "users",
        description: "",
        items: [{ id: "nav_item_team", title: "Team", moduleId: "digital_workforce", route: "/team", icon: "users", enabled: true, badge: {}, priority: 2, metadata: {} }],
      },
    ],
  };

  assert.throws(() => validateNavigationDefinition(def), /missing icon/);
});

test("Validation: invalid group ordering throws", () => {
  const def = {
    id: "navigation_definition",
    version: "1",
    groups: [
      // Wrong ordering: Team (2) before Mission Control (1)
      {
        title: "Team",
        priority: 2,
        icon: "users",
        description: "",
        items: [{ id: "nav_item_team", title: "Team", moduleId: "digital_workforce", route: "/team", icon: "users", enabled: true, badge: {}, priority: 2, metadata: {} }],
      },
      {
        title: "Mission Control",
        priority: 1,
        icon: "sparkles",
        description: "",
        items: [{ id: "nav_item_mc", title: "Mission Control", moduleId: "mission_control", route: "/mission-control", icon: "sparkles", enabled: true, badge: {}, priority: 1, metadata: {} }],
      },
    ],
  };

  assert.throws(() => validateNavigationDefinition(def), /group ordering invalid/);
});

test("Validation: missing route throws", () => {
  const def = {
    id: "navigation_definition",
    version: "1",
    groups: [
      {
        title: "Mission Control",
        priority: 1,
        icon: "sparkles",
        description: "",
        items: [
          { id: "nav_item_mc", title: "Mission Control", moduleId: "mission_control", route: null, icon: "sparkles", enabled: true, badge: {}, priority: 1, metadata: {} },
        ],
      },
    ],
  };

  assert.throws(() => validateNavigationDefinition(def), /missing route/);
});

test("Validation: invalid group reference throws", () => {
  const def = {
    id: "navigation_definition",
    version: "1",
    groups: [
      {
        title: "Not A Group",
        priority: 1,
        icon: "sparkles",
        description: "",
        items: [
          { id: "nav_item_x", title: "X", moduleId: "mission_control", route: "/mission-control", icon: "sparkles", enabled: true, badge: {}, priority: 1, metadata: {} },
        ],
      },
    ],
  };

  assert.throws(() => validateNavigationDefinition(def), /invalid group reference/);
});

