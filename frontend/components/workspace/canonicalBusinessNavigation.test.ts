import assert from "node:assert/strict";
import { test } from "node:test";

import { getCanonicalBusinessNav } from "./canonicalBusinessNavigation.ts";

const businessId = "biz_1";
const fullPermissions = [
  "people.view",
  "work.view",
  "performance.view",
  "team.manage",
  "integrations.manage",
  "settings.manage",
];

function idsOf(items: ReturnType<typeof getCanonicalBusinessNav>) {
  return items.map((item) => item.id);
}

test("operating brief nav keeps Today / Decisions / Outcomes / Company Rules primary", () => {
  const items = getCanonicalBusinessNav(businessId, fullPermissions, { role: "MANAGER" });
  assert.equal(items.find((i) => i.id === "home")?.label, "Today");
  assert.equal(items.find((i) => i.id === "needs_attention")?.label, "Decisions");
  assert.equal(items.find((i) => i.id === "knowledge")?.label, "Company Rules");
  assert.equal(items.find((i) => i.id === "home")?.group, "primary");
  assert.ok(idsOf(items).includes("outcomes"));
  assert.ok(idsOf(items).includes("settings"));
  assert.ok(idsOf(items).includes("work"));
  assert.ok(idsOf(items).includes("calendar"));
  // Plan 28 — CRM modules are not primary Records theater
  assert.ok(!idsOf(items).includes("people"));
  assert.ok(!idsOf(items).includes("pipelines"));
  assert.ok(!idsOf(items).includes("inbox"));
  assert.ok(!idsOf(items).includes("campaigns"));
});

test("a role-denied module is filtered out of the primary nav even with the underlying permission", () => {
  const roleDefinitions = [
    { membershipRole: "EMPLOYEE", deniedModules: ["work", "settings"] },
  ];
  const items = getCanonicalBusinessNav(businessId, fullPermissions, {
    role: "EMPLOYEE",
    roleDefinitions,
  });
  const ids = idsOf(items);
  assert.ok(!ids.includes("work"), "work is on the EMPLOYEE deny list");
  assert.ok(!ids.includes("settings"), "settings is on the EMPLOYEE deny list");
  assert.ok(ids.includes("calendar"), "calendar is not denied and should remain");
  assert.ok(ids.includes("home"), "home is not denied and should remain");
});

test("deny list only applies to the matching membershipRole", () => {
  const roleDefinitions = [
    { membershipRole: "EMPLOYEE", deniedModules: ["work"] },
  ];
  const managerItems = getCanonicalBusinessNav(businessId, fullPermissions, {
    role: "MANAGER",
    roleDefinitions,
  });
  assert.ok(idsOf(managerItems).includes("work"), "MANAGER has no deny row and keeps Work");
});

test("OWNER and PLATFORM_ADMIN are never locked out, even if a stray deny row exists for them", () => {
  const roleDefinitions = [
    { membershipRole: "OWNER", deniedModules: ["settings", "integrations"] },
  ];
  const ownerItems = getCanonicalBusinessNav(businessId, fullPermissions, {
    role: "OWNER",
    roleDefinitions,
  });
  assert.ok(idsOf(ownerItems).includes("settings"));
  assert.ok(idsOf(ownerItems).includes("integrations"));

  const adminItems = getCanonicalBusinessNav(businessId, fullPermissions, {
    role: "PLATFORM_ADMIN",
    roleDefinitions: [{ membershipRole: "PLATFORM_ADMIN", deniedModules: ["settings"] }],
  });
  assert.ok(idsOf(adminItems).includes("settings"));
});

test("denying a module the role never had permission for is a no-op (still absent either way)", () => {
  const roleDefinitions = [
    { membershipRole: "VIEWER", deniedModules: ["automations"] },
  ];
  const items = getCanonicalBusinessNav(businessId, ["people.view", "work.view"], {
    role: "VIEWER",
    roleDefinitions,
  });
  assert.ok(!idsOf(items).includes("automations"));
});
