import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessSubjectRuntime } from "./BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "./BusinessSubjectEventTypes.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("BusinessSubjectRuntime: create, update, archive", () => {
  const runtime = new BusinessSubjectRuntime();
  runtime.applyEvent({
    id: "evt_1",
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: {
        id: "subj_1",
        workspaceId: "ws_a",
        subjectType: "listing",
        displayName: "123 Main St",
        status: "active",
        keyAttributes: { address: "123 Main St" },
        externalReferences: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });

  assert.equal(runtime.getSubjects().length, 1);
  assert.equal(runtime.getSubject("subj_1").displayName, "123 Main St");

  runtime.applyEvent({
    id: "evt_2",
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_UPDATED,
    source: "test",
    payload: { subjectId: "subj_1", patch: { displayName: "123 Main Street" } },
  });
  assert.equal(runtime.getSubject("subj_1").displayName, "123 Main Street");

  runtime.applyEvent({
    id: "evt_3",
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_ARCHIVED,
    source: "test",
    payload: { subjectId: "subj_1" },
  });
  assert.equal(runtime.getSubject("subj_1").status, "archived");
});

test("workspace isolation: distinct runtime instances", () => {
  const a = new BusinessSubjectRuntime();
  const b = new BusinessSubjectRuntime();
  assert.notEqual(a, b);
  assert.equal(a.getSubjects().length, 0);
});
