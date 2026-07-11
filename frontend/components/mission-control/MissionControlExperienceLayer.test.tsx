import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MissionControlRenderer from "./MissionControlRenderer";
import MissionControlLoading from "./MissionControlLoading";
import MissionControlErrorBoundary from "./MissionControlErrorBoundary";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";

const scope = {
  businessId: "biz_1",
  role: "OWNER",
  permissions: [],
  businessName: "Harbor",
};

const makeVm = () =>
  ({
    viewId: "vm_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    headline: "Good morning.",
    subheadline: "Everything looks good.",
    overallStatus: "success",
    primaryFocus: "review_decisions",
    hero: {
      title: "Good morning.",
      subtitle: "Everything looks good.",
      status: "success",
      score: 72,
      primaryAction: "Review decisions",
      secondaryActions: ["act_2"],
      metadata: {},
    },
    commandCenter: { needsYourAttention: [] },
    sections: [],
    cards: [],
    actions: [],
    alerts: [],
    metadata: {},
  }) as any;

test("Empty state copy renders when nothing needs attention", () => {
  const vm = { ...makeVm(), commandCenter: { needsYourAttention: [] } };
  const html = renderToStaticMarkup(
    <BusinessScopeProvider value={scope as any}>
      <MissionControlRenderer viewModel={vm} variant="for_you" />
    </BusinessScopeProvider>,
  );
  assert.ok(html.includes("You're all caught up"));
});

test("Loading placeholders render deterministically", () => {
  const htmlA = renderToStaticMarkup(<MissionControlLoading />);
  const htmlB = renderToStaticMarkup(<MissionControlLoading />);
  assert.deepEqual(htmlA, htmlB);
  assert.ok(htmlA.includes("Loading"));
});

test("Error boundary shows fallback when child throws", () => {
  const Thrower = () => {
    throw new Error("render fail");
  };

  const html = renderToStaticMarkup(
    <MissionControlErrorBoundary>
      <Thrower />
    </MissionControlErrorBoundary>,
  );

  assert.ok(html.includes("Something went wrong"));
});
