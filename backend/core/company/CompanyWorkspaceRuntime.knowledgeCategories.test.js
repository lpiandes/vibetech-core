import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "./CompanyWorkspaceRuntime.js";
import { createCompanyEvent } from "./events/CompanyEvent.js";
import { COMPANY_EVENT_TYPES } from "./events/CompanyEventTypes.js";

test("Runtime: seeded knowledgeCategories exist and are frozen", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const categories = runtime.getKnowledgeCategories();
  assert.ok(categories);
  assert.ok(Array.isArray(categories.items));
  assert.equal(categories.items.length, 14);

  const faq = categories.items.find((c) => c.id === "FAQ");
  assert.ok(faq);
  assert.ok(Object.isFrozen(faq));
});

test("Runtime: CATEGORY_CREATED and CATEGORY_ARCHIVED update runtime via events", () => {
  const runtime = new CompanyWorkspaceRuntime();

  runtime.applyEvent(
    createCompanyEvent({
      id: "evt_cat_create_1",
      timestampISO: "2026-06-25T01:00:00.000Z",
      type: COMPANY_EVENT_TYPES.CATEGORY_CREATED,
      source: "test",
      payload: {
        id: "CAT_TEST_1",
        name: "Test Cat 1",
        description: "desc",
        icon: "",
        color: "",
        sortOrder: 999,
        parentCategory: null,
        childCategories: [],
        defaultTags: ["test"],
        searchable: true,
        editable: true,
        version: 1,
        status: "ACTIVE",
        visibility: "INTERNAL",
        createdAt: "2026-06-25T01:00:00.000Z",
        updatedAt: "2026-06-25T01:00:00.000Z",
        createdBy: "tester",
        updatedBy: "tester",
        metadata: { test: true },
      },
    }),
  );

  const afterCreate = runtime.getKnowledgeCategories();
  const created = afterCreate.items.find((c) => c.id === "CAT_TEST_1");
  assert.ok(created);
  assert.equal(created.status, "ACTIVE");

  runtime.applyEvent(
    createCompanyEvent({
      id: "evt_cat_archive_1",
      timestampISO: "2026-06-26T01:00:00.000Z",
      type: COMPANY_EVENT_TYPES.CATEGORY_ARCHIVED,
      source: "test",
      payload: {
        id: "CAT_TEST_1",
        updatedAt: "2026-06-26T01:00:00.000Z",
        updatedBy: "tester2",
      },
    }),
  );

  const afterArchive = runtime.getKnowledgeCategories();
  const archived = afterArchive.items.find((c) => c.id === "CAT_TEST_1");
  assert.ok(archived);
  assert.equal(archived.status, "ARCHIVED");
});

test("Runtime: knowledge item creation rejects invalid category id (repository validation)", () => {
  const runtime = new CompanyWorkspaceRuntime();
  assert.throws(() => {
    runtime.createKnowledgeItem({
      id: "kn_invalid_cat",
      title: "Bad",
      description: "Bad",
      category: "NOT_A_REAL_CATEGORY",
      tags: ["x"],
      relationships: [],
      createdAt: "2026-06-25T00:00:00.000Z",
      updatedAt: "2026-06-25T00:00:00.000Z",
      createdBy: "tester",
      updatedBy: "tester",
      visibility: "INTERNAL",
      status: "ACTIVE",
      source: "test",
      confidence: 0.8,
      priority: "Medium",
      industry: runtime.getCompany().industry,
      applicableEmployees: runtime.getEmployees().map((e) => e.employeeId),
      searchKeywords: ["bad", "category"],
      metadata: {},
    });
  }, /invalid category/i);
});

