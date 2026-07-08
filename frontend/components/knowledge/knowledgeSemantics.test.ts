import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildKnowledgeExecutiveContext,
  deriveKnowledgeCounts,
  documentNeedsAttention,
  documentStatusPresentation,
  extractionStatusPresentation,
  sourceTypePresentation,
  canManageKnowledge,
} from "./knowledgeSemantics.ts";

const makeDocument = (overrides: Record<string, unknown> = {}) => ({
  id: "doc-1",
  title: "Leasing Guide",
  originalFilename: "leasing.pdf",
  mimeType: "application/pdf",
  sourceType: "PDF",
  sizeBytes: 2048,
  status: "ready",
  textExtractionStatus: "skipped",
  uploadedBy: { id: "u1", name: "Owner" },
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

const presentation = {
  sourceTypeLabels: { PDF: "PDF", DOCX: "Word document" },
  documentStatusLabels: { ready: "Ready", failed: "Needs attention" },
  extractionStatusLabels: { failed: "Extraction failed", succeeded: "Text extracted" },
  categoryLabels: {
    PM_LEASING: "Leasing",
    PM_RESIDENT_COMMUNICATION: "Resident communication",
  },
};

test("knowledge metrics match documents", () => {
  const documents = [
    makeDocument({ id: "d1", status: "ready" }),
    makeDocument({ id: "d2", status: "ready" }),
    makeDocument({ id: "d3", status: "failed", textExtractionStatus: "failed" }),
  ];

  const context = buildKnowledgeExecutiveContext({
    employeeReadinessReport: {
      employees: [
        {
          employeeId: "pm_resident_prospect_coordinator",
          name: "Resident & Prospect Coordinator",
          role: "resident_prospect_coordination",
          requiredKnowledge: ["PM_LEASING", "PM_RESIDENT_COMMUNICATION"],
          missingKnowledge: [],
        },
      ],
    },
    installationResult: { dashboardPresentation: { knowledge: presentation, roleLabels: {} } },
  });

  const counts = deriveKnowledgeCounts(documents as never[], context);
  assert.equal(counts.total, 3);
  assert.equal(counts.ready, 2);
  assert.equal(counts.needsAttention, 1);
  assert.deepEqual(
    counts.metrics.map((metric) => metric.value),
    ["3", "2", "1", "1"],
  );
});

test("document rows use human labels, not raw enums", () => {
  const doc = makeDocument({ sourceType: "PDF", status: "ready", textExtractionStatus: "skipped" });
  const status = documentStatusPresentation(doc as never, presentation);
  const source = sourceTypePresentation(doc as never, presentation);
  const extraction = extractionStatusPresentation(doc as never, presentation);

  assert.equal(status.label, "Ready");
  assert.equal(source, "PDF");
  assert.equal(extraction, null);
  assert.equal(documentNeedsAttention(doc as never), false);
});

test("failed extraction and status count as needs attention", () => {
  const doc = makeDocument({ status: "ready", textExtractionStatus: "failed" });
  assert.equal(documentNeedsAttention(doc as never), true);
  assert.equal(extractionStatusPresentation(doc as never, presentation), "Extraction failed");
});

test("knowledge executive context derives truthful employee relationships", () => {
  const context = buildKnowledgeExecutiveContext({
    employeeReadinessReport: {
      employees: [
        {
          employeeId: "pm_resident_prospect_coordinator",
          name: "Resident & Prospect Coordinator",
          role: "resident_prospect_coordination",
          requiredKnowledge: ["PM_LEASING", "PM_RESIDENT_COMMUNICATION"],
          missingKnowledge: [],
        },
        {
          employeeId: "pm_maintenance_coordinator",
          name: "Maintenance Coordinator",
          role: "maintenance_coordination",
          requiredKnowledge: ["PM_MAINTENANCE", "PM_VENDORS"],
          missingKnowledge: ["PM_MAINTENANCE", "PM_VENDORS"],
        },
      ],
    },
    installationResult: { dashboardPresentation: { knowledge: presentation, roleLabels: {} } },
  });

  assert.equal(context.helpedEmployeeCount, 1);
  assert.equal(context.employeesWithKnowledgeRequirements, 2);
  assert.equal(context.setupNeeds.length, 2);
  assert.ok(context.employeeImpacts[0].helped);
  assert.equal(context.employeeImpacts[1].missingCategories[0], "Maintenance");
  assert.ok(!JSON.stringify(context.employeeImpacts).includes("PM_MAINTENANCE"));
});

test("canManageKnowledge gates add and delete affordances", () => {
  assert.equal(canManageKnowledge(true), true);
  assert.equal(canManageKnowledge(false), false);
  assert.equal(canManageKnowledge(undefined), false);
});

test("compact empty state copy stays executive", () => {
  const counts = deriveKnowledgeCounts([]);
  assert.equal(counts.total, 0);
  assert.equal(counts.metrics[0].value, "0");
});
