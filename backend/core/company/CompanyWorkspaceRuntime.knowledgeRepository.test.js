import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "./CompanyWorkspaceRuntime.js";
import { createCompanyEvent } from "./events/CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "./events/CompanyEventTypes.js";

test("Runtime: seeded knowledge repository preserves legacy getKnowledge() contract", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const k = runtime.getKnowledge();

  assert.equal(k.faqs.length, 2);
  assert.equal(k.faqs[0].question, "How quickly do you respond to inquiries?");
  assert.equal(
    k.faqs[0].answer,
    "Draft responses are typically prepared within the same day window.",
  );
  assert.equal(k.listingPolicies.length, 2);
  assert.equal(k.listingPolicies[0], "Keep responses professional and structured.");
  assert.equal(k.responsePreferences.length, 2);
  assert.equal(k.responsePreferences[0], "Use calm, confident language.");
  assert.equal(k.brandVoice, "Premium, calm, and confident guidance.");
  assert.equal(k.propertyShowingRules.length, 2);
  assert.equal(
    k.propertyShowingRules[0],
    "Confirm preferred walkthrough windows before proposing times.",
  );
});

test("Runtime: event integration updates repository via KNOWLEDGE_CREATED + KNOWLEDGE_REVISION_CREATED + KNOWLEDGE_ARCHIVED", () => {
  const runtime = new CompanyWorkspaceRuntime();

  const createdAtISO = "2026-06-25T00:00:00.000Z";
  const updatedAt1ISO = "2026-06-26T00:00:00.000Z";
  const updatedAt2ISO = "2026-06-27T00:00:00.000Z";

  runtime.applyEvent(
    createCompanyEvent({
      id: "evt_kn_created_1",
      timestampISO: "2026-06-25T01:00:00.000Z",
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_CREATED,
      source: "test",
      payload: {
        id: "kn_test_event_1",
        title: "Test FAQ",
        description: "Test answer v1",
        category: "FAQ",
        tags: ["faq"],
        relationships: [],
        createdAt: createdAtISO,
        updatedAt: updatedAt1ISO,
        createdBy: "tester",
        updatedBy: "tester",
        visibility: "INTERNAL",
        status: "ACTIVE",
        source: "test",
        confidence: 0.8,
        priority: "Medium",
        industry: runtime.getCompany().industry,
        applicableEmployees: runtime.getEmployees().map((e) => e.employeeId),
        searchKeywords: ["test", "faq", "answer", "v1"],
        metadata: { test: true },
      },
    }),
  );

  const repo1 = runtime.getKnowledgeRepository();
  const createdItem = repo1.items.find((i) => i.id === "kn_test_event_1");
  assert.ok(createdItem);
  assert.equal(createdItem.version, 1);
  assert.equal(createdItem.description, "Test answer v1");

  // Legacy compatibility should now include this FAQ.
  const legacy1 = runtime.getKnowledge();
  const legacyFaq = legacy1.faqs.find((f) => f.question === "Test FAQ");
  assert.ok(legacyFaq);
  assert.equal(legacyFaq.answer, "Test answer v1");

  // Revision update.
  runtime.applyEvent(
    createCompanyEvent({
      id: "evt_kn_revision_1",
      timestampISO: "2026-06-26T01:00:00.000Z",
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_REVISION_CREATED,
      source: "test",
      payload: {
        id: "kn_test_event_1",
        description: "Test answer v2",
        updatedAt: updatedAt2ISO,
        updatedBy: "tester2",
      },
    }),
  );

  const repo2 = runtime.getKnowledgeRepository();
  const revised = repo2.items.find((i) => i.id === "kn_test_event_1");
  assert.equal(revised.version, 2);
  assert.equal(revised.description, "Test answer v2");
  assert.equal(revised.revisionHistory.length, 1);
  assert.equal(revised.revisionHistory[0].version, 1);
  assert.equal(revised.revisionHistory[0].description, "Test answer v1");

  // Archive.
  runtime.applyEvent(
    createCompanyEvent({
      id: "evt_kn_archive_1",
      timestampISO: "2026-06-27T01:00:00.000Z",
      type: COMPANY_EVENT_TYPES.KNOWLEDGE_ARCHIVED,
      source: "test",
      payload: {
        id: "kn_test_event_1",
        updatedAt: "2026-06-28T00:00:00.000Z",
        updatedBy: "tester3",
      },
    }),
  );

  const repo3 = runtime.getKnowledgeRepository();
  const archived = repo3.items.find((i) => i.id === "kn_test_event_1");
  assert.equal(archived.status, "ARCHIVED");
  const legacy3 = runtime.getKnowledge();
  const legacyFaq3 = legacy3.faqs.find((f) => f.question === "Test FAQ");
  assert.equal(legacyFaq3, undefined);
});

