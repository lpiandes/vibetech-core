import test from "node:test";
import assert from "node:assert/strict";

import {
  EDITABLE_MEMBERSHIP_ROLES,
  ROLE_ACCESS_MODULE_CATALOG,
  readRoleAccessMatrix,
  writeRoleAccessForMembershipRole,
} from "./BusinessOSRoleAccessConfig.js";
import { resolveRoleAccess } from "./BusinessOSRoleAccess.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_biz_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: {},
    ...overrides,
  };
}

function makePlatformStore(installation) {
  return {
    async getBusinessOSInstallation() {
      return installation;
    },
    async upsertBusinessOSInstallation(row) {
      installation.configuration = row.configuration;
      return row;
    },
  };
}

test("readRoleAccessMatrix defaults every editable role to fully visible", () => {
  const matrix = readRoleAccessMatrix(makeInstallation());
  assert.equal(matrix.length, EDITABLE_MEMBERSHIP_ROLES.length);
  for (const row of matrix) {
    assert.deepEqual(
      row.visibleModuleIds.slice().sort(),
      ROLE_ACCESS_MODULE_CATALOG.map((m) => m.id).sort(),
    );
  }
});

test("writeRoleAccessForMembershipRole persists a deny-list and readRoleAccessMatrix reflects it", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  await writeRoleAccessForMembershipRole({
    platformStore,
    installation,
    membershipRole: "EMPLOYEE",
    visibleModuleIds: ["home", "work", "inbox"],
    actorId: "owner_1",
  });

  const matrix = readRoleAccessMatrix(installation);
  const employeeRow = matrix.find((row) => row.membershipRole === "EMPLOYEE");
  assert.deepEqual(employeeRow.visibleModuleIds.slice().sort(), ["home", "inbox", "work"].sort());

  // Other roles remain untouched (still fully visible).
  const managerRow = matrix.find((row) => row.membershipRole === "MANAGER");
  assert.deepEqual(
    managerRow.visibleModuleIds.slice().sort(),
    ROLE_ACCESS_MODULE_CATALOG.map((m) => m.id).sort(),
  );
});

test("writeRoleAccessForMembershipRole rejects OWNER (not editable)", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  await assert.rejects(
    () =>
      writeRoleAccessForMembershipRole({
        platformStore,
        installation,
        membershipRole: "OWNER",
        visibleModuleIds: [],
      }),
    /not editable/,
  );
});

test("writeRoleAccessForMembershipRole preserves denials for modules outside the catalog", async () => {
  const installation = makeInstallation({
    configuration: {
      roles: [
        { roleId: "employee", membershipRole: "EMPLOYEE", deniedModules: ["properties"] },
      ],
    },
  });
  const platformStore = makePlatformStore(installation);

  await writeRoleAccessForMembershipRole({
    platformStore,
    installation,
    membershipRole: "EMPLOYEE",
    visibleModuleIds: ["home"],
  });

  const role = installation.configuration.roles.find((r) => r.membershipRole === "EMPLOYEE");
  assert.ok(role.deniedModules.includes("properties"), "pre-existing denial outside catalog is preserved");
  assert.ok(role.deniedModules.includes("people"), "catalog module unchecked in the matrix is now denied");
});

test("moduleVisibility deny-list flows through to BusinessOSRoleAccess.resolveRoleAccess", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  await writeRoleAccessForMembershipRole({
    platformStore,
    installation,
    membershipRole: "EMPLOYEE",
    visibleModuleIds: ["home", "work"],
  });

  const roleAccess = resolveRoleAccess({
    configuration: {
      modules: [
        { moduleId: "home", roleVisibility: [] },
        { moduleId: "work", roleVisibility: [] },
        { moduleId: "people", roleVisibility: [] },
        { moduleId: "settings", roleVisibility: [] },
      ],
      roles: installation.configuration.roles,
    },
    membershipRole: "EMPLOYEE",
    permissions: [],
  });

  assert.deepEqual(roleAccess.visibleModuleIds.slice().sort(), ["home", "work"].sort());
});
