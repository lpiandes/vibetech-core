import assert from "node:assert/strict";
import { test } from "node:test";

import { KnowledgeDraftEngine } from "./KnowledgeDraftEngine.js";
import { createKnowledgeItem } from "../KnowledgeItem.js";

function makeIntelligenceReport({
  reportId = "report_1",
  suggestedCategoryId = "FAQ",
  suggestedTags = ["faq"],
  suggestedEmployees = [{ employeeId: "emp_1", employeeName: "Emp 1" }],
  confidence = 0.75,
  reviewRequired = false,
  warnings = [],
  metadata = { x: "y" },
} = {}) {
  return Object.freeze({
    reportId,
    processedDocumentId: "proc_1",
    detectedDocumentType: "FAQ",
    suggestedCategoryId,
    suggestedTags,
    businessAreas: ["CustomerSupport"],
    suggestedEmployees,
    confidence,
    duplicateCandidates: [],
    reviewRequired,
    warnings,
    metadata,
    generatedAt: "2026-07-01T00:00:00.000Z",
  });
}

test("Draft generation: single draft + schema validity + confidence propagation", () => {
  const processedDocument = Object.freeze({
    id: "proc_1",
    sourceType: "MARKDOWN",
    title: "FAQ Title",
    plainText: "Full FAQ body text",
    sections: [],
    headings: ["FAQ"],
    tables: [],
    metadata: { filename: "faq.md", industry: "property-management" },
    warnings: [],
    processingStatus: "OK",
    confidence: 0.75,
    processingTimeMs: 12,
  });

  const intelligenceReport = makeIntelligenceReport({
    reportId: "report_single",
    confidence: 0.8,
    reviewRequired: false,
    suggestedCategoryId: "FAQ",
    suggestedTags: ["faq", "support"],
    suggestedEmployees: [{ employeeId: "emp_1", employeeName: "Support Coordinator" }],
  });

  const engine = new KnowledgeDraftEngine({});

  const nowISO = "2026-07-01T00:00:00.000Z";
  const drafts = engine.generateDrafts({
    processedDocument,
    knowledgeIntelligenceReport: intelligenceReport,
    nowISO,
  });

  assert.equal(Array.isArray(drafts), true);
  assert.equal(drafts.length, 1);

  const draft = drafts[0];
  assert.equal(draft.sourceDocumentId, "proc_1");
  assert.equal(draft.intelligenceReportId, "report_single");
  assert.equal(draft.confidence, 0.8);
  assert.equal(draft.reviewRequired, false);
  assert.equal(draft.suggestedCategory, "FAQ");
  assert.deepEqual(draft.suggestedTags, ["faq", "support"]);
  assert.deepEqual(draft.suggestedEmployees, ["emp_1"]);
  assert.equal(draft.generatedAt, nowISO);

  // proposedKnowledgeItem is validated by KnowledgeItem.createKnowledgeItem
  // (In production, the Draft Engine only produces proposals. This call is test-only schema validation.)
  createKnowledgeItem(draft.proposedKnowledgeItem);
  assert.equal(draft.proposedKnowledgeItem.category, "FAQ");
  assert.deepEqual(draft.proposedKnowledgeItem.tags, ["faq", "support"]);
  assert.deepEqual(draft.proposedKnowledgeItem.applicableEmployees, ["emp_1"]);
  assert.equal(draft.proposedKnowledgeItem.status, "READY_FOR_PERSISTENCE");
});

test("Draft generation: reviewRequired propagation changes draftStatus", () => {
  const processedDocument = Object.freeze({
    id: "proc_2",
    sourceType: "TXT",
    title: "Policy Title",
    plainText: "Policy full text",
    sections: [],
    headings: ["Policy"],
    tables: [],
    metadata: { filename: "policy.txt", industry: "property-management" },
    warnings: [],
    processingStatus: "OK",
    confidence: 0.5,
    processingTimeMs: 8,
  });

  const intelligenceReport = makeIntelligenceReport({
    reportId: "report_review",
    suggestedCategoryId: "POLICIES",
    suggestedTags: ["policy", "compliance"],
    suggestedEmployees: [{ employeeId: "emp_2", employeeName: "Legal Coordinator" }],
    confidence: 0.55,
    reviewRequired: true,
    warnings: ["Low metadata quality."],
  });

  const engine = new KnowledgeDraftEngine({});
  const nowISO = "2026-07-01T00:00:00.000Z";
  const drafts = engine.generateDrafts({
    processedDocument,
    knowledgeIntelligenceReport: intelligenceReport,
    nowISO,
  });

  assert.equal(drafts.length, 1);
  const draft = drafts[0];
  assert.equal(draft.reviewRequired, true);
  assert.equal(draft.draftStatus, "NEEDS_REVIEW");
  assert.equal(draft.proposedKnowledgeItem.status, "NEEDS_REVIEW");
  assert.equal(draft.confidence, 0.55);
  assert.deepEqual(draft.warnings, intelligenceReport.warnings);
});

test("Draft generation: multiple drafts supported via simple section splitting", () => {
  const processedDocument = Object.freeze({
    id: "proc_multi",
    sourceType: "TXT",
    title: "Property Manual",
    plainText: "Full manual text",
    sections: ["Section A text", "Section B text", "Section C text"],
    headings: ["A Heading", "B Heading", "C Heading"],
    tables: [],
    metadata: { filename: "manual.txt", industry: "property-management" },
    warnings: [],
    processingStatus: "OK",
    confidence: 0.6,
    processingTimeMs: 8,
  });

  const intelligenceReport = makeIntelligenceReport({
    reportId: "report_multi",
    suggestedCategoryId: "DOCUMENTS",
    suggestedTags: ["document", "manual"],
    suggestedEmployees: [{ employeeId: "emp_3", employeeName: "Ops Coordinator" }],
    confidence: 0.7,
    reviewRequired: false,
  });

  const engine = new KnowledgeDraftEngine({});
  const nowISO = "2026-07-01T00:00:00.000Z";
  const drafts = engine.generateDrafts({
    processedDocument,
    knowledgeIntelligenceReport: intelligenceReport,
    nowISO,
  });

  assert.equal(drafts.length, 3);
  for (let i = 0; i < drafts.length; i += 1) {
    assert.equal(drafts[i].confidence, 0.7);
    assert.equal(drafts[i].reviewRequired, false);
    assert.equal(drafts[i].sourceDocumentId, "proc_multi");
    assert.equal(drafts[i].proposedKnowledgeItem.description, processedDocument.sections[i]);
    assert.equal(drafts[i].proposedKnowledgeItem.metadata.chunkIndex, i);
  }
});

test("Failure handling: missing intelligence report throws", () => {
  const processedDocument = Object.freeze({
    id: "proc_fail",
    sourceType: "TXT",
    title: "Fail",
    plainText: "x",
    sections: [],
    headings: [],
    tables: [],
    metadata: {},
    warnings: [],
    processingStatus: "OK",
    confidence: 0.5,
    processingTimeMs: 1,
  });

  const engine = new KnowledgeDraftEngine({});
  assert.throws(() => {
    engine.generateDrafts({ processedDocument, knowledgeIntelligenceReport: null });
  });
});

test("Determinism: same inputs -> same draftIds and proposed knowledge", () => {
  const processedDocument = Object.freeze({
    id: "proc_det",
    sourceType: "TXT",
    title: "Deterministic",
    plainText: "Deterministic text",
    sections: ["One section", "Two section"],
    headings: ["One", "Two"],
    tables: [],
    metadata: { filename: "det.txt", industry: "property-management" },
    warnings: [],
    processingStatus: "OK",
    confidence: 0.6,
    processingTimeMs: 1,
  });

  const intelligenceReport = makeIntelligenceReport({
    reportId: "report_det",
    suggestedCategoryId: "FAQ",
    suggestedTags: ["faq"],
    suggestedEmployees: [{ employeeId: "emp_1", employeeName: "Emp 1" }],
    confidence: 0.65,
    reviewRequired: false,
  });

  const engine = new KnowledgeDraftEngine({});
  const nowISO = "2026-07-01T00:00:00.000Z";

  const draftsA = engine.generateDrafts({
    processedDocument,
    knowledgeIntelligenceReport: intelligenceReport,
    nowISO,
  });
  const draftsB = engine.generateDrafts({
    processedDocument,
    knowledgeIntelligenceReport: intelligenceReport,
    nowISO,
  });

  assert.deepEqual(
    draftsA.map((d) => ({ draftId: d.draftId, proposedId: d.proposedKnowledgeItem.id, title: d.proposedKnowledgeItem.title })),
    draftsB.map((d) => ({ draftId: d.draftId, proposedId: d.proposedKnowledgeItem.id, title: d.proposedKnowledgeItem.title })),
  );
});

