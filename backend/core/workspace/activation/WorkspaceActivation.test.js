import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "./activateWorkspace.js";
import { getHorizonTaylorPartyId } from "../../integration/FirstClientOperatingLoopRunner.js";
import { workspaceActivationRegistry } from "./WorkspaceActivationRegistry.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

test("generic workspace remains generic without explicit package activation", () => {
  const result = activateWorkspace({ workspaceId: "ws_generic_test", activation: {}, nowISO: NOW_ISO });
  assert.equal(result.activation.industryPackageId, null);
  assert.equal(result.installationResult, null);
  assert.equal(result.identityViewModel.workspaceMode, "GENERIC");
});

test("PM workspace explicitly installs property management package", () => {
  const result = activateWorkspace({
    workspaceId: "ws_pm_activation_test",
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
    nowISO: NOW_ISO,
  });

  assert.equal(result.installationResult.packageId, PROPERTY_MANAGEMENT_PACKAGE_ID);
  assert.ok(result.demoBootstrap?.primaryRequestId);
  assert.ok(result.demoBootstrap?.requestIds?.length >= 3);
  assert.equal(result.employeeReadinessReport.summary.total, 3);
});

test("horizon properties requires explicit demo activation", () => {
  const implicit = activateWorkspace({ workspaceId: "ws_horizon_implicit_only", nowISO: NOW_ISO });
  assert.equal(implicit.demoBootstrap, null);
  assert.equal(implicit.installationResult, null);

  const result = activateWorkspace({
    workspaceId: "ws_horizon_explicit_only",
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      demoConfigurationId: "horizon_properties",
    },
  });
  assert.equal(result.identityViewModel.businessName, "Horizon Properties");
  assert.equal(result.employeeReadinessReport.summary.total, 3);
  assert.ok(result.employeeReadinessReport.employees.every((e) => e.status !== "ACTIVE"));
  const email = result.connectedSystemsSnapshot.connections.find((c) => c.id === "business_email");
  assert.equal(email.status, "CONNECTED");
  assert.match(String(email.connectionLabel ?? ""), /Demo connection active/i);
  assert.equal(result.demoBootstrap?.primaryPartyId, getHorizonTaylorPartyId());
});

test("activation registry survives explicit ensure calls", () => {
  workspaceActivationRegistry.set("ws_registry_test", { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID });
  const stored = workspaceActivationRegistry.get("ws_registry_test");
  assert.equal(stored.industryPackageId, PROPERTY_MANAGEMENT_PACKAGE_ID);
});
