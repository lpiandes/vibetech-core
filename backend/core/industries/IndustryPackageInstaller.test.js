import assert from "node:assert/strict";
import { test } from "node:test";

import { AutomationRuntime } from "../automations/AutomationRuntime.js";
import { CapabilityRuntime } from "../capabilities/runtime/CapabilityRuntime.js";
import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";

import { IndustryPackageInstaller } from "./IndustryPackageInstaller.js";
import { IndustryPackageInstallationRuntime } from "./IndustryPackageInstallationRuntime.js";
import { IndustryPackageRegistry } from "./IndustryPackageRegistry.js";
import { buildIndustryPackageReadinessReport, PACKAGE_READINESS_STATUSES } from "./IndustryPackageReadinessReport.js";
import { createIndustryPackage } from "./IndustryPackage.js";
import { validateIndustryPackage } from "./IndustryPackageValidator.js";

import {
  PROPERTY_MANAGEMENT_PACKAGE,
  PROFESSIONAL_SERVICES_FIXTURE_PACKAGE,
  OPERATIONS_FIXTURE_PACKAGE,
} from "./IndustryPackageRegistry.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("Empty core: no industry behavior before package installation", () => {
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const installationRuntime = new IndustryPackageInstallationRuntime();

  assert.equal(automationRuntime.getAutomations().length, 0);
  assert.equal(capabilityRuntime.getCapabilities().length, 0);
  assert.equal(installationRuntime.getInstallations().length, 0);
  assert.equal(capabilityRuntime.getCapability("lead_response"), null);
});

test("IndustryPackage contract: valid package accepted, malformed rejected, frozen", () => {
  assert.doesNotThrow(() => validateIndustryPackage(PROPERTY_MANAGEMENT_PACKAGE));
  assert.ok(Object.isFrozen(PROPERTY_MANAGEMENT_PACKAGE));
  assert.throws(
    () => validateIndustryPackage(createIndustryPackage({ id: "bad", name: "Bad", description: "x", capabilities: [{ id: "c1" }] })),
    /capabilities.*name/,
  );
});

test("IndustryPackageRegistry: lists packages and rejects duplicate registration", () => {
  const registry = new IndustryPackageRegistry();
  assert.ok(registry.getPackage("pkg_property_management"));
  assert.throws(() => registry.register(PROPERTY_MANAGEMENT_PACKAGE), /duplicate package id/);
});

test("IndustryPackageInstaller: installs through bounded ownership APIs", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const installationRuntime = new IndustryPackageInstallationRuntime();
  const installer = new IndustryPackageInstaller({ installationRuntime });

  const builtInCount = companyRuntime.getKnowledgeCategories().items.length;

  const result = installer.install({
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    workspaceId: "ws_pm_install",
    configuration: { companyName: "Test PM Co" },
    companyRuntime,
    capabilityRuntime,
    automationRuntime,
    nowISO: NOW0,
  });

  assert.equal(result.status, "INSTALLED");
  assert.equal(result.idempotent, false);
  assert.equal(capabilityRuntime.getCapabilities().length, PROPERTY_MANAGEMENT_PACKAGE.capabilities.length);
  assert.equal(automationRuntime.getAutomations().length, PROPERTY_MANAGEMENT_PACKAGE.automationConfigurations.length);
  assert.ok(companyRuntime.getKnowledgeCategories().items.length > builtInCount);
  assert.equal(result.terminology.entityLabels.property, "Property");
  assert.equal(installationRuntime.getInstallations().length, 1);
});

test("IndustryPackageInstaller: duplicate install is idempotent", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const installationRuntime = new IndustryPackageInstallationRuntime();
  const installer = new IndustryPackageInstaller({ installationRuntime });
  const args = {
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    workspaceId: "ws_pm_idempotent",
    configuration: { companyName: "Idempotent Co" },
    companyRuntime,
    capabilityRuntime,
    automationRuntime,
    nowISO: NOW0,
  };

  const first = installer.install(args);
  const capCount = capabilityRuntime.getCapabilities().length;
  const autoCount = automationRuntime.getAutomations().length;

  const second = installer.install(args);
  assert.equal(second.idempotent, true);
  assert.equal(second.installationId, first.installationId);
  assert.equal(capabilityRuntime.getCapabilities().length, capCount);
  assert.equal(automationRuntime.getAutomations().length, autoCount);
  assert.equal(installationRuntime.getInstallations().length, 1);
});

test("Package readiness report: shows truthful knowledge gaps after install", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
  const installer = new IndustryPackageInstaller();

  const installationResult = installer.install({
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    workspaceId: "ws_pm_readiness",
    configuration: {},
    companyRuntime,
    capabilityRuntime,
    automationRuntime,
    nowISO: NOW0,
  });

  const report = buildIndustryPackageReadinessReport({
    installationResult,
    capabilityRuntime,
    automationRuntime,
    companyRuntime,
    connectedSystemsSnapshot: { connected: [], missingRequired: ["business_email"] },
  });

  assert.equal(report.packageId, "pkg_property_management");
  assert.equal(report.readinessStatus, PACKAGE_READINESS_STATUSES.PARTIALLY_READY);
  assert.ok(report.missing.knowledgeRequirements.length > 0, "must show missing knowledge truthfully");
  assert.ok(report.missing.connectedSystems.length > 0);
  assert.equal(report.summary.capabilitiesInstalled, PROPERTY_MANAGEMENT_PACKAGE.capabilities.length);
});

test("Universality proof: fixture packages install with same installer and Core", () => {
  for (const pkg of [PROFESSIONAL_SERVICES_FIXTURE_PACKAGE, OPERATIONS_FIXTURE_PACKAGE]) {
    const companyRuntime = new CompanyWorkspaceRuntime();
    const capabilityRuntime = new CapabilityRuntime({ seed: null });
    const automationRuntime = new AutomationRuntime({ nowISO: NOW0 });
    const installer = new IndustryPackageInstaller();

    const result = installer.install({
      industryPackage: pkg,
      workspaceId: `ws_${pkg.id}`,
      configuration: {},
      companyRuntime,
      capabilityRuntime,
      automationRuntime,
      nowISO: NOW0,
    });

    assert.equal(result.packageId, pkg.id);
    assert.equal(capabilityRuntime.getCapabilities().length, pkg.capabilities.length);
    assert.equal(automationRuntime.getAutomations().length, pkg.automationConfigurations.length);
    assert.notEqual(pkg.terminology.party.default, "Prospect");
  }
});
