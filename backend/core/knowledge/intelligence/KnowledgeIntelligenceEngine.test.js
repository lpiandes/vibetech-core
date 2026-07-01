import assert from "node:assert/strict";
import { test } from "node:test";

import { KnowledgeIntelligenceEngine } from "./KnowledgeIntelligenceEngine.js";

function makeRuntimeStub({ employees, knowledgeRepository } = {}) {
  return {
    getEmployees: () => employees ?? [],
    getKnowledgeRepository: () => knowledgeRepository ?? { items: [] },
  };
}

test("Classification + suggested category + business areas are deterministic (FAQ)", () => {
  const runtime = makeRuntimeStub({
    employees: [
      {
        employeeId: "emp_support_1",
        employeeName: "Support Coordinator",
        status: "Working",
        capabilities: ["faq", "support", "customer support"],
      },
    ],
    knowledgeRepository: { items: [] },
  });

  const engine = new KnowledgeIntelligenceEngine({ runtime });

  const processedDocument = Object.freeze({
    id: "proc_1",
    sourceType: "MARKDOWN",
    title: "FAQ Title",
    plainText:
      "FAQ Q: What is included? Question: Answer: This document provides support, faq, help, customer service, and ticket guidance.",
    sections: [],
    headings: ["FAQ"],
    tables: [],
    metadata: { filename: "faq.md" },
    warnings: [],
    processingStatus: "OK",
    confidence: 0.75,
    processingTimeMs: 12,
  });

  const report = engine.analyzeProcessedDocument({
    processedDocument,
    nowISO: "2026-07-01T00:00:00.000Z",
  });

  assert.equal(report.detectedDocumentType, "FAQ");
  assert.equal(report.suggestedCategoryId, "FAQ");
  assert.ok(report.businessAreas.includes("CustomerSupport"));
  assert.equal(report.suggestedEmployees[0].employeeId, "emp_support_1");
  assert.equal(report.reviewRequired, false);
});

test("Confidence scoring + duplicate framework affects review requirement (exact fingerprint match)", () => {
  const processedDocument = Object.freeze({
    id: "proc_dup_1",
    sourceType: "MARKDOWN",
    title: "FAQ Title",
    plainText: "FAQ Q: What is included? Answer: This document provides support.",
    sections: [],
    headings: ["FAQ"],
    tables: [],
    metadata: { filename: "faq.md", team: "ops" },
    warnings: [],
    processingStatus: "OK",
    confidence: 0.75,
    processingTimeMs: 12,
  });

  const suggestedTags = ["faq"];

  const runtime = makeRuntimeStub({
    employees: [
      {
        employeeId: "emp_support_1",
        employeeName: "Support Coordinator",
        status: "Working",
        capabilities: ["faq", "support", "customer support"],
      },
    ],
    knowledgeRepository: {
      items: [
        {
          id: "kn_dup_1",
          status: "ACTIVE",
          title: "FAQ Title",
          description: processedDocument.plainText,
          searchKeywords: suggestedTags,
          metadata: processedDocument.metadata,
        },
      ],
    },
  });

  const engine = new KnowledgeIntelligenceEngine({ runtime });
  const report = engine.analyzeProcessedDocument({
    processedDocument,
    nowISO: "2026-07-01T00:00:00.000Z",
  });

  assert.equal(report.duplicateCandidates.length, 1);
  assert.equal(report.duplicateCandidates[0].knowledgeItemId, "kn_dup_1");
  assert.equal(report.reviewRequired, true);

  // Expected confidence:
  // docTypeMaxScore=11 => 11/20=0.55
  // businessAreaMax=6 (contains "faq" + "support") => 6/20=0.3
  // categoryNorm=0.7
  // employeesNorm=0.8
  // duplicatePenalty=0.15
  // raw=0.35*0.55 + 0.25*0.3 + 0.20*0.7 + 0.20*0.8 - 0.15
  // raw=0.5675-0.15=0.4175
  assert.equal(report.confidence, 0.4175);
});

test("Failure handling: processingStatus FAILED forces low confidence + review required", () => {
  const runtime = makeRuntimeStub({ employees: [], knowledgeRepository: { items: [] } });
  const engine = new KnowledgeIntelligenceEngine({ runtime });

  const processedDocument = Object.freeze({
    id: "proc_failed_1",
    sourceType: "TXT",
    title: "",
    plainText: "",
    sections: [],
    headings: [],
    tables: [],
    metadata: {},
    warnings: ["DOCX parsing failed"],
    processingStatus: "FAILED",
    confidence: 0,
    processingTimeMs: 8,
  });

  const report = engine.analyzeProcessedDocument({
    processedDocument,
    nowISO: "2026-07-01T00:00:00.000Z",
  });

  assert.equal(report.confidence, 0.1);
  assert.equal(report.reviewRequired, true);
});

