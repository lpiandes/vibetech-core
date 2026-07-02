import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { CompanyBriefEngine } from "../business-intelligence/company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../business-intelligence/company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../business-intelligence/insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "../business-intelligence/opportunities/CompanyOpportunityEngine.js";
import { CompanyRecommendationEngine } from "../business-intelligence/recommendations/CompanyRecommendationEngine.js";

import { MissionControlGenerator } from "./MissionControlGenerator.js";
import { validateMissionControl } from "./MissionControlValidator.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function sectionIds() {
  return [
    "section_company_brief",
    "section_company_health",
    "section_recommendations",
    "section_decisions_waiting",
    "section_risks",
    "section_opportunities",
    "section_digital_workforce",
    "section_recent_activity",
    "section_connected_systems",
    "section_knowledge",
    "section_work_queue",
  ];
}

function derivedEnvironment() {
  const runtime = new CompanyWorkspaceRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const insightEngine = new CompanyInsightEngine({ nowISO: NOW0 });
  const opportunityEngine = new CompanyOpportunityEngine({ nowISO: NOW0 });
  const recommendationEngine = new CompanyRecommendationEngine({ nowISO: NOW0 });
  const missionGenerator = new MissionControlGenerator({ nowISO: NOW0 });

  const brief = briefEngine.generate({ companyRuntime: runtime });
  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  const insights = insightEngine.generate({ previousCompanyHealth: health, currentCompanyHealth: health });
  const opportunities = opportunityEngine.generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });
  const recommendations = recommendationEngine.generate({
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
    companyOpportunities: opportunities,
  });

  const missionControl = missionGenerator.generate({
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
    companyOpportunities: opportunities,
    companyRecommendations: recommendations,
  });

  return { runtime, brief, health, insights, opportunities, recommendations, missionControl };
}

test("MissionControl generation: deterministic and deep frozen", () => {
  const envA = derivedEnvironment();
  const envB = derivedEnvironment();

  assert.deepEqual(envA.missionControl, envB.missionControl);
  assert.ok(Object.isFrozen(envA.missionControl));
  assert.ok(Object.isFrozen(envA.missionControl.sections));
  assert.ok(Object.isFrozen(envA.missionControl.cards));
  assert.ok(Object.isFrozen(envA.missionControl.actions));
  assert.ok(Object.isFrozen(envA.missionControl.alerts));

  assert.deepEqual(validateMissionControl(envA.missionControl), { ok: true });
});

test("Headline generation: non-empty and aligned to overallStatus", () => {
  const { missionControl, brief } = derivedEnvironment();
  assert.ok(missionControl.headline && missionControl.headline.length > 0);

  // Seed environment should reflect decision count in healthy headline.
  const decisionCount = Array.isArray(brief.decisionsWaiting) ? brief.decisionsWaiting.length : 0;
  if (missionControl.overallStatus === "healthy") {
    assert.ok(missionControl.headline.includes(String(decisionCount)));
  }
});

test("Primary focus selection: review_decisions when decisions are waiting", () => {
  const { missionControl, brief } = derivedEnvironment();
  const decisionCount = Array.isArray(brief.decisionsWaiting) ? brief.decisionsWaiting.length : 0;

  // Generator prioritizes setup_required first, otherwise review_decisions next.
  if (decisionCount > 0) {
    assert.equal(missionControl.primaryFocus, "review_decisions");
  }
});

test("Section generation: includes required section ids", () => {
  const { missionControl } = derivedEnvironment();
  const ids = missionControl.sections.map((s) => s.id);
  assert.deepEqual(ids.sort(), sectionIds().sort());
});

test("Card generation: includes Top Recommendation card and actions reference actions list", () => {
  const { missionControl } = derivedEnvironment();
  const top = missionControl.cards.find((c) => c.id === "card_top_recommendation");
  assert.ok(top);
  assert.ok(Array.isArray(top.actions));
  assert.ok(top.actions.length === 0 || missionControl.actions.some((a) => a.id === top.actions[0]));
});

test("Action generation: includes top recommendation action if open", () => {
  const { missionControl, recommendations } = derivedEnvironment();
  const topRec = recommendations.topRecommendation;
  if (topRec && topRec.status === "open") {
    assert.ok(missionControl.actions.some((a) => a.id === topRec.action));
  }
});

test("Validation: validator throws when primaryFocus missing", () => {
  const { missionControl } = derivedEnvironment();
  const mutable = JSON.parse(JSON.stringify(missionControl));
  mutable.primaryFocus = "";
  const frozen = deepFreeze(mutable);

  assert.throws(() => validateMissionControl(frozen), /primaryFocus/);
});

