import assert from "node:assert/strict";
import { test } from "node:test";

import { searchWorkspace } from "./WorkspaceSearchProjection.js";

test("searchWorkspace scopes hrefs to business routes", () => {
  const ctx = {
    businessGraphRuntime: {
      getParties: () => [{ id: "party_1", displayName: "Alex Morgan" }],
    },
    businessSubjectRuntime: {
      getSubjects: () => [
        { id: "subj_1", displayName: "Oak Street", subjectType: "listing" },
        { id: "subj_2", displayName: "Vendor Hub", subjectType: "vendor" },
      ],
    },
    workRuntime: {
      getWorkItems: () => [{ id: "work_1", title: "Showing coordination", workType: "showing_coordination" }],
    },
  };

  const { results } = searchWorkspace({
    query: "oak",
    ctx,
    businessId: "biz_123",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].href, "/b/biz_123/properties/subj_1");
});

test("searchWorkspace returns business-scoped party and work links", () => {
  const ctx = {
    businessGraphRuntime: {
      getParties: () => [{ id: "party_1", displayName: "Jamie Lee" }],
    },
    businessSubjectRuntime: { getSubjects: () => [] },
    workRuntime: {
      getWorkItems: () => [{ id: "work_1", title: "Follow up Jamie", workType: "prospect_follow_up" }],
    },
  };

  const party = searchWorkspace({ query: "jamie", ctx, businessId: "biz_abc" }).results.find((r) => r.type === "party");
  const work = searchWorkspace({ query: "follow", ctx, businessId: "biz_abc" }).results.find((r) => r.type === "work");

  assert.equal(party?.href, "/b/biz_abc/people");
  assert.equal(work?.href, "/b/biz_abc/work");
});
