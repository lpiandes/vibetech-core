import assert from "node:assert/strict";
import { test } from "node:test";

import { KnowledgeIngestionEngine } from "./KnowledgeIngestionEngine.js";
import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { detectSourceType } from "./stages/detectSourceType.js";
import { normalizeContent } from "./stages/normalizeContent.js";
import { extractBasicMetadata } from "./stages/extractBasicMetadata.js";
import { createKnowledgeItemInputs } from "./stages/createKnowledgeItemInputs.js";

test("detectSourceType: txt/markdown/html/pdf", () => {
  assert.equal(detectSourceType({ filename: "a.txt" }).sourceType, "TXT");
  assert.equal(detectSourceType({ filename: "b.md" }).sourceType, "MARKDOWN");
  assert.equal(detectSourceType({ filename: "c.html" }).sourceType, "HTML");
  assert.equal(detectSourceType({ filename: "d.pdf" }).sourceType, "PDF");
});

test("normalizeContent: strips HTML tags deterministically", () => {
  const input = "<h1>Title</h1><p>Hello <b>world</b>.</p>";
  const out = normalizeContent({ sourceType: "HTML", raw: input });
  assert.equal(out.text.includes("<"), false);
  assert.ok(out.text.toLowerCase().includes("title"));
  assert.ok(out.text.toLowerCase().includes("hello"));
  assert.ok(out.text.toLowerCase().includes("world"));
});

test("extractBasicMetadata: markdown heading becomes title", () => {
  const content = "# My FAQ\nThis is an answer with useful details.";
  const normalized = normalizeContent({ sourceType: "MARKDOWN", raw: content });
  const meta = extractBasicMetadata({
    sourceType: "MARKDOWN",
    filename: "faq.md",
    normalizedText: normalized.text,
  });
  assert.equal(meta.title, "My FAQ");
  assert.ok(meta.description.length > 0);
});

test("createKnowledgeItemInputs: produces deterministic id from sourceId/content", () => {
  const extractedMetadata = {
    title: "My FAQ",
    description: "Answer text",
    tags: ["faq"],
    searchKeywords: ["answer", "faq"],
    confidence: 0.6,
    metadata: { filename: "faq.md", sourceType: "MARKDOWN", charCount: "10", lineCount: 1 },
  };

  const inputs = createKnowledgeItemInputs({
    categoryId: "FAQ",
    sourceId: "src_1",
    filename: "faq.md",
    nowISO: "2026-07-01T00:00:00.000Z",
    createdBy: "tester",
    updatedBy: "tester",
    knowledgeItemId: undefined,
    extractedMetadata,
    industry: "Property Management",
    applicableEmployees: ["emp_prop_interest"],
  });

  assert.equal(inputs.length, 1);
  assert.ok(inputs[0].id.startsWith("kn_ing_src_1_"));
  assert.equal(inputs[0].category, "FAQ");
});

test("KnowledgeIngestionEngine: successful ingestion stores knowledge and publishes events", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new KnowledgeIngestionEngine({ runtime });

  const nowISO = "2026-07-01T19:30:00.000Z";
  const result = engine.ingest({
    sourceId: "src_faq_1",
    filename: "faq.md",
    content: "# My FAQ\nThis is the answer for ingestion.",
    categoryId: "FAQ",
    nowISO,
    createdBy: "tester",
    updatedBy: "tester",
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.knowledgeItemsCreated, 1);
  assert.equal(result.eventsPublished.length, 4);

  const knowledge = runtime.getKnowledge();
  const faq = knowledge.faqs.find((f) => f.question === "My FAQ");
  assert.ok(faq);
  assert.equal(faq.answer, "This is the answer for ingestion.");

  const activities = runtime.getActivities();
  const completed = activities.find(
    (a) =>
      a.action === "KNOWLEDGE_INGESTION_COMPLETED" && a.object === "src_faq_1",
  );
  assert.ok(completed);
});

test("KnowledgeIngestionEngine: invalid category fails and publishes FAILED event", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new KnowledgeIngestionEngine({ runtime });
  const beforeCount = runtime.getKnowledgeRepository().items.length;

  const result = engine.ingest({
    sourceId: "src_bad_cat",
    filename: "note.txt",
    content: "Hello knowledge",
    categoryId: "NOT_A_CATEGORY",
    nowISO: "2026-07-01T19:31:00.000Z",
  });

  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((e) => /invalid categoryId/i.test(e)));
  assert.equal(result.eventsPublished.length, 2);

  const afterCount = runtime.getKnowledgeRepository().items.length;
  assert.equal(afterCount, beforeCount);

  const activities = runtime.getActivities();
  const failed = activities.find(
    (a) => a.action === "KNOWLEDGE_INGESTION_FAILED" && a.object === "src_bad_cat",
  );
  assert.ok(failed);
});

test("KnowledgeIngestionEngine: DOCX parsing is rejected deterministically", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new KnowledgeIngestionEngine({ runtime });

  const result = engine.ingest({
    sourceId: "src_docx_1",
    filename: "doc.docx",
    content: "fake binary content",
    categoryId: "FAQ",
    nowISO: "2026-07-01T19:32:00.000Z",
  });

  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((e) => /DOCX parsing is not implemented/i.test(e)));
  // source_received + failed
  assert.equal(result.eventsPublished.length, 2);
});

