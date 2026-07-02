import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { CompanyBriefEngine } from "./CompanyBriefEngine.js";
import { validateCompanyBrief } from "./CompanyBriefValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

test("Company brief generation: deterministic and immutable", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const briefA = engine.generate({ companyRuntime: runtime });
  const briefB = engine.generate({ companyRuntime: runtime });

  assert.deepEqual(briefA, briefB);
  assert.ok(Object.isFrozen(briefA));
  assert.ok(Object.isFrozen(briefA.sections));
  assert.ok(Object.isFrozen(briefA.recommendedActions));
});

test("Summary generation: matches deterministic executive summary", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const brief = engine.generate({ companyRuntime: runtime });

  const metrics = runtime.getMetrics();
  const pendingReviews = Number(metrics.pendingReviews ?? 0);
  assert.equal(pendingReviews, 3);

  const disconnected = runtime
    .getConnectedSystems()
    .filter((s) => String(s.status) !== "READY").length;
  assert.equal(disconnected, 2);

  const knowledgeActiveCount = runtime
    .getKnowledgeRepository()
    .items.filter((i) => i.status !== "ARCHIVED").length;
  assert.ok(knowledgeActiveCount > 0);

  assert.equal(
    brief.summary,
    "3 items need review.Communications are healthy.Knowledge is ready.2 connected system(s) need attention.",
  );
});

test("Section generation: required sections exist and have items/actions", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const brief = engine.generate({ companyRuntime: runtime });

  const sectionIds = brief.sections.map((s) => s.id);
  assert.deepEqual(sectionIds, [
    "company_pulse",
    "today_priorities",
    "decisions_waiting",
    "digital_workforce",
    "recent_activity",
    "risks",
    "opportunities",
    "recommendations",
  ]);

  for (const section of brief.sections) {
    assert.ok(section.title);
    assert.ok(Array.isArray(section.items));
    assert.ok(Array.isArray(section.actions));
  }
});

test("Priority ordering: review queue is first", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const brief = engine.generate({ companyRuntime: runtime });

  assert.ok(brief.priorities.length > 0);
  assert.equal(brief.priorities[0].id, "priority_review_work_queue");

  // With seeded runtime, disconnected systems exist and should appear before capability readiness gaps.
  const second = brief.priorities[1];
  assert.ok(second);
  assert.equal(second.id, "priority_disconnected_systems");
});

test("Risk detection: disconnected systems + approval backlog present", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const brief = engine.generate({ companyRuntime: runtime });

  const riskIds = brief.risks.map((r) => r.id);
  assert.ok(riskIds.includes("risk_disconnected_systems"));
  assert.ok(riskIds.includes("risk_approval_backlog"));
  assert.ok(!riskIds.includes("risk_communication_failures"));
});

test("Opportunity detection: connect missing systems and communication readiness are derived", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const brief = engine.generate({ companyRuntime: runtime });
  const oppIds = brief.opportunities.map((o) => o.id);

  assert.ok(oppIds.includes("opp_connect_missing_systems"));

  const commSetup = runtime.getCommunicationSetup();
  const readiness = commSetup?.readiness ?? {};
  const readinessOk =
    Boolean(readiness.emailReady) &&
    Boolean(readiness.smsReady) &&
    Boolean(readiness.brandReady) &&
    Boolean(readiness.quietHoursReady) &&
    Boolean(readiness.approvalPolicyReady);

  if (!readinessOk) {
    assert.ok(oppIds.includes("opp_improve_communication_readiness"));
  }
});

test("Action generation: review work + reconnect disconnected systems + view workforce", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });

  const brief = engine.generate({ companyRuntime: runtime });
  const actionIds = brief.recommendedActions.map((a) => a.id);

  assert.ok(actionIds.includes("action_review_work_queue"));
  assert.ok(actionIds.includes("action_reconnect_email"));
  assert.ok(actionIds.includes("action_reconnect_crm"));
  assert.ok(actionIds.includes("action_view_digital_workforce"));

  // Seed runtime has active knowledge and no knowledge failure events => upload knowledge should not be suggested.
  assert.ok(!actionIds.includes("action_upload_knowledge"));
});

test("Validation: validateCompanyBrief does not throw", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = engine.generate({ companyRuntime: runtime });
  assert.deepEqual(validateCompanyBrief(brief), { ok: true });
});

