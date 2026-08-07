import test from "node:test";
import assert from "node:assert/strict";
import { composeExecutiveDashboard } from "./ExecutiveDashboard.js";

test("composeExecutiveDashboard rolls sales + usage without inventing forecasts", () => {
  const dash = composeExecutiveDashboard({
    businessId: "biz_exec",
    installation: {
      businessId: "biz_exec",
      configuration: {
        businessName: "Acme",
        usageMeters: { "2026-07": { emails: 12, sms_segments: 4 } },
        crm: { pipelines: [] },
      },
    },
    openDecisionCount: 2,
    nowISO: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(dash.openDecisions, 2);
  assert.equal(dash.usage.emails, 12);
  assert.equal(dash.usage.smsSegments, 4);
  assert.match(dash.honesty, /not forecasts/i);
  assert.ok(dash.sales);
});
