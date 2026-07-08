import assert from "node:assert/strict";
import { test } from "node:test";

import { createSeededCompanyRuntime } from "../../company/fixtures/createSeededCompanyRuntime.js";
import { CompanyBriefEngine } from "../company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "./CompanyInsightEngine.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { scoreToStatus, scoreToTrend } from "../company-health/CompanyHealthScore.js";
import { createCompanyHealthRecommendation } from "../company-health/CompanyHealthRecommendation.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function cloneMutable(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function pickRiskIdMatching(health, predicate) {
  return (health?.risks ?? []).map((r) => r?.id).filter(Boolean).find((id) => predicate(id)) ?? null;
}

function getDimensionById(health, dimId) {
  return (health?.dimensions ?? []).find((d) => d?.id === dimId) ?? null;
}

test("Health score comparison: overall improved generates a health insight", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const companyBrief = briefEngine.generate({ companyRuntime: runtime });
  const prevHealth = healthEngine.generate({ companyRuntime: runtime, companyBrief });

  const curHealth = cloneMutable(prevHealth);
  const overallDelta = 10;
  curHealth.overallScore = curHealth.overallScore + overallDelta;

  curHealth.overallStatus = scoreToStatus(curHealth.overallScore);
  curHealth.overallTrend = scoreToTrend(curHealth.overallScore);
  const curHealthFrozen = deepFreeze(curHealth);

  const insights = insightEngine.generate({
    previousCompanyHealth: prevHealth,
    currentCompanyHealth: curHealthFrozen,
  });

  const overallInsight = insights.insights.find(
    (i) => i.source === "company_health:overall" && i.category === "health",
  );
  assert.ok(overallInsight);
  assert.equal(overallInsight.direction, "improved");
  assert.ok(["low", "medium", "high", "critical"].includes(overallInsight.severity));
  assert.ok(insights.recommendedAttention.length > 0);
});

test("Dimension comparison: knowledge health score change generates knowledge insight", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const companyBrief = briefEngine.generate({ companyRuntime: runtime });
  const prevHealth = healthEngine.generate({ companyRuntime: runtime, companyBrief });

  const curHealth = cloneMutable(prevHealth);
  const knowledgeDim = getDimensionById(curHealth, "knowledge_health");
  assert.ok(knowledgeDim);
  const delta = 20;
  knowledgeDim.score = knowledgeDim.score + delta;
  knowledgeDim.status = scoreToStatus(knowledgeDim.score);
  knowledgeDim.trend = scoreToTrend(knowledgeDim.score);
  const curHealthFrozen = deepFreeze(curHealth);

  const insights = insightEngine.generate({
    previousCompanyHealth: prevHealth,
    currentCompanyHealth: curHealthFrozen,
  });

  const knowledgeInsight = insights.insights.find((i) => i.source.includes("dimension:knowledge_health"));
  assert.ok(knowledgeInsight);
  assert.equal(knowledgeInsight.category, "knowledge");
  assert.equal(knowledgeInsight.direction, "improved");
});

test("Risk changes: removing a risk produces a resolved health insight", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const companyBrief = briefEngine.generate({ companyRuntime: runtime });
  const prevHealth = healthEngine.generate({ companyRuntime: runtime, companyBrief });

  const riskToRemove = pickRiskIdMatching(prevHealth, (id) => id.includes("communication") || id.includes("disconnected"));
  assert.ok(riskToRemove, "expected at least one removable risk");

  const curHealth = cloneMutable(prevHealth);
  curHealth.risks = curHealth.risks.filter((r) => r.id !== riskToRemove);
  const curHealthFrozen = deepFreeze(curHealth);

  const insights = insightEngine.generate({
    previousCompanyHealth: prevHealth,
    currentCompanyHealth: curHealthFrozen,
  });

  const riskInsight = insights.insights.find((i) => i.id === `ins_risk_resolved_${riskToRemove}`);
  assert.ok(riskInsight);
  assert.equal(riskInsight.direction, "resolved");
  assert.equal(riskInsight.category, "health");
});

test("Recommendation changes: adding a recommendation produces a new health insight with recommendedAction", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const companyBrief = briefEngine.generate({ companyRuntime: runtime });
  const prevHealth = healthEngine.generate({ companyRuntime: runtime, companyBrief });

  const curHealth = cloneMutable(prevHealth);
  const rec = createCompanyHealthRecommendation({
    id: "rec_test_added",
    label: "Test recommendation",
    type: "TEST",
    target: "communications",
    priority: "MEDIUM",
    metadata: {},
  });
  curHealth.recommendations = [...curHealth.recommendations, rec];
  const curHealthFrozen = deepFreeze(curHealth);

  const insights = insightEngine.generate({
    previousCompanyHealth: prevHealth,
    currentCompanyHealth: curHealthFrozen,
  });

  const recInsight = insights.insights.find((i) => i.id === `ins_rec_new_rec_test_added`);
  assert.ok(recInsight);
  assert.equal(recInsight.direction, "new");
  assert.ok(recInsight.recommendedAction);
});

test("Work queue changes: pending review delta from CompanyBrief generates work_queue insight", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const prevBrief = briefEngine.generate({ companyRuntime: runtime });
  const prevHealth = healthEngine.generate({ companyRuntime: runtime, companyBrief: prevBrief });

  const curBrief = cloneMutable(prevBrief);
  const decision = curBrief.decisionsWaiting.find((d) => d.id === "decision_review_work_queue");
  assert.ok(decision);
  const before = decision.metadata.pendingReviews;
  decision.metadata.pendingReviews = before + 2;
  const curBriefFrozen = deepFreeze(curBrief);

  const insights = insightEngine.generate({
    previousCompanyHealth: prevHealth,
    currentCompanyHealth: prevHealth,
    previousCompanyBrief: prevBrief,
    currentCompanyBrief: curBriefFrozen,
  });

  const wqInsight = insights.insights.find((i) => i.category === "work_queue");
  assert.ok(wqInsight);
  assert.equal(wqInsight.direction, "declined");
});

test("Unchanged snapshots: identical inputs yield empty insights and stable summary", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const prevBrief = briefEngine.generate({ companyRuntime: runtime });
  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: prevBrief });

  const insights = insightEngine.generate({
    previousCompanyHealth: health,
    currentCompanyHealth: health,
    previousCompanyBrief: prevBrief,
    currentCompanyBrief: prevBrief,
  });

  assert.equal(insights.insights.length, 0);
  assert.equal(insights.summary, "No major changes since the previous snapshot.");
});

test("Immutability: generated insights are deep frozen", () => {
  const runtime = createSeededCompanyRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });

  const companyBrief = briefEngine.generate({ companyRuntime: runtime });
  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief });

  const insights = insightEngine.generate({
    previousCompanyHealth: health,
    currentCompanyHealth: health,
  });

  assert.ok(Object.isFrozen(insights));
  assert.ok(Object.isFrozen(insights.insights));
  assert.ok(Object.isFrozen(insights.recommendedAttention));
});

