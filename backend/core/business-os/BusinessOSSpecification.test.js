import assert from "node:assert/strict";
import { test } from "node:test";

import { createBusinessOSSpecification, withSpecificationStatus } from "./BusinessOSSpecification.js";
import { validateBusinessOSSpecification } from "./BusinessOSSpecificationValidator.js";
import { getDefaultBusinessOSCapabilityRegistry } from "./BusinessOSCapabilityRegistry.js";
import { buildBusinessOSNavigation, applyBusinessOSTerminology } from "./BusinessOSNavigationBuilder.js";
import { resolveEmployeeArchetype } from "./BusinessOSEmployeeArchetypes.js";
import { isRegisteredDashboardComponent } from "./BusinessOSDashboardComponentRegistry.js";
import { exportMcBrideBusinessOSSpecification } from "./McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "./fixtures/HockeyTravelClubSpecification.js";

test("specification validates happy path and rejects unknown dashboard components", () => {
  const registry = getDefaultBusinessOSCapabilityRegistry();
  const valid = createBusinessOSSpecification({
    specificationId: "bos_test",
    businessProfile: { businessName: "Test Co" },
    modules: [{ moduleId: "work", label: "Work", moduleType: "operations", primaryNavigationEligible: true }],
    navigation: { primaryItems: [{ moduleId: "work", label: "Work" }], maximumPrimaryItems: 8 },
    dashboardDefinitions: [{
      dashboardId: "home",
      widgets: [{ id: "w1", componentType: "work_queue", dataSource: "work", label: "Work" }],
    }],
    employeeDefinitions: [{
      employeeId: "emp_1",
      label: "Coordinator",
      archetypeId: "coordinator",
      applicableModules: ["work"],
    }],
    capabilityRequirements: [{ capabilityId: "work_queue" }],
  });
  const ok = validateBusinessOSSpecification(valid, { capabilityRegistry: registry });
  assert.equal(ok.ok, true);

  const bad = createBusinessOSSpecification({
    specificationId: "bos_bad",
    modules: [{ moduleId: "work", label: "Work", moduleType: "operations" }],
    dashboardDefinitions: [{
      dashboardId: "home",
      widgets: [{ id: "w1", componentType: "made_up_widget", dataSource: "work" }],
    }],
  });
  const invalid = validateBusinessOSSpecification(bad, { capabilityRegistry: registry });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((entry) => entry.code === "unknown_dashboard_component"));
});

test("terminology is presentation-only and forbids vertical runtime class names", () => {
  assert.equal(applyBusinessOSTerminology({
    terminology: { presentation: { BusinessSubject: "Property" } },
    concept: "BusinessSubject",
  }), "Property");

  const banned = createBusinessOSSpecification({
    specificationId: "bos_banned",
    terminology: { presentation: { PropertyRuntime: "Property" } },
    modules: [{ moduleId: "home", label: "Home", moduleType: "operations" }],
  });
  const result = validateBusinessOSSpecification(banned);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === "vertical_runtime_forbidden"));
});

test("navigation overflows into More and keeps workforce grouped", () => {
  const modules = Array.from({ length: 12 }, (_, index) => ({
    moduleId: `mod_${index}`,
    label: `Module ${index}`,
    moduleType: index === 3 ? "workforce" : "records",
    primaryNavigationEligible: true,
    navigationPriority: index + 1,
  }));
  modules[3].moduleId = "digital_workforce";
  modules[3].label = "Digital Workforce";

  const nav = buildBusinessOSNavigation({
    modules,
    navigation: { maximumPrimaryItems: 8, overflowBehavior: "more" },
  });
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "more"));
  assert.ok(nav.overflowItems.length > 0);
  assert.equal(nav.employeePlacement, "digital_workforce");
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "digital_workforce"));
});

test("employee archetype resolution and capability classification", () => {
  assert.equal(resolveEmployeeArchetype("scheduler").ok, true);
  assert.equal(resolveEmployeeArchetype("teleporter").ok, false);
  assert.equal(isRegisteredDashboardComponent("metric_cards"), true);
  assert.equal(isRegisteredDashboardComponent("custom_react"), false);

  const registry = getDefaultBusinessOSCapabilityRegistry();
  assert.equal(registry.classifyRequirement({ capabilityId: "work_queue" }).availability, "supported");
  assert.equal(registry.classifyRequirement({ capabilityId: "sms_messaging" }).deferred, true);
  assert.equal(registry.classifyRequirement({ capabilityId: "autonomous_customer_send" }).prohibited, true);
  assert.equal(registry.classifyRequirement({ capabilityId: "quantum_billing" }).proposalRequired, true);
});

test("McBride gold blueprint exports a valid specification", () => {
  const registry = getDefaultBusinessOSCapabilityRegistry();
  const spec = exportMcBrideBusinessOSSpecification();
  const result = validateBusinessOSSpecification(spec, { capabilityRegistry: registry });
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(spec.metadata.goldBlueprint, true);
  assert.ok(spec.modules.some((module) => module.moduleId === "properties"));
  assert.ok(spec.modules.some((module) => module.moduleId === "campaigns"));
  assert.ok(spec.employeeDefinitions.every((employee) => employee.archetypeId));
  assert.equal(spec.terminology.presentation.BusinessSubject, "Property");
  assert.ok(spec.capabilityRequirements.some((entry) => entry.capabilityId === "sms_messaging"));
  const installed = withSpecificationStatus(spec, "validated");
  assert.equal(installed.status, "validated");
});

test("hockey travel club fixture validates and exposes owner-relevant modules", () => {
  const registry = getDefaultBusinessOSCapabilityRegistry();
  const spec = createHockeyTravelClubSpecification();
  const result = validateBusinessOSSpecification(spec, { capabilityRegistry: registry });
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  for (const label of ["Teams", "Players", "Schedule", "Practices", "Drill Library", "Scouting Reports", "Work Queue", "Digital Workforce", "Knowledge", "Reports"]) {
    assert.ok(spec.modules.some((module) => module.label === label), label);
  }
  const nav = buildBusinessOSNavigation({ modules: spec.modules, navigation: spec.navigation });
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "more") || nav.primaryItems.length <= 8);
  assert.ok(spec.employeeDefinitions.every((employee) => (
    employee.applicableModules.includes("digital_workforce")
    || employee.applicableModules.some((moduleId) => moduleId !== employee.employeeId)
  )));
  assert.ok(!spec.modules.some((module) => module.moduleId === employeeAsNav(spec)));
  assert.ok(spec.subjectDefinitions.some((entry) => entry.subjectType === "drill"));
});

function employeeAsNav(spec) {
  // Employees must not appear as their own primary modules.
  const employeeIds = new Set(spec.employeeDefinitions.map((entry) => entry.employeeId));
  return spec.modules.find((module) => employeeIds.has(module.moduleId))?.moduleId ?? null;
}
