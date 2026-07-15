import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isUsableIndustry,
  resolveIndustryDisplayLabel,
  resolveIndustryLabel,
  scrubOwnerFacingPurpose,
} from "./businessIdentity.js";

test("junk industry tokens are rejected", () => {
  assert.equal(isUsableIndustry("ok"), false);
  assert.equal(isUsableIndustry("yes"), false);
  assert.equal(resolveIndustryLabel("ok", "general"), "general");
  assert.equal(resolveIndustryDisplayLabel("ok", "this business"), "this business");
  assert.equal(resolveIndustryDisplayLabel("home_health", "this business"), "home health");
});

test("scrubOwnerFacingPurpose removes for ok builder jargon", () => {
  const cleaned = scrubOwnerFacingPurpose(
    "Specialize reusable Coordinator archetype for ok — never invent a 'one-off' agent.",
    { businessName: "Mind and Mobility", industry: "ok", roleLabel: "Operations Coordinator" },
  );
  assert.ok(!/for ok/i.test(cleaned));
  assert.ok(!/never invent/i.test(cleaned));
  assert.ok(!/Specialize reusable/i.test(cleaned));
  assert.match(cleaned, /Mind and Mobility|Operations Coordinator|this business/i);
});
