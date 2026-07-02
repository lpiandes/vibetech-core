import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CapabilityRenderer from "./CapabilityRenderer";

const makeVm = () =>
  ({
    viewId: "vm_capabilities",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Your capabilities are fully covered.",
    overallReadiness: 100,
    coverage: {
      coverageScore: 100,
      gapScore: 0,
      riskScore: 0,
      coverageSummary: "100% coverage",
      requiredCapabilities: [],
      coveredCapabilities: [],
      unmatchedWorkRequirements: [],
    },
    categories: [],
    providers: [],
    gaps: [],
    risks: [],
    recommendations: [],
    metrics: {
      totalRequiredCapabilities: 0,
      totalCoveredCapabilities: 0,
      gapCount: 0,
      riskCount: 0,
      recommendationCount: 0,
      coverageScore: 100,
      gapScore: 0,
      riskScore: 0,
      overallReadiness: 100,
      coverageSummary: "100% coverage",
    },
    metadata: { derivedFrom: { reportId: "report_1" } },
  }) as any;

test("CapabilityRenderer: renders empty state executive copy deterministically", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<CapabilityRenderer viewModel={vm} />);

  assert.ok(html.includes("Capabilities"));
  assert.ok(html.includes("Overall readiness"));
  assert.ok(html.includes("100% coverage"));
  assert.ok(html.includes("Your capabilities are fully covered."));
  assert.ok(html.includes("No capability risks require attention."));
  assert.ok(html.includes("No capability gaps have been identified."));
});

