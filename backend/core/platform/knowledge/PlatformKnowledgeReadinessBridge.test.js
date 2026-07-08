import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPmProspectCoordinatorPlatformCoverage,
  isPmProspectCoordinatorKnowledgeReady,
  PM_PROSPECT_COORDINATOR_KNOWLEDGE_CATEGORIES,
} from "./PlatformKnowledgeReadinessBridge.js";

test("platform knowledge bridge: zero documents satisfy no categories", () => {
  const coverage = buildPmProspectCoordinatorPlatformCoverage(0);
  assert.equal(coverage.satisfiedCategoryIds.length, 0);
  for (const categoryId of PM_PROSPECT_COORDINATOR_KNOWLEDGE_CATEGORIES) {
    assert.equal(
      isPmProspectCoordinatorKnowledgeReady({ companyRuntime: { getKnowledgeCategories: () => ({ items: [] }) }, categoryId, platformKnowledgeCoverage: coverage }),
      false,
    );
  }
});

test("platform knowledge bridge: uploaded documents satisfy PM leasing categories", () => {
  const coverage = buildPmProspectCoordinatorPlatformCoverage(2);
  assert.equal(coverage.satisfiedCategoryIds.length, 2);
  for (const categoryId of PM_PROSPECT_COORDINATOR_KNOWLEDGE_CATEGORIES) {
    assert.equal(
      isPmProspectCoordinatorKnowledgeReady({
        companyRuntime: { getKnowledgeCategories: () => ({ items: [] }) },
        categoryId,
        platformKnowledgeCoverage: coverage,
      }),
      true,
    );
  }
});
