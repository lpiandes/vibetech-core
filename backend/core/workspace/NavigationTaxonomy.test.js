import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "./WorkspaceGenerator.js";
import { MODULE_REGISTRY } from "./WorkspaceDefaults.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

const TAXONOMY_GROUPS = new Set([
  "Mission Control",
  "Team",
  "Work",
  "Knowledge",
  "Company",
  "Analytics",
  "Settings",
]);

function makeCapabilitiesReady() {
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
  return { overallReadiness: "READY", capabilities: base };
}

test("Module placement: every module declares a taxonomy-valid navigation section", () => {
  for (const m of MODULE_REGISTRY) {
    const sec = String(m.navigation?.section ?? "");
    // Some modules may be internal/hidden later, but placement must be taxonomy-driven.
    assert.ok(
      TAXONOMY_GROUPS.has(sec),
      `module ${m.id} has non-taxonomy navigation.section=${sec}`,
    );
  }
});

test("Workspace generator navigation uses only taxonomy section titles", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const generator = new WorkspaceGenerator({ nowISO: NOW0 });
  const config = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities: makeCapabilitiesReady(),
    nowISO: NOW0,
  });

  const sectionIds = new Set(config.navigation.items.map((s) => String(s.section)));
  // We expect at least Mission Control and Company, and only taxonomy sections.
  for (const sec of sectionIds) {
    assert.ok(TAXONOMY_GROUPS.has(sec), `navigation section ${sec} not in taxonomy`);
  }

  // No duplicate moduleIds in navigation.
  const navModuleIds = [];
  for (const s of config.navigation.items) {
    for (const it of s.items) navModuleIds.push(String(it.moduleId));
  }
  const seen = new Set();
  for (const id of navModuleIds) {
    assert.ok(!seen.has(id), `duplicate navigation module entry: ${id}`);
    seen.add(id);
  }
});

