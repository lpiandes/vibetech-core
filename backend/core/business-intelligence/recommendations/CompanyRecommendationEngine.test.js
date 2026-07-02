import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { CompanyBriefEngine } from "../company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "../opportunities/CompanyOpportunityEngine.js";

import { CompanyRecommendationEngine } from "./CompanyRecommendationEngine.js";
import { validateCompanyRecommendations } from "./CompanyRecommendationValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function phraseForTop(rec) {
  const action = String(rec.action ?? "");
  const cat = String(rec.category ?? "");
  if (action === "connect_email" || action === "connect_disconnected_systems" || cat === "connected_systems") return "reconnect email first";
  if (action === "review_work_queue" || cat === "work_queue") return "review pending work first";
  if (action === "publish_knowledge" || cat === "knowledge") return "publish knowledge first";
  if (cat === "communications") return "review communications first";
  if (cat === "digital_workforce") return "deploy employees first";
  if (cat === "onboarding") return "complete onboarding first";
  return "take the next highest priority action";
}

function derivedEnvironment() {
  const runtime = new CompanyWorkspaceRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });
  const opportunityEngine = new CompanyOpportunityEngine({ nowISO: NOW0 });
  const recommendationEngine = new CompanyRecommendationEngine({ nowISO: NOW0 });

  const brief = briefEngine.generate({ companyRuntime: runtime });
  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  const insights = insightEngine.generate({ previousCompanyHealth: health, currentCompanyHealth: health });
  const opportunities = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });

  const recs = recommendationEngine.generate({
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
    companyOpportunities: opportunities,
  });

  return { runtime, brief, health, insights, opportunities, recs };
}

test("Recommendation generation: includes dependent strategic investment", () => {
  const { recs } = derivedEnvironment();

  const ids = new Set(recs.recommendations.map((r) => r.id));
  assert.ok(ids.has("rec_opp_review_pending_work"));
  assert.ok(ids.has("rec_opp_automate_approvals"));

  const automate = recs.recommendations.find((r) => r.id === "rec_opp_automate_approvals");
  assert.ok(automate);
  assert.deepEqual(automate.dependencies, ["rec_opp_review_pending_work"]);
  assert.equal(automate.status, "blocked");
});

test("Prioritization: topRecommendation is first and in immediateActions", () => {
  const { recs } = derivedEnvironment();

  assert.equal(recs.topRecommendation.id, recs.recommendations[0].id);
  assert.equal(recs.topRecommendation.priority, "immediate");
  assert.ok(recs.immediateActions.some((r) => r.id === recs.topRecommendation.id));
});

test("Grouping: immediate/soon/later are disjoint and cover all recommendations", () => {
  const { recs } = derivedEnvironment();

  const all = [...recs.immediateActions, ...recs.nextActions, ...recs.laterActions];
  const allIds = all.map((r) => r.id);
  const unique = new Set(allIds);

  assert.equal(unique.size, allIds.length);
  assert.equal(all.length, recs.recommendations.length);

  for (const r of recs.recommendations) {
    const exists = all.some((x) => x.id === r.id);
    assert.ok(exists);
  }
});

test("Summary generation: deterministic phrase for top recommendation", () => {
  const { recs } = derivedEnvironment();
  const expectedPhrase = phraseForTop(recs.topRecommendation);
  assert.ok(recs.summary.includes(expectedPhrase));
});

test("Dependency handling: any recommendation with dependencies is blocked", () => {
  const { recs } = derivedEnvironment();
  for (const r of recs.recommendations) {
    if (Array.isArray(r.dependencies) && r.dependencies.length > 0) assert.equal(r.status, "blocked");
  }
});

test("Validation and immutability: output is deep frozen and validator passes", () => {
  const { recs } = derivedEnvironment();
  assert.deepEqual(validateCompanyRecommendations(recs), { ok: true });

  assert.ok(Object.isFrozen(recs));
  assert.ok(Object.isFrozen(recs.recommendations));
  assert.ok(Object.isFrozen(recs.immediateActions));
  assert.ok(Object.isFrozen(recs.topRecommendation));
});

