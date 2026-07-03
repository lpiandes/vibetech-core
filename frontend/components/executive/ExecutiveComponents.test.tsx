import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ExecutiveCard from "./ExecutiveCard";
import ExecutiveHeader from "./ExecutiveHeader";
import MetricCard from "./MetricCard";
import HealthBadge from "./HealthBadge";
import InsightCard from "./InsightCard";
import RecommendationCard from "./RecommendationCard";
import ExecutiveEmptyState from "./ExecutiveEmptyState";

test("ExecutiveCard: renders children deterministically", () => {
  const html = renderToStaticMarkup(
    <ExecutiveCard>
      <div>hello</div>
    </ExecutiveCard>,
  );
  assert.ok(html.includes("hello"));
});

test("ExecutiveHeader: renders title and subtitle", () => {
  const html = renderToStaticMarkup(<ExecutiveHeader title="Analytics" subtitle="Executive performance" />);
  assert.ok(html.includes("Analytics"));
  assert.ok(html.includes("Executive performance"));
});

test("MetricCard: renders KPI title/value and labels", () => {
  const html = renderToStaticMarkup(<MetricCard title="Request Volume" value={3} badge="Recorded" status="recorded" priority="High" />);
  assert.ok(html.includes("Request Volume"));
  assert.ok(html.includes("3"));
  assert.ok(html.includes("Recorded"));
  assert.ok(html.includes("Status: recorded"));
  assert.ok(html.includes("High"));
});

test("HealthBadge: renders excellent label", () => {
  const html = renderToStaticMarkup(<HealthBadge level="excellent" />);
  assert.ok(html.includes("Excellent"));
});

test("InsightCard: renders title/category/message/importance", () => {
  const html = renderToStaticMarkup(<InsightCard title="High failures" category="communications" message="Failures recorded" importance="high" />);
  assert.ok(html.includes("High failures"));
  assert.ok(html.includes("Category: communications"));
  assert.ok(html.includes("Failures recorded"));
  assert.ok(html.includes("High"));
});

test("RecommendationCard: renders actionType/priority/recommendation", () => {
  const html = renderToStaticMarkup(
    <RecommendationCard title="Investigate" actionType="rec_investigate" priority={80} recommendation="Review provider execution" />,
  );
  assert.ok(html.includes("Investigate"));
  assert.ok(html.includes("Action: rec_investigate"));
  assert.ok(html.includes("Priority: 80"));
  assert.ok(html.includes("Review provider execution"));
});

test("ExecutiveEmptyState: uses calm empty state language", () => {
  const html = renderToStaticMarkup(<ExecutiveEmptyState title="No insights require attention" message="Performance data will appear as the business operates." />);
  assert.ok(html.includes("No insights require attention"));
  assert.ok(html.includes("Performance data will appear as the business operates."));
});

