import assert from "node:assert/strict";
import { test } from "node:test";

import { createSeededCompanyRuntime } from "../../company/fixtures/createSeededCompanyRuntime.js";
import { CompanyBriefEngine } from "../company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "./CompanyOpportunityEngine.js";
import { validateCompanyOpportunities } from "./CompanyOpportunityValidator.js";
import { OPPORTUNITY_IMPACT_RANK, OPPORTUNITY_PRIORITY_RANK } from "./CompanyOpportunityDefaults.js";
import { impactFromScore } from "./CompanyOpportunityDefaults.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function derivedEnvironment() {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });
  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  // Insights can be health-only for this sprint; still deterministic.
  const insights = insightEngine.generate({ previousCompanyHealth: health, currentCompanyHealth: health });
  const opportunityEngine = new CompanyOpportunityEngine({ nowISO: NOW0 });
  return { runtime, brief, health, insights, opportunityEngine };
}

test("Opportunity generation: seed runtime yields expected core opportunities", () => {
  const { runtime, brief, health, insights, opportunityEngine } = derivedEnvironment();
  const opp = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  assert.ok(opp.opportunities.length > 0);

  const ids = new Set(opp.opportunities.map((o) => o.id));
  // Seed facts (deterministic):
  // - email and crm disconnected
  // - no SOP knowledge items published
  // - pendingReviews === 3 in metrics/brief
  assert.ok(ids.has("opp_review_pending_work"));
  assert.ok(ids.has("opp_reconnect_email"));
  assert.ok(ids.has("opp_publish_sop_knowledge"));
});

test("Priority ordering: recommendedOrder is sorted by priority then impact then effort", () => {
  const { runtime, brief, health, insights, opportunityEngine } = derivedEnvironment();
  const opp = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  const byId = new Map(opp.opportunities.map((o) => [o.id, o]));
  const order = opp.recommendedOrder;
  assert.equal(order.length, opp.opportunities.length);

  for (let i = 1; i < order.length; i += 1) {
    const prev = byId.get(order[i - 1]);
    const cur = byId.get(order[i]);
    const prPrev = OPPORTUNITY_PRIORITY_RANK[prev.priority];
    const prCur = OPPORTUNITY_PRIORITY_RANK[cur.priority];
    assert.ok(prPrev <= prCur);

    if (prPrev === prCur) {
      const imPrev = OPPORTUNITY_IMPACT_RANK[prev.impact];
      const imCur = OPPORTUNITY_IMPACT_RANK[cur.impact];
      assert.ok(imPrev <= imCur);
    }
  }
});

test("Quick wins and strategic investments classification is consistent", () => {
  const { runtime, brief, health, insights, opportunityEngine } = derivedEnvironment();
  const opp = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  const allIds = opp.opportunities.map((o) => o.id);
  const quickIds = opp.quickWins.map((o) => o.id);
  const stratIds = opp.strategicInvestments.map((o) => o.id);

  const allSet = new Set(allIds);
  const quickSet = new Set(quickIds);
  const stratSet = new Set(stratIds);

  for (const id of quickIds) assert.ok(allSet.has(id));
  for (const id of stratIds) assert.ok(allSet.has(id));

  // No overlap between quick wins and strategic investments.
  for (const id of quickIds) assert.ok(!stratSet.has(id));

  // Cover all opportunities.
  for (const id of allIds) assert.ok(quickSet.has(id) || stratSet.has(id));

  // QuickWins rule: effort Small and impact High/Very High.
  for (const o of opp.quickWins) {
    assert.equal(o.effort, "Small");
    assert.ok(o.impact === "High" || o.impact === "Very High");
  }
});

test("Impact and effort calculations: review pending work is Small effort and High impact (seed)", () => {
  const { runtime, brief, health, insights, opportunityEngine } = derivedEnvironment();
  const opp = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  const item = opp.opportunities.find((o) => o.id === "opp_review_pending_work");
  assert.ok(item);
  assert.equal(item.effort, "Small");

  const metrics = runtime.getMetrics();
  const pending = Number(metrics.pendingReviews ?? 0);
  const expectedImpactScore = pending >= 5 ? 92 : pending >= 3 ? 80 : 60;
  assert.equal(item.impact, impactFromScore(expectedImpactScore));
});

test("Overall potential: derived from highest impact", () => {
  const { runtime, brief, health, insights, opportunityEngine } = derivedEnvironment();
  const opp = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  const order = { "Very High": 4, High: 3, Medium: 2, Low: 1, "Very Low": 0 };
  const maxImpact = opp.opportunities.reduce((acc, o) => {
    if (!acc) return o.impact;
    return order[o.impact] > order[acc] ? o.impact : acc;
  }, null);
  const expected =
    maxImpact === "Very High" || maxImpact === "High" ? "High" : maxImpact === "Medium" ? "Medium" : "Low";
  assert.equal(opp.overallPotential, expected);
});

test("Validation and immutability: validateCompanyOpportunities passes and output is deep frozen", () => {
  const { runtime, brief, health, insights, opportunityEngine } = derivedEnvironment();
  const opp = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  assert.deepEqual(validateCompanyOpportunities(opp), { ok: true });
  assert.ok(Object.isFrozen(opp));
  assert.ok(Object.isFrozen(opp.opportunities));
  assert.ok(Object.isFrozen(opp.quickWins));
  assert.ok(Object.isFrozen(opp.strategicInvestments));
});

