import assert from "node:assert/strict";
import { test } from "node:test";

import { KnowledgeReadinessEngine } from "./KnowledgeReadinessEngine.js";

function deepFreeze(obj) {
  return Object.freeze(obj);
}

function makeRuntimeStub({ companyId = "company_1", categories = [], items = [] } = {}) {
  return {
    getCompany: () => ({ companyName: companyId }),
    getKnowledgeRepository: () => ({ items }),
    getKnowledgeCategories: () => ({ items: categories }),
  };
}

test("Knowledge readiness: empty active knowledge yields critical health + uncovered gaps", () => {
  const nowISO = "2026-07-01T00:00:00.000Z";
  const categories = deepFreeze([
    { id: "FAQ", name: "FAQ", updatedAt: nowISO, sortOrder: 10 },
    { id: "OPS", name: "Operations", updatedAt: nowISO, sortOrder: 20 },
  ]);

  const runtime = makeRuntimeStub({
    categories,
    items: deepFreeze([]),
  });

  const engine = new KnowledgeReadinessEngine({ nowISO });
  const report = engine.generate({
    companyId: runtime.getCompany().companyName,
    generatedAt: nowISO,
    knowledgeRepository: runtime.getKnowledgeRepository(),
    knowledgeCategories: runtime.getKnowledgeCategories(),
    moduleEnabled: true,
  });

  assert.equal(report.health.level, "critical");
  assert.equal(report.metrics.totalActiveKnowledgeItems, 0);
  assert.ok(report.gaps.length >= 2);
  assert.equal(report.risks[0].category, "missing_active_knowledge");
  assert.equal(Object.isFrozen(report), true);
});

test("Knowledge readiness: healthy recent knowledge yields no gaps/risks and positive strengths", () => {
  const nowISO = "2026-07-01T00:00:00.000Z";
  const categories = deepFreeze([
    { id: "FAQ", name: "FAQ", updatedAt: nowISO, sortOrder: 10 },
    { id: "OPS", name: "Operations", updatedAt: nowISO, sortOrder: 20 },
  ]);

  const items = deepFreeze([
    { id: "kn_1", status: "ACTIVE", category: "FAQ", updatedAt: nowISO, confidence: 0.9 },
    { id: "kn_2", status: "ACTIVE", category: "OPS", updatedAt: nowISO, confidence: 0.8 },
  ]);

  const runtime = makeRuntimeStub({ categories, items });

  const engine = new KnowledgeReadinessEngine({ nowISO });
  const report = engine.generate({
    companyId: runtime.getCompany().companyName,
    generatedAt: nowISO,
    knowledgeRepository: runtime.getKnowledgeRepository(),
    knowledgeCategories: runtime.getKnowledgeCategories(),
    moduleEnabled: true,
  });

  assert.equal(report.health.level, "excellent");
  assert.equal(report.gaps.length, 0);
  assert.equal(report.risks.length, 0);
  assert.ok(report.strengths.length > 0);
  assert.equal(report.recommendations.length, 0);
});

test("Knowledge readiness: staleness produces an outdated gap", () => {
  const nowISO = "2026-07-01T00:00:00.000Z";
  const oldISO = "2026-05-01T00:00:00.000Z";
  const categories = deepFreeze([{ id: "FAQ", name: "FAQ", updatedAt: oldISO, sortOrder: 10 }]);
  const items = deepFreeze([{ id: "kn_1", status: "ACTIVE", category: "FAQ", updatedAt: oldISO, confidence: 0.9 }]);
  const runtime = makeRuntimeStub({ categories, items });

  const engine = new KnowledgeReadinessEngine({ nowISO });
  const report = engine.generate({
    companyId: runtime.getCompany().companyName,
    generatedAt: nowISO,
    knowledgeRepository: runtime.getKnowledgeRepository(),
    knowledgeCategories: runtime.getKnowledgeCategories(),
    moduleEnabled: true,
    staleDaysThreshold: 10,
  });

  assert.ok(report.gaps.some((g) => String(g.id).includes("gap_outdated_knowledge")));
  assert.ok(report.metrics.staleCategoryCount > 0);
});
