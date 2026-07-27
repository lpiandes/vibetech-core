import assert from "node:assert/strict";
import { test } from "node:test";

import { composePurchasedPackagesPanel } from "./purchasedPackagesSemantics.ts";

test("scoped packages use catalog labels and stable order", () => {
  const panel = composePurchasedPackagesPanel(["crm_automation", "ai_receptionist"]);
  assert.equal(panel.show, true);
  assert.equal(panel.fullOs, false);
  assert.equal(panel.heading, "Your packages");
  assert.deepEqual(
    panel.packages.map((pkg) => pkg.id),
    ["crm_automation", "ai_receptionist"],
  );
  assert.equal(panel.packages[1].label, "AI Receptionist / Voice");
});

test("single package uses singular heading", () => {
  const panel = composePurchasedPackagesPanel(["ai_receptionist"]);
  assert.equal(panel.heading, "Your package");
  assert.equal(panel.packages.length, 1);
});

test("unknown ids are dropped", () => {
  const panel = composePurchasedPackagesPanel(["ai_receptionist", "not_a_real_sku"]);
  assert.deepEqual(panel.packages.map((pkg) => pkg.id), ["ai_receptionist"]);
});

test("empty scope renders a full-OS summary", () => {
  const panel = composePurchasedPackagesPanel([]);
  assert.equal(panel.show, true);
  assert.equal(panel.fullOs, true);
  assert.deepEqual(panel.packages, []);
});

test("full OS package renders as full-OS summary", () => {
  const panel = composePurchasedPackagesPanel(["ai_business_os"]);
  assert.equal(panel.fullOs, true);
});

test("package Ask lists every package and marks what is new", () => {
  const panel = composePurchasedPackagesPanel(
    ["ai_receptionist", "crm_automation", "scheduling"],
    { packageAsk: true, addedIds: ["scheduling"] },
  );
  assert.equal(panel.heading, "Your packages");
  assert.equal(panel.compact, true);
  assert.equal(panel.note, "Questions below are only for what’s new.");
  assert.deepEqual(
    panel.packages.map((pkg) => ({ id: pkg.id, added: pkg.added })),
    [
      { id: "ai_receptionist", added: false },
      { id: "crm_automation", added: false },
      { id: "scheduling", added: true },
    ],
  );
});
