import assert from "node:assert/strict";
import { test } from "node:test";

import { composeMissionControlExperience } from "./composeMissionControlExperience.js";

test("Mission Control experience composes BI without fabricating metrics", () => {
  const composed = composeMissionControlExperience({
    missionControlViewModel: {
      headline: "Harbor",
      hero: { headline: "Harbor is operating", summary: "Steady day", businessName: "Harbor" },
      pulse: [
        { id: "open_work", label: "Open work", value: 4, trend: "stable" },
        { id: "mystery", label: "Mystery", value: null },
        { id: "blank", label: "Blank", value: "—" },
      ],
      needsYourAttention: [{ id: "a1", title: "Approve vendor quote" }],
      digitalWorkforce: {
        digitalEmployees: [{ id: "e1", name: "Coordinator", status: "active", currentHandling: "Intake" }],
      },
      businessEpisodeFeed: [{ episodeId: "ep1", title: "Prospect follow-up" }],
      businessActivity: [{ id: "act1", title: "Email sent" }],
      workMovingNow: [{ id: "w1", title: "Schedule showing" }],
      businessHealth: [],
      businessControlStatus: { label: "Under control", reason: "No critical blockers", tone: "success" },
    },
    businessIntelligenceView: {
      executiveBriefing: {
        headline: "Your business is being watched",
        summary: "3 findings",
        whatChanged: ["Approvals rose"],
        whatNeedsAttention: ["Intake bottleneck"],
        topRecommendation: { title: "Relieve intake", reason: "Backlog", confidence: "high" },
        nextHumanStep: "Explain → Preview → Approve",
      },
      businessHealth: {
        overallScore: 72,
        overallStatus: "Attention",
        overallTrend: "stable",
        overallConfidence: "medium",
        strengths: [],
        risks: [{ id: "r1", label: "Backlog", reason: "Queue depth" }],
        dimensions: [],
        explanation: "Derived from signals",
      },
      recommendations: [{
        recommendationId: "grec_1",
        title: "Relieve intake",
        reason: "Backlog",
        evidence: [{ label: "6 waiting" }],
        confidence: "high",
        businessImpact: "Faster response",
        risk: "high",
        requiredApprovals: ["owner"],
      }],
      opportunities: [{ recommendationId: "grec_2", title: "Surface unpaid invoices" }],
      capacity: [{ recommendationId: "grec_3", title: "Coordinator overload" }],
      risks: [{ recommendationId: "grec_4", title: "Approval backlog" }],
      recentImprovements: [{ id: "i1", label: "Added knowledge pack" }],
      observationCounts: { findings: 3 },
      honesty: { message: "Evidence required." },
    },
    recentCommunications: [{ id: "c1", title: "Owner update", preview: "Sent yesterday" }],
  });

  assert.equal(composed.experience.contract, "MissionControlExperience/v1");
  assert.equal(composed.experience.mutatesBusinessOs, false);
  assert.equal(composed.experience.fabricatedMetricsForbidden, true);
  assert.equal(composed.experience.criticalMetrics.length, 1);
  assert.equal(composed.experience.criticalMetrics[0].id, "open_work");
  assert.equal(composed.experience.waitingOnYou.length, 1);
  assert.equal(composed.experience.recommendations[0].title, "Relieve intake");
  assert.equal(composed.experience.recentCommunications[0].label, "Owner update");
  assert.equal(composed.experience.aiWorkforceActivity.digitalEmployees.length, 1);
  assert.equal(composed.executiveBriefing.headline, "Your business is being watched");
  assert.equal(composed.supervision.contract, "OperatingHomeSupervision/v1");
  assert.ok(composed.supervision.sectionOrder.indexOf("needsDecision")
    < composed.supervision.sectionOrder.indexOf("businessOverview"));
  assert.equal(composed.supervision.needsDecision.items.length, 1);
});

test("experience falls back calmly when BI is absent", () => {
  const composed = composeMissionControlExperience({
    missionControlViewModel: {
      hero: { headline: "Demo Co", summary: "Hello" },
      needsYourAttention: [],
      pulse: [],
      digitalWorkforce: { digitalEmployees: [] },
    },
  });
  assert.equal(composed.experience.executiveBriefing.headline, "Demo Co");
  assert.equal(composed.experience.recommendations.length, 0);
  assert.equal(composed.experience.criticalMetrics.length, 0);
});
