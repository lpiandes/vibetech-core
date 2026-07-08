import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MissionControlRenderer from "./MissionControlRenderer";
import MissionControlLoading from "./MissionControlLoading";
import MissionControlErrorBoundary from "./MissionControlErrorBoundary";

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
    sections: [
      {
        id: "section_recommendations",
        title: "Recommendations",
        subtitle: "No items",
        status: "open",
        priority: "later",
        layout: "single",
        cards: [],
        actions: [],
        emptyState: "Everything looks good. No immediate action is required.",
        metadata: {},
      },
    ],
    cards: [],
    actions: [
      {
        id: "act_1",
        label: "Review Work Queue",
        type: "review_work_queue",
        target: "work_queue",
        style: "primary",
        priority: "immediate",
        disabled: false,
        metadata: {},
      },
    ],
    alerts: [],
    metadata: {},
  }) as any;

test("Empty state copy renders when nothing needs attention", () => {
  const vm = { ...makeVm(), commandCenter: { needsYourAttention: [] } };
  const html = renderToStaticMarkup(<MissionControlRenderer viewModel={vm} />);
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

