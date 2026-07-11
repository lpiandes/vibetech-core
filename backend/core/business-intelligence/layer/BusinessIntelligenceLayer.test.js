import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createGovernedRecommendation,
  validateGovernedRecommendation,
  GOVERNANCE_PIPELINE,
} from "./GovernedRecommendation.js";
import { ReuseResolutionService } from "./ReuseResolutionService.js";
import { analyzeDeterministicObservations } from "./DeterministicObservationAnalyzers.js";
import {
  BusinessIntelligenceLayer,
  createBusinessIntelligenceWorkspace,
} from "./BusinessIntelligenceLayer.js";
import { adaptBusinessIntelligenceWorkspace } from "./views/BusinessIntelligenceViewAdapter.js";

const NOW = "2026-07-11T15:00:00.000Z";

test("governed recommendations require evidence and never mutate", () => {
  assert.throws(() => createGovernedRecommendation({
    recommendationId: "x",
    title: "No evidence",
    reason: "Because",
    businessImpact: "Impact",
    evidence: [],
  }));

  assert.throws(() => createGovernedRecommendation({
    recommendationId: "x",
    title: "Silent mutate",
    reason: "Because",
    businessImpact: "Impact",
    evidence: ["a"],
    mutatesBusinessOs: true,
  }));

  const rec = createGovernedRecommendation({
    recommendationId: "grec_1",
    title: "Your intake workflow is becoming a bottleneck.",
    reason: "Five or more intake items are waiting.",
    evidence: ["5 intake items waiting"],
    confidence: 0.9,
    businessImpact: "Intake backlog delays revenue.",
    affectedDepartments: ["Front Desk"],
    affectedEmployees: ["Front Desk Coordinator"],
    estimatedSavings: "Faster first response",
    risk: "high",
    requiredApprovals: ["owner", "operations_manager"],
  });

  assert.equal(rec.contract, "GovernedRecommendation/v1");
  assert.equal(rec.mutatesBusinessOs, false);
  assert.equal(rec.confidence, "high");
  assert.deepEqual(rec.pipeline, [...GOVERNANCE_PIPELINE]);
  assert.equal(validateGovernedRecommendation(rec).ok, true);
});

test("reuse resolver prefers configuration then archetypes before platform gaps", () => {
  const resolver = new ReuseResolutionService();
  const config = resolver.resolve({
    observationKind: "terminology",
    prefersConfiguration: true,
  });
  assert.equal(config.strategy, "configuration_only");
  assert.equal(config.isGap, false);

  const employee = resolver.resolve({
    observationKind: "split_employee",
    businessSummary: { industry: "property_management" },
  });
  assert.ok(["existing_employee_archetype", "existing_component", "existing_blueprint", "configuration_only", "new_platform_capability"].includes(employee.strategy));
});

test("deterministic analyzers produce example-style findings with evidence", () => {
  const workItems = Array.from({ length: 8 }, (_, index) => ({
    id: `w_${index}`,
    status: "open",
  }));
  const analyzed = analyzeDeterministicObservations({
    workRuntime: { getWorkItems: () => workItems },
    requestRuntime: {
      getRequests: () => Array.from({ length: 6 }, (_, index) => ({ id: `r_${index}`, status: "intake" })),
    },
    businessSummary: {
      industry: "property_management",
      roles: ["Marketing", "Sales"],
      customerTypes: ["Owners", "Tenants"],
    },
    installation: {
      configuration: {
        digitalWorkforce: [{ label: "Customer Success" }],
        terminology: { customer: "Customer", tenant: "Resident" },
      },
    },
    analytics: { missing: [{ id: "unpaid_invoices", label: "Unpaid invoices" }] },
    companyHealth: { risks: [], overallStatus: "Attention" },
    companyOpportunities: { opportunities: [] },
    companyInsights: { insights: [] },
  });

  const claims = analyzed.findings.map((entry) => entry.claim);
  assert.ok(claims.some((claim) => /manually assigning/i.test(claim)));
  assert.ok(claims.some((claim) => /duplicate customer/i.test(claim)));
  assert.ok(claims.some((claim) => /different terminology/i.test(claim)));
  assert.ok(claims.some((claim) => /split Customer Success/i.test(claim)));
  assert.ok(claims.some((claim) => /intake workflow is becoming a bottleneck/i.test(claim)));
  assert.ok(claims.some((claim) => /unpaid invoices/i.test(claim)));
  assert.ok(analyzed.findings.every((entry) => entry.evidenceLabels.length > 0));
});

test("BusinessIntelligenceLayer composes existing engines without mutation", () => {
  const brief = {
    briefId: "b1",
    companyId: "c1",
    generatedAt: NOW,
    greeting: "Good morning",
    summary: "Operations are steady.",
    overallStatus: "Healthy",
  };
  const health = {
    healthId: "h1",
    companyId: "c1",
    generatedAt: NOW,
    overallScore: 72,
    overallStatus: "Attention",
    overallTrend: "stable",
    overallConfidence: 0.7,
    dimensions: [],
    strengths: [{ id: "s1", title: "Knowledge published", reason: "Docs available" }],
    risks: [{ id: "risk_approval_backlog", title: "Approval backlog", summary: "Approvals waiting", priority: "HIGH", reason: "Queue depth" }],
    recommendations: [],
    summary: "Health needs attention.",
  };
  const insights = { insights: [{ id: "i1", title: "Approvals rose", summary: "More waiting", category: "work_queue", severity: "high", reason: "Compared to prior" }] };
  const opportunities = {
    opportunities: [{
      id: "o1",
      title: "Connect email",
      summary: "Email offline",
      category: "connected_systems",
      priority: "Now",
      impact: "High",
      effort: "Small",
      estimatedValue: "Faster replies",
      confidence: 0.8,
      reason: "Business email disconnected",
      recommendedAction: { id: "a1", label: "Connect email", type: "navigate", target: "integrations" },
    }],
  };
  const recommendations = {
    recommendations: [{
      id: "r1",
      title: "Review work queue",
      summary: "Clear backlog",
      category: "work_queue",
      priority: "immediate",
      impact: "High",
      effort: "Small",
      source: "test",
      reason: "Open work is stacking up",
      action: "review_work_queue",
      target: "work_queue",
    }],
  };

  const layer = new BusinessIntelligenceLayer({
    nowISO: NOW,
    briefEngine: { generate: () => brief },
    healthEngine: { generate: () => health },
    insightEngine: { generate: () => insights },
    opportunityEngine: { generate: () => opportunities },
    recommendationEngine: { generate: () => recommendations },
  });

  const workspace = layer.observeAndRecommend({
    companyRuntime: {
      getCompanyProfile: () => ({ companyId: "c1" }),
      getWorkQueue: () => ({ items: Array.from({ length: 4 }, (_, i) => ({ id: `w${i}`, status: "open" })) }),
    },
    businessSummary: { industry: "property_management" },
    workRuntime: {
      getWorkItems: () => Array.from({ length: 4 }, (_, i) => ({ id: `w${i}`, status: "open" })),
    },
  });

  assert.equal(workspace.contract, "BusinessIntelligenceWorkspace/v1");
  assert.equal(workspace.mutatesBusinessOs, false);
  assert.ok(workspace.recommendations.length >= 1);
  assert.ok(workspace.recommendations.every((rec) => rec.evidence.length > 0));
  assert.ok(workspace.recommendations.every((rec) => rec.requiredApprovals.length > 0));
  assert.ok(workspace.executiveBriefing.headline);
  assert.ok(workspace.futureRoadmap.length === 3);
  assert.deepEqual(workspace.pipeline, [...GOVERNANCE_PIPELINE]);

  const view = adaptBusinessIntelligenceWorkspace(workspace, {
    businessId: "biz_1",
    businessName: "Harbor",
  });
  assert.equal(view.contract, "BusinessIntelligenceWorkspaceView/v1");
  assert.ok(view.sections.some((section) => section.id === "executive_briefing"));
  assert.ok(view.sections.some((section) => section.id === "recommendations"));
  assert.ok(view.honesty.opaqueScoresForbidden);
});

test("workspace factory freezes mutatesBusinessOs false", () => {
  const workspace = createBusinessIntelligenceWorkspace({
    companyId: "c1",
    generatedAt: NOW,
    executiveBriefing: { headline: "x", summary: "y", whatChanged: [], whatNeedsAttention: [], topRecommendation: null, nextHumanStep: "n" },
    recommendations: [],
    opportunities: [],
    businessHealth: { overallScore: null, overallStatus: "unknown", overallTrend: "unknown", overallConfidence: "unknown", strengths: [], risks: [], dimensions: [], explanation: "" },
    risks: [],
    capacity: [],
    aiSuggestions: [],
    recentImprovements: [],
    futureRoadmap: [],
    changes: [],
    improving: [],
    worsening: [],
  });
  assert.equal(workspace.mutatesBusinessOs, false);
  assert.throws(() => {
    workspace.mutatesBusinessOs = true;
  });
});
