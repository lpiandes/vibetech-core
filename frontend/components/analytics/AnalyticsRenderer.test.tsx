import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AnalyticsRenderer from "./AnalyticsRenderer";
import AnalyticsLoading from "./AnalyticsLoading";
import AnalyticsContextProvider, { AnalyticsViewModelContext } from "./AnalyticsContext";
import AnalyticsSummary from "./AnalyticsSummary";

const makeVm = (overrides: any = {}) =>
  ({
    viewId: "vm_analytics",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Overall is healthy.",
    overallPerformance: 72,
    kpis: [
      {
        kpiId: "request_volume",
        name: "Request Volume",
        category: "requests",
        value: 0,
        unit: "count",
        meaning: "meaning",
        status: "missing",
        badge: "Missing",
        priority: 90,
        metricId: "request_received_count",
        metadata: {},
      },
      {
        kpiId: "communication_failure_count",
        name: "Communication Failure",
        category: "communications",
        value: 5,
        unit: "count",
        meaning: "meaning",
        status: "recorded",
        badge: "Recorded",
        priority: 70,
        metricId: "communication_failed_count",
        metadata: {},
      },
    ],
    trends: [
      {
        trendId: "trend_request_volume",
        kpiId: "request_volume",
        direction: "declining",
        icon: "icon_down",
        severity: 90,
        previousValue: 2,
        currentValue: 1,
        note: "note",
        metadata: {},
      },
    ],
    insights: [
      {
        insightId: "insight_communication_failures",
        category: "communications",
        title: "High communication failures",
        message: "Failures recorded",
        importance: "high",
        evidence: ["communication_failed_count=5"],
        metadata: {},
      },
    ],
    recommendations: [
      {
        recommendationId: "rec_investigate_communication_failures",
        actionType: "rec_investigate_communication_failures",
        category: "communications",
        priority: 80,
        title: "Investigate communication failures",
        recommendation: "Review provider execution",
        evidence: ["communication_failed_count=5"],
        metadata: {},
      },
    ],
    metrics: [],
    metadata: { derivedFrom: { reportId: "report_1" } },
    ...overrides,
  }) as any;

test("AnalyticsRenderer: renders summary and overall performance", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<AnalyticsRenderer viewModel={vm} />);
  assert.ok(html.includes("Analytics"));
  assert.ok(html.includes("Executive performance"));
  assert.ok(html.includes("72%"));
  assert.ok(html.includes("Overall is healthy."));
});

test("AnalyticsRenderer: KPI rendering includes badge/status/priority label", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<AnalyticsRenderer viewModel={vm} />);
  assert.ok(html.includes("Missing"));
  assert.ok(html.includes("Recorded"));
  assert.ok(html.includes("Status: missing"));
  assert.ok(html.includes("Status: recorded"));
  assert.ok(html.includes("High priority"));
});

test("AnalyticsRenderer: trend rendering maps direction/icon/severity", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<AnalyticsRenderer viewModel={vm} />);
  assert.ok(html.includes("Direction: declining"));
  assert.ok(html.includes("Icon: icon_down"));
  assert.ok(html.includes("Severity: 90"));
});

test("AnalyticsRenderer: insight and recommendation rendering", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<AnalyticsRenderer viewModel={vm} />);
  assert.ok(html.includes("High communication failures"));
  assert.ok(html.includes("Failures recorded"));
  assert.ok(html.includes("Category: communications"));
  assert.ok(html.includes("Investigate communication failures"));
  assert.ok(html.includes("rec_investigate_communication_failures"));
});

test("AnalyticsRenderer: insight empty state language", () => {
  const vm = makeVm({ insights: [], recommendations: [] });
  const html = renderToStaticMarkup(<AnalyticsRenderer viewModel={vm} />);
  assert.ok(html.includes("No analytics insights require attention."));
  assert.ok(html.includes("No recommendations at this time."));
});

test("AnalyticsRenderer: metrics empty state language", () => {
  const vm = makeVm({ metrics: [] });
  const html = renderToStaticMarkup(<AnalyticsRenderer viewModel={vm} />);
  assert.ok(html.includes("Performance data will appear as the business operates."));
});

test("AnalyticsLoading: renders loading skeleton copy", () => {
  const html = renderToStaticMarkup(<AnalyticsLoading />);
  assert.ok(html.includes("Loading analytics..."));
});

test("AnalyticsContext: AnalyticsSummary reads viewModel from context", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(
    <AnalyticsContextProvider viewModel={vm}>
      <AnalyticsSummary />
    </AnalyticsContextProvider>,
  );
  assert.ok(html.includes("Executive performance"));
  assert.ok(html.includes("Overall is healthy."));
  assert.ok(html.includes("72%"));
  // Ensure the context is actually wired.
  assert.ok(AnalyticsViewModelContext !== null);
});

