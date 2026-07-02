import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MissionControlRenderer from "./MissionControlRenderer";

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
      primaryAction: "Review decisions",
      secondaryActions: ["act_2"],
      metadata: {},
    },
    sections: [
      {
        id: "s_health",
        title: "Company Health",
        subtitle: "Overall status",
        status: "open",
        priority: "later",
        layout: "single",
        cards: ["card_health"],
        actions: ["act_1"],
        emptyState: "No items available.",
        metadata: {},
      },
    ],
    cards: [
      {
        id: "card_health",
        title: "Company Health",
        subtitle: "Good",
        body: "Knowledge is a strength.",
        status: "open",
        priority: "later",
        metric: 72,
        trend: "UP",
        badge: "success",
        icon: "health",
        actions: ["act_1"],
        source: "company_health",
        metadata: {},
      },
    ],
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
      {
        id: "act_2",
        label: "Review Operational Readiness",
        type: "review_operational_readiness",
        target: "operational_readiness",
        style: "secondary",
        priority: "soon",
        disabled: false,
        metadata: {},
      },
    ],
    alerts: [],
    metadata: {},
  }) as any;

test("Renderer: renders hero, sections, cards, and action labels", () => {
  const vm = makeViewModel();
  const html = renderToStaticMarkup(<MissionControlRenderer viewModel={vm} />);
  assert.ok(html.includes(vm.hero.title));
  assert.ok(html.includes(vm.sections[0].title));
  assert.ok(html.includes(vm.cards[0].title));
  assert.ok(html.includes(vm.actions[0].label));
});

test("Renderer: empty state appears when section has no cards", () => {
  const vm = makeViewModel();
  vm.sections = [
    {
      ...vm.sections[0],
      cards: [],
      emptyState: "Nothing queued.",
    },
  ];
  const html = renderToStaticMarkup(<MissionControlRenderer viewModel={vm} />);
  assert.ok(html.includes("Nothing queued."));
});

