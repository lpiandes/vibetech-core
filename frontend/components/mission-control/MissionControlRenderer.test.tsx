import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MissionControlRenderer from "./MissionControlRenderer";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";

const scope = {
  businessId: "biz_1",
  role: "OWNER",
  permissions: ["business.manage"],
  businessName: "Harbor",
};

const makeViewModel = () =>
  ({
    viewId: "vm_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    headline: "Good morning.",
    subheadline: "Your business is healthy",
    overallStatus: "success",
    primaryFocus: "review_decisions",
    hero: {
      title: "Good morning.",
      subtitle: "Your business is healthy",
      status: "success",
      score: 72,
      businessName: "Harbor",
      headline: "Harbor is operating",
      summary: "Steady morning",
      primaryAction: "Review decisions",
      secondaryActions: ["act_2"],
      metadata: {},
    },
    commandCenter: { needsYourAttention: [] },
    needsYourAttention: [],
    experience: {
      contract: "MissionControlExperience/v1",
      fabricatedMetricsForbidden: true,
      executiveBriefing: {
        headline: "Harbor is operating",
        summary: "Steady morning with evidence-backed supervision.",
        whatChanged: [],
        whatNeedsAttention: [],
        topRecommendation: null,
        nextHumanStep: "Review Waiting On You first.",
      },
      businessIntelligence: { honesty: "Evidence required.", observationCounts: { findings: 0 } },
      businessHealth: {
        overallScore: 72,
        overallStatus: "healthy",
        overallTrend: "stable",
        overallConfidence: "medium",
        explanation: "Derived from operating signals",
        strengths: [],
        risks: [],
      },
      aiWorkforceActivity: { digitalEmployees: [], handledByVibeTech: [] },
      activeBusinessEpisodes: [],
      waitingOnYou: [],
      aiOpportunities: [],
      businessTimeline: [],
      capacity: [],
      risks: [],
      recommendations: [],
      recentlyImproved: [],
      upcomingWork: [],
      recentCommunications: [],
      criticalMetrics: [{ id: "open_work", label: "Open work", value: 3, trend: "stable" }],
      operatingStates: [],
      businessControlStatus: { label: "Under control", reason: "No blockers", tone: "success" },
    },
    sections: [],
    cards: [],
    actions: [],
    alerts: [],
    metadata: {},
  }) as any;

function render(node: React.ReactElement) {
  return renderToStaticMarkup(
    <BusinessScopeProvider value={scope as any}>{node}</BusinessScopeProvider>,
  );
}

test("Mission Control experience renders living-business briefing and metrics", () => {
  const vm = makeViewModel();
  const html = render(<MissionControlRenderer viewModel={vm} variant="mission_control" />);
  assert.ok(html.includes("Mission Control"));
  assert.ok(html.includes("Harbor is operating"));
  assert.ok(html.includes("Open work"));
  assert.ok(html.includes("Evidence only"));
  assert.ok(html.includes("Waiting On You"));
});

test("For You variant stays attention-focused", () => {
  const vm = makeViewModel();
  const html = render(<MissionControlRenderer viewModel={vm} variant="for_you" />);
  assert.ok(html.includes("You're all caught up") || html.includes("For you"));
});
