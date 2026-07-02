import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { CompanyBrain } from "../../company/brain/CompanyBrain.js";

import { createKnowledgeDraft } from "../drafts/KnowledgeDraft.js";
import { KnowledgePublishingEngine } from "./KnowledgePublishingEngine.js";
import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";

function makeDraft({ draftId = "draft_1", intelligenceReportId = "report_1", nowISO, categoryId = "FAQ", status = "READY_FOR_PERSISTENCE" } = {}) {
  const suggestedCategoryId = categoryId;
  const proposedKnowledgeItemInput = {
    id: `kn_pub_${draftId}`,
    title: "Walkthrough FAQ for today",
    description: "This walkthrough guidance covers next steps today.",
    category: categoryId,
    tags: ["faq", "walkthrough"],
    relationships: [],
    version: 1,
    revisionHistory: [],
    createdAt: nowISO,
    updatedAt: nowISO,
    createdBy: "test",
    updatedBy: "test",
    visibility: "INTERNAL",
    status: status,
    source: "knowledge_draft_engine:test",
    confidence: 0.77,
    priority: "Medium",
    industry: "property-management",
    applicableEmployees: ["emp_1"],
    searchKeywords: ["walkthrough", "today", "faq"],
    metadata: { fromDraft: draftId },
  };

  return createKnowledgeDraft({
    draftId,
    sourceDocumentId: "proc_1",
    intelligenceReportId,
    proposedKnowledgeItemInput,
    suggestedCategoryId,
    suggestedTags: ["faq", "walkthrough"],
    suggestedEmployees: ["emp_1"],
    confidence: 0.77,
    reviewRequired: false,
    warnings: [],
    draftStatus: status,
    generatedAt: nowISO,
    metadata: { test: true },
  });
}

test("Knowledge publishing: SUCCESS updates repository and CompanyBrain sees it", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new KnowledgePublishingEngine({ runtime });
  const nowISO = "2026-07-01T00:00:00.000Z";

  const draft = makeDraft({ draftId: "draft_success", nowISO, categoryId: "FAQ" });

  const result = engine.publishDraft({ draft, nowISO });
  assert.equal(result.publishStatus, "SUCCESS");
  assert.equal(result.ok, true);
  assert.equal(result.knowledgeItemId, draft.proposedKnowledgeItem.id);

  const repo = runtime.getKnowledgeRepository();
  const published = repo.items.find((i) => i.id === draft.proposedKnowledgeItem.id);
  assert.ok(published);
  assert.equal(published.confidence, draft.proposedKnowledgeItem.confidence);

  const brain = new CompanyBrain({ runtime });
  const businessContext = brain.buildBusinessContext({
    employeeId: "emp_1",
    task: "Walkthrough schedule",
    relatedEntities: {
      inquiry: { message: "Need walkthrough today" },
    },
  });

  assert.ok(Array.isArray(businessContext.relevantDocuments));
  assert.equal(businessContext.relevantDocuments[0].question, draft.proposedKnowledgeItem.title);

  assert.ok(result.eventsPublished.length >= 3);
  assert.ok(result.eventsPublished[0].includes("started"));
});

test("Knowledge publishing: INVALID category emits FAILED and does not persist knowledge", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const engine = new KnowledgePublishingEngine({ runtime });
  const nowISO = "2026-07-01T00:00:00.000Z";

  const repoBefore = runtime.getKnowledgeRepository().items;
  const repoLengthBefore = repoBefore.length;

  const draft = makeDraft({ draftId: "draft_fail", nowISO, categoryId: "BOGUS" });

  const result = engine.publishDraft({ draft, nowISO });
  assert.equal(result.publishStatus, "FAILED");
  assert.equal(result.ok, false);

  const repoAfter = runtime.getKnowledgeRepository().items;
  assert.equal(repoAfter.length, repoLengthBefore);

  const activities = runtime.getActivities();
  assert.ok(
    activities.some((a) => a.action === COMPANY_EVENT_TYPES.KNOWLEDGE_PUBLISH_FAILED),
  );

  assert.equal(result.eventsPublished.length, 2); // STARTED + FAILED
});

