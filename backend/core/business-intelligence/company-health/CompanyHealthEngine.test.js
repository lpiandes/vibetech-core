import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime, createABCPropertyGroupSeed } from "../../company/CompanyWorkspaceRuntime.js";
import { CompanyBriefEngine } from "../company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "./CompanyHealthEngine.js";
import { validateCompanyHealth } from "./CompanyHealthValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("CompanyHealth generation: deterministic and immutable", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });

  const brief = briefEngine.generate({ companyRuntime: runtime });
  const healthA = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  const healthB = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });

  assert.deepEqual(healthA, healthB);
  assert.ok(Object.isFrozen(healthA));
  assert.ok(Object.isFrozen(healthA.dimensions));
  assert.ok(Object.isFrozen(healthA.recommendations));
});

test("Dimension generation: includes all default dimensions with valid schema", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });

  const ids = health.dimensions.map((d) => d.id);
  assert.deepEqual(ids, [
    "knowledge_health",
    "communication_health",
    "connected_systems_health",
    "digital_workforce_health",
    "operational_readiness",
    "business_profile_health",
    "company_profile_health",
    "workspace_health",
  ]);

  for (const d of health.dimensions) {
    assert.ok(typeof d.title === "string" && d.title.length > 0);
    assert.ok(typeof d.score === "number");
    assert.ok(d.score >= 0 && d.score <= 100);
    assert.ok(typeof d.status === "string");
    assert.ok(typeof d.trend === "string");
    assert.ok(typeof d.confidence === "number");
    assert.ok(typeof d.summary === "string" && d.summary.length > 0);
    assert.ok(Array.isArray(d.recommendations));
  }
});

test("Score/status/trend determinism: trend matches score bands", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  for (const d of health.dimensions) {
    if (d.score >= 80) assert.equal(d.trend, "UP");
    else if (d.score <= 40) assert.equal(d.trend, "DOWN");
    else assert.equal(d.trend, "STABLE");
  }
});

function seededRuntime() {
  return new CompanyWorkspaceRuntime({ seed: createABCPropertyGroupSeed });
}

test("Strength detection: knowledge and employee activity produce strengths", () => {
  const runtime = seededRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });

  const strengthLabels = health.strengths.map((s) => s.label);
  assert.ok(strengthLabels.includes("Knowledge complete"));
  assert.ok(strengthLabels.includes("Employees active"));
});

test("Risk detection: disconnected systems and approval backlog present", () => {
  const runtime = seededRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  const riskIds = health.risks.map((r) => r.id);

  assert.ok(riskIds.includes("risk_disconnected_systems"));
  assert.ok(riskIds.includes("risk_approval_backlog"));
});

test("Recommendation generation: includes reconnect email and review pending work", () => {
  const runtime = seededRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  const recIds = health.recommendations.map((r) => r.id);

  assert.ok(recIds.includes("rec_reconnect_email"));
  assert.ok(recIds.includes("rec_review_pending_work"));
});

test("Executive summary: includes deterministic knowledge + connected-system messaging", () => {
  const runtime = seededRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  assert.ok(health.summary.includes("Knowledge is a strength."));
  assert.ok(health.summary.includes("Connected systems require attention."));
});

test("Validation: validateCompanyHealth does not throw for generated object", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  assert.deepEqual(validateCompanyHealth(health), { ok: true });
});

test("Validation: invalid score throws", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const healthEngine = new CompanyHealthEngine({ nowISO: NOW0 });
  const briefEngine = new CompanyBriefEngine({ nowISO: NOW0 });
  const brief = briefEngine.generate({ companyRuntime: runtime });

  const health = healthEngine.generate({ companyRuntime: runtime, companyBrief: brief });
  const invalid = { ...health, overallScore: 999 };
  Object.freeze(invalid);
  assert.throws(() => validateCompanyHealth(invalid), /overallScore out of range/);
});

