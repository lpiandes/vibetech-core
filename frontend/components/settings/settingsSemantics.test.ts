import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveSetupStatusSummary, incompleteSetupItems, settingsHubLinks } from "./settingsSemantics.ts";

test("settings hub links include team, integrations, and knowledge when permitted", () => {
  const links = settingsHubLinks({
    businessId: "biz-1",
    canManageTeam: true,
    canManageIntegrations: true,
    canManageKnowledge: true,
  });

  assert.deepEqual(
    links.map((link) => link.id),
    ["team", "integrations", "knowledge"],
  );
  assert.equal(links.find((l) => l.id === "integrations")?.title, "Integrations");
  assert.ok(links.every((link) => link.href.startsWith("/b/biz-1/")));
});

test("settings setup summary matches checklist state", () => {
  const checklist = [
    { id: "email", title: "Connect your email", complete: true, href: "/b/biz-1/integrations" },
    { id: "knowledge", title: "Add business knowledge", complete: false, href: "/b/biz-1/knowledge" },
  ];

  const summary = deriveSetupStatusSummary(checklist);
  assert.equal(summary.total, 2);
  assert.equal(summary.complete, 1);
  assert.equal(summary.incomplete, 1);
  assert.equal(incompleteSetupItems(checklist).length, 1);
});

test("settings hub omits links without permissions", () => {
  const links = settingsHubLinks({
    businessId: "biz-1",
    canManageTeam: false,
    canManageIntegrations: false,
    canManageKnowledge: false,
  });
  assert.equal(links.length, 0);
});
