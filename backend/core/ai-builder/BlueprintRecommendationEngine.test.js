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

test("property industry still selects Gold blueprint", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: { industry: "property_management" },
    evidence: [],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_pm_gold");
});

test("weak property evidence alone does not select Gold without industry", () => {
  const engine = new BlueprintRecommendationEngine();
  const result = engine.recommend({
    businessSummary: { industry: "other", description: "creative studio" },
    evidence: [{ kind: "note", payload: { text: "we lease office space" } }],
  });
  assert.equal(result.recommendations[0].recommendationId, "rec_bp_universal");
});
