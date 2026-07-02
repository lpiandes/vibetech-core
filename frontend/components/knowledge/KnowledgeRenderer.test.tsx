import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import KnowledgeRenderer from "./KnowledgeRenderer";
import KnowledgeContextProvider from "./KnowledgeContext";
import KnowledgeSummary from "./KnowledgeSummary";
import KnowledgeLoading from "./KnowledgeLoading";
import KnowledgeErrorBoundary from "./KnowledgeErrorBoundary";

const makeVm = () =>
  ({
    id: "knowledge_view",
    title: "Knowledge",
    summary: "Knowledge repository is ready for consistent execution.",
    categories: [
      { id: "FAQ", name: "FAQ", description: "Questions and answers", sortOrder: 10, items: [] },
    ],
    items: [],
    recommendations: [],
    metadata: { layout: "single" },
  }) as any;

test("Renderer: renders summary, categories, and recommendations sections", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<KnowledgeRenderer viewModel={vm} />);
  assert.ok(html.includes(vm.summary));
  assert.ok(html.includes("Categories"));
  assert.ok(html.includes("FAQ"));
  assert.ok(html.includes("Recommendations"));
  assert.ok(html.includes("No recommendations at this time."));
});

test("Empty state: knowledge items empty shows published empty state copy", () => {
  const vm = makeVm();
  vm.items = [];
  const html = renderToStaticMarkup(<KnowledgeRenderer viewModel={vm} />);
  assert.ok(html.includes("No knowledge has been published yet."));
});

test("Context: KnowledgeSummary reads from KnowledgeContext", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(
    <KnowledgeContextProvider viewModel={vm}>
      <KnowledgeSummary />
    </KnowledgeContextProvider>,
  );
  assert.ok(html.includes(vm.summary));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<KnowledgeLoading />);
  const b = renderToStaticMarkup(<KnowledgeLoading />);
  assert.deepEqual(a, b);
  assert.ok(a.includes("animate-pulse"));
});

test("Error boundary: fallback renders when child throws", () => {
  const Thrower = () => {
    throw new Error("render fail");
  };

  const html = renderToStaticMarkup(
    <KnowledgeErrorBoundary>
      <Thrower />
    </KnowledgeErrorBoundary>,
  );

  assert.ok(html.includes("Something went wrong while rendering knowledge"));
});

