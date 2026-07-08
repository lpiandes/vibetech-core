import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import KnowledgeRenderer from "./KnowledgeRenderer";
import KnowledgeLoading from "./KnowledgeLoading";
import KnowledgeErrorBoundary from "./KnowledgeErrorBoundary";
import { buildKnowledgeExecutiveContext } from "./knowledgeSemantics";

const makeVm = () =>
  ({
    id: "knowledge_view",
    title: "Knowledge",
    subtitle: "Business knowledge",
    icon: "book",
    badges: [],
    actions: [],
    displayOrder: 70,
    visibility: "VISIBLE",
    status: "READY",
    categories: [],
    summary: "No knowledge yet.",
    health: { score: 0, level: "warning" },
    coverage: {},
    metrics: { totalKnowledgeItems: 0 },
    areas: [],
    gaps: [],
    risks: [],
    strengths: [],
    recommendations: [],
    nextFocusSubtitle: "",
    metadata: {},
  }) as any;

const makeContext = () =>
  buildKnowledgeExecutiveContext({
    employeeReadinessReport: {
      employees: [
        {
          employeeId: "pm_resident_prospect_coordinator",
          name: "Resident & Prospect Coordinator",
          role: "resident_prospect_coordination",
          requiredKnowledge: ["PM_LEASING"],
          missingKnowledge: [],
        },
      ],
    },
    installationResult: {
      dashboardPresentation: {
        knowledge: {
          categoryLabels: { PM_LEASING: "Leasing" },
          emptyStates: { documents: "Upload policies, procedures, and guides so VIBETech can support your Digital Employees." },
        },
      },
    },
  });

test("Renderer: knowledge page uses executive shell sections", () => {
  const html = renderToStaticMarkup(
    <KnowledgeRenderer
      viewModel={makeVm()}
      platformKnowledge={{ businessId: "biz-1", canManage: true, documents: [] }}
      knowledgeContext={makeContext()}
    />,
  );
  assert.ok(html.includes("Knowledge"));
  assert.ok(html.includes("Documents and business instructions VIBETech uses to understand how this company works."));
  assert.ok(html.includes("Business knowledge"));
  assert.ok(html.includes("What this helps VIBETech do"));
});

test("Renderer: document list renders polished rows without raw enums", () => {
  const html = renderToStaticMarkup(
    <KnowledgeRenderer
      viewModel={makeVm()}
      platformKnowledge={{
        businessId: "biz-1",
        canManage: true,
        documents: [
          {
            id: "doc-1",
            title: "Employee Handbook",
            originalFilename: "handbook.pdf",
            mimeType: "application/pdf",
            sourceType: "PDF",
            sizeBytes: 1024,
            status: "ready",
            textExtractionStatus: "skipped",
            uploadedBy: { id: "u1", name: "Owner" },
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      }}
      knowledgeContext={makeContext()}
    />,
  );
  assert.ok(html.includes("Employee Handbook"));
  assert.ok(html.includes("Ready"));
  assert.ok(!html.includes("skipped"));
  assert.ok(!html.includes("PDF</"));
});

test("Renderer: hides delete when canManage is false", () => {
  const html = renderToStaticMarkup(
    <KnowledgeRenderer
      viewModel={makeVm()}
      platformKnowledge={{
        businessId: "biz-1",
        canManage: false,
        documents: [
          {
            id: "doc-1",
            title: "Employee Handbook",
            originalFilename: "handbook.pdf",
            mimeType: "application/pdf",
            sourceType: "PDF",
            sizeBytes: 1024,
            status: "ready",
            textExtractionStatus: "skipped",
            uploadedBy: null,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      }}
      knowledgeContext={makeContext()}
    />,
  );
  assert.ok(!html.includes("Delete"));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<KnowledgeLoading />);
  const b = renderToStaticMarkup(<KnowledgeLoading />);
  assert.deepEqual(a, b);
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

  assert.ok(html.includes("Something went wrong"));
});
