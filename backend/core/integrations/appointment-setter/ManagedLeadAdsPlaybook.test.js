import test from "node:test";
import assert from "node:assert/strict";

import {
  MANAGED_LEAD_ADS_STEPS,
  listManagedLeadAdsSteps,
  listManagedLeadAdsMissions,
} from "./ManagedLeadAdsPlaybook.js";

test("managed lead ads playbook documents the full owner + ops loop", () => {
  const steps = listManagedLeadAdsSteps();
  const ids = steps.map((s) => s.id);
  assert.ok(ids.includes("collect_offer"));
  assert.ok(ids.includes("collect_creatives"));
  assert.ok(ids.includes("set_budget"));
  assert.ok(ids.includes("launch_meta"));
  assert.ok(ids.includes("launch_tiktok"));
  assert.ok(ids.includes("confirm_webhook"));
  assert.ok(ids.includes("confirm_setter"));
  assert.ok(ids.includes("review_and_activate"));
  assert.equal(steps.length, MANAGED_LEAD_ADS_STEPS.length);
});

test("managed lead ads adapters never activate spend automatically", () => {
  const activation = listManagedLeadAdsSteps().find((s) => s.id === "review_and_activate");
  assert.ok(activation);
  assert.match(activation.description, /never flips|activates/i);
  const meta = listManagedLeadAdsSteps().find((s) => s.id === "launch_meta");
  assert.equal(meta.adapter, "meta_ads");
  const tiktok = listManagedLeadAdsSteps().find((s) => s.id === "launch_tiktok");
  assert.equal(tiktok.adapter, "tiktok_lead_ads");
});

test("listManagedLeadAdsMissions builds Launch-shaped rows for VIBETech ops", () => {
  const missions = listManagedLeadAdsMissions({ businessId: "biz_1" });
  assert.equal(missions.length, MANAGED_LEAD_ADS_STEPS.length);
  assert.ok(missions.every((m) => m.id.startsWith("managed_lead_ads_")));
  assert.ok(missions.every((m) => m.audience === "vibetech_ops"));
  assert.match(missions[0].href, /\/b\/biz_1\/integrations/);
});
