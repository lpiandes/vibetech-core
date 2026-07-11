import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DashboardRecommendationEngine,
  bindDashboardProjection,
  validateDashboardDefinition,
} from "./DashboardRecommendationEngine.js";

test("dashboard recommendations use registered components and truthful empty states", () => {
  const engine = new DashboardRecommendationEngine();
  const result = engine.recommend({
    businessSummary: { industry: "dental", businessName: "Bright Smile" },
  });
  assert.equal(result.ok, true);
  assert.ok(result.dashboard.cards.some((card) => card.componentType === "work_queue"));
  const validation = validateDashboardDefinition(result.dashboard);
  assert.equal(validation.ok, true);
  const bound = bindDashboardProjection(result.dashboard.cards[0], { dataAvailable: false });
  assert.equal(bound.fabricatedMetricsForbidden, true);
  assert.ok(bound.emptyState);
});
