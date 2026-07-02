import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "./WorkspaceGenerator.js";
import { validateWorkspaceConfiguration } from "./WorkspaceValidation.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeCapabilitiesReady(overrides = {}) {
  const base = [
    { id: "company_identity", status: "READY" },
    { id: "business_profile", status: "READY" },
    { id: "brand", status: "READY" },
    { id: "integrations", status: "READY" },
    { id: "knowledge", status: "READY" },
    { id: "communications", status: "READY" },
    { id: "digital_workforce", status: "READY" },
    { id: "workspace", status: "READY" },
    { id: "analytics", status: "READY" },
  ];
  const map = new Map(base.map((c) => [c.id, { ...c }]));
  for (const [k, v] of Object.entries(overrides)) {
    if (!map.has(k)) map.set(k, { id: k, status: v });
    else map.get(k).status = v;
  }
  return {
    overallReadiness: "READY",
    capabilities: [...map.values()],
  };
}

test("Workspace generation: includes expected modules and produces immutable config", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const generator = new WorkspaceGenerator({ nowISO: NOW0 });

  const businessCapabilities = makeCapabilitiesReady();
  const config = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities,
    nowISO: NOW0,
  });

  assert.ok(Object.isFrozen(config));
  assert.ok(Array.isArray(config.modules));
  assert.ok(Object.isFrozen(config.modules));

  const moduleIds = config.modules.map((m) => m.id);
  // Base modules
  assert.ok(moduleIds.includes("dashboard"));
  assert.ok(moduleIds.includes("mission_control"));
  assert.ok(moduleIds.includes("settings"));
  assert.ok(moduleIds.includes("company_health"));
  assert.ok(moduleIds.includes("recommendations"));

  // Capability-gated modules
  assert.ok(moduleIds.includes("knowledge"));
  assert.ok(moduleIds.includes("digital_workforce"));
  assert.ok(moduleIds.includes("work_queue"));
  assert.ok(moduleIds.includes("communications"));
  assert.ok(moduleIds.includes("connections"));
  assert.ok(moduleIds.includes("analytics"));

  // Navigation references must match modules
  assert.equal(config.navigation.items.length > 0, true);

  // Recommendations deterministic
  assert.ok(Array.isArray(config.recommendations.items));

  // Validation should pass
  assert.deepEqual(validateWorkspaceConfiguration(config), { ok: true });
});

test("Module selection: when knowledge capability not READY, knowledge module and layout are omitted", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const generator = new WorkspaceGenerator({ nowISO: NOW0 });

  const businessCapabilities = makeCapabilitiesReady({ knowledge: "NOT_STARTED" });
  const config = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities,
    nowISO: NOW0,
  });

  const moduleIds = config.modules.map((m) => m.id);
  assert.equal(moduleIds.includes("knowledge"), false);
  assert.equal(config.knowledgeLayout.categories.length, 0);
});

test("Determinism: same inputs -> same widget ids and navigation structure", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const generator = new WorkspaceGenerator({ nowISO: NOW0 });

  const businessCapabilities = makeCapabilitiesReady();
  const configA = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities,
    nowISO: NOW0,
  });
  const configB = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities,
    nowISO: NOW0,
  });

  assert.deepEqual(
    configA.dashboard.defaultWidgets,
    configB.dashboard.defaultWidgets,
  );
  assert.deepEqual(configA.navigation, configB.navigation);
});

