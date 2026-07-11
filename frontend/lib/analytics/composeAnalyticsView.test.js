import assert from "node:assert/strict";
import { test } from "node:test";

import { composeAnalyticsView } from "./composeAnalyticsView.js";
import { AnalyticsEngine } from "../../../backend/core/analytics/kpi/AnalyticsEngine.js";

test("composeAnalyticsView projects KPIs alerts and missing-data guidance", () => {
  const recommended = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "dental" },
    businessId: "biz_dental",
    evidence: {
      asOf: "2026-07-11T12:00:00.000Z",
      workItems: [{ id: "w1", status: "OPEN", title: "Recall" }],
      approvals: [],
      integrations: [{ id: "i1", health: "connected", label: "Gmail" }],
      knowledgeDocumentCount: 2,
      memberCount: 3,
    },
  });
  const view = composeAnalyticsView({
    analyticsModel: recommended.analyticsModel,
    businessOsMapping: recommended.businessOsMapping,
    role: "OWNER",
  });
  assert.equal(view.hasAnalytics, true);
  assert.ok(view.kpis.length >= 1);
  assert.ok(view.reports.length >= 1);
  assert.ok(view.definitions.length >= 1);
  assert.equal(view.honesty.fabricatedMetricsForbidden, true);
});
