import test from "node:test";
import assert from "node:assert/strict";
import {
  listGrowthRoadmapProducts,
  assertGrowthProductsNotSellable,
  getGrowthRoadmapProduct,
  GROWTH_ROADMAP_PACKAGE_IDS,
} from "./GrowthRoadmapRegistry.js";

test("growth roadmap covers Phase 4 sheet lines", () => {
  assert.equal(GROWTH_ROADMAP_PACKAGE_IDS.length, 8);
  assert.equal(listGrowthRoadmapProducts().length, 8);
  assert.equal(assertGrowthProductsNotSellable(), true);
});

test("native chat soft-sell points at forms package", () => {
  const chat = getGrowthRoadmapProduct("website_native_chat");
  assert.equal(chat.softSellToday, "website_chatbot");
  assert.equal(chat.sellable, false);
});

test("external CRM honesty stays roadmap", () => {
  const crm = getGrowthRoadmapProduct("crm_external_integration");
  assert.match(String(crm.honestyNote ?? crm.build), /HubSpot|in-platform|Roadmap/i);
});
