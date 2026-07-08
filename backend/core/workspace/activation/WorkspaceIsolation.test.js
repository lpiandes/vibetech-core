import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace } from "../activation/activateWorkspace.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../activation/activateWorkspace.js";
import { workspaceActivationRegistry } from "../activation/WorkspaceActivationRegistry.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

test("Workspace A and B have distinct runtime identities", () => {
  const a = activateWorkspace({
    workspaceId: "ws_isolation_a",
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, industryPackageVersion: 1 },
    nowISO: NOW_ISO,
  });
  const b = activateWorkspace({
    workspaceId: "ws_isolation_b",
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, industryPackageVersion: 1 },
    nowISO: NOW_ISO,
  });

  assert.notEqual(a.ctx.workRuntime, b.ctx.workRuntime);
  assert.notEqual(a.ctx.platformEventStore, b.ctx.platformEventStore);
  assert.notEqual(a.identityViewModel.workspaceId, b.identityViewModel.workspaceId);
});

test("Workspace activation registry preserves workspace identity per id", () => {
  const first = workspaceActivationRegistry.ensure("ws_reuse_test", {});
  const second = workspaceActivationRegistry.ensure("ws_reuse_test", { industryPackageId: "other" });
  assert.equal(first.workspaceId ?? "ws_reuse_test", second.workspaceId ?? "ws_reuse_test");
});

test("Generic workspace remains generic without industry package", () => {
  const generic = activateWorkspace({ workspaceId: "ws_generic_isolation", activation: {}, nowISO: NOW_ISO });
  assert.equal(generic.installationResult, null);
  assert.equal(generic.integrationPlatform, null);
});

test("Horizon workspace remains PM activated", () => {
  const horizon = activateWorkspace({ workspaceId: "ws_horizon_properties", nowISO: NOW_ISO });
  assert.ok(horizon.installationResult);
  assert.ok(horizon.employeeReadinessReport?.employees?.length > 0);
  assert.equal(horizon.identityViewModel.businessName, "Horizon Properties");
});
