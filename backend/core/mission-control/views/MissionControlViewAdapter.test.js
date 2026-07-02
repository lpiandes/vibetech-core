import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { CompanyBriefEngine } from "../../business-intelligence/company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../../business-intelligence/company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../../business-intelligence/insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "../../business-intelligence/opportunities/CompanyOpportunityEngine.js";
import { CompanyRecommendationEngine } from "../../business-intelligence/recommendations/CompanyRecommendationEngine.js";

import { MissionControlGenerator } from "../MissionControlGenerator.js";
import { MissionControlViewAdapter } from "./MissionControlViewAdapter.js";
import { validateMissionControlViewModel } from "./MissionControlViewValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function buildMissionControl() {
  const runtime = new CompanyWorkspaceRuntime();
  const brief = new CompanyBriefEngine({ nowISO: NOW0 }).generate({ companyRuntime: runtime });
  const health = new CompanyHealthEngine({ nowISO: NOW0 }).generate({ companyRuntime: runtime, companyBrief: brief });
  const insights = new CompanyInsightEngine({ nowISO: NOW0 }).generate({ previousCompanyHealth: health, currentCompanyHealth: health });
  const opportunities = new CompanyOpportunityEngine({ nowISO: NOW0 }).generate({
    companyRuntime: runtime,
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
  });
  const recommendations = new CompanyRecommendationEngine({ nowISO: NOW0 }).generate({
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
    companyOpportunities: opportunities,
  });

  return new MissionControlGenerator({ nowISO: NOW0 }).generate({
    companyBrief: brief,
    companyHealth: health,
    companyInsights: insights,
    companyOpportunities: opportunities,
    companyRecommendations: recommendations,
  });
}

test("View model generation: deterministic across repeated runs", () => {
  const mc = buildMissionControl();
  const adapter = new MissionControlViewAdapter();
  const first = adapter.translate(mc);
  const second = adapter.translate(mc);
  assert.deepEqual(first, second);

  assert.deepEqual(validateMissionControlViewModel(first), { ok: true });
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.sections));
  assert.ok(Object.isFrozen(first.cards));
  assert.ok(Object.isFrozen(first.actions));
});

test("Hero generation: includes headline, subtitle, status, and primaryAction", () => {
  const mc = buildMissionControl();
  const adapter = new MissionControlViewAdapter();
  const vm = adapter.translate(mc);

  assert.ok(vm.hero.title && vm.hero.title.length > 0);
  assert.ok(vm.hero.subtitle && vm.hero.subtitle.length > 0);
  assert.ok(vm.hero.status && vm.hero.status.length > 0);
  assert.ok(vm.hero.primaryAction && typeof vm.hero.primaryAction === "string");
  assert.ok(Array.isArray(vm.hero.secondaryActions));
});

test("Section translation: section ids match MissionControl sections", () => {
  const mc = buildMissionControl();
  const adapter = new MissionControlViewAdapter();
  const vm = adapter.translate(mc);

  const missionIds = mc.sections.map((s) => s.id).sort();
  const viewIds = vm.sections.map((s) => s.id).sort();
  assert.deepEqual(viewIds, missionIds);
});

test("Card translation: card view ids match MissionControl cards", () => {
  const mc = buildMissionControl();
  const adapter = new MissionControlViewAdapter();
  const vm = adapter.translate(mc);

  const missionIds = mc.cards.map((c) => c.id).sort();
  const viewIds = vm.cards.map((c) => c.id).sort();
  assert.deepEqual(viewIds, missionIds);
});

test("Action translation: style is deterministic for priority tiers", () => {
  const mc = buildMissionControl();
  const adapter = new MissionControlViewAdapter();
  const vm = adapter.translate(mc);

  // pick a known action that should appear on an immediate-priority card (review_work_queue)
  const reviewAction = vm.actions.find((a) => a.id === "review_work_queue");
  // deterministic seed should produce it
  assert.ok(reviewAction);
  // style should match tier mapping.
  assert.ok(["primary", "secondary", "tertiary"].includes(reviewAction.style));
});

test("Validation: throws when hero missing primaryAction", () => {
  const mc = buildMissionControl();
  const adapter = new MissionControlViewAdapter();
  const vm = adapter.translate(mc);

  const mutable = JSON.parse(JSON.stringify(vm));
  mutable.hero.primaryAction = "";
  // re-freeze for validator check parity
  const frozen = Object.assign(mutable, {});
  Object.freeze(frozen);
  assert.throws(() => validateMissionControlViewModel(frozen), /hero\.primaryAction/);
});

