import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertGrowthProductsNotSellable,
  listGrowthRoadmapProducts,
  GROWTH_ROADMAP_PACKAGE_IDS,
} from "./GrowthRoadmapRegistry.js";

test("growth roadmap emptied after Wave C productization", () => {
  assert.equal(GROWTH_ROADMAP_PACKAGE_IDS.length, 0);
  assert.equal(listGrowthRoadmapProducts().length, 0);
  assert.equal(assertGrowthProductsNotSellable(), true);
});
