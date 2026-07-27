import assert from "node:assert/strict";
import { test } from "node:test";

import { BlueprintRecommendationEngine } from "./BlueprintRecommendationEngine.js";

test("marketing industry never selects property Gold blueprint", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: { industry: "marketing_agency", businessName: "Magna Mare" },
    evidence: [{ kind: "website", payload: { text: "property listings and leasing" } }],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_marketing_universal");
  assert.ok(!result.recommendations.some((entry) => entry.recommendationId === "rec_bp_pm_gold"));
});

test("unsupported property industry stays on the universal core, never a legacy Gold fixture", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: { industry: "property_management" },
    evidence: [],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_universal");
  assert.ok(!result.recommendations.some((entry) => entry.recommendationId === "rec_bp_pm_gold"));
});

test("thin purchased packages never select sports pack from industry alone", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: {
      industry: "sports",
      businessName: "Leo's Whalers",
      purchasedPackages: ["ai_receptionist", "crm_automation"],
    },
    evidence: [],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_universal");
  assert.ok(!result.recommendations.some((entry) => entry.recommendationId === "rec_bp_sports_club"));
});

test("full OS sports industry still selects sports pack", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: {
      industry: "sports",
      purchasedPackages: ["ai_business_os"],
    },
    evidence: [],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_sports_club");
});

test("weak property evidence alone does not select Gold without industry", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: { industry: "other", description: "creative studio" },
    evidence: [{ kind: "note", payload: { text: "we lease office space" } }],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_universal");
});
