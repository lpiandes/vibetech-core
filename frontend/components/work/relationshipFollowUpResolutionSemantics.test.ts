import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allowedRelationshipFollowUpOutcomes,
  isResolvableRelationshipFollowUpWork,
  outcomeAllowsQualificationUpdates,
  outcomeRequiresNextFollowUpAt,
} from "./relationshipFollowUpResolutionSemantics.ts";

test("relationship follow-up resolution semantics identify active relationship follow-up work", () => {
  assert.equal(
    isResolvableRelationshipFollowUpWork({
      id: "work_1",
      status: "new",
      metadata: { relationshipFollowUp: { candidateId: "c1", relationshipType: "BUYER", ruleId: "r1" } },
    }),
    true,
  );
  assert.equal(
    isResolvableRelationshipFollowUpWork({
      id: "work_1",
      status: "completed",
      metadata: { relationshipFollowUp: { candidateId: "c1", relationshipType: "BUYER", ruleId: "r1" } },
    }),
    false,
  );
  assert.equal(isResolvableRelationshipFollowUpWork({ id: "work_2", status: "new", metadata: {} }), false);
});

test("relationship follow-up resolution semantics filter package outcomes by relationship type", () => {
  const outcomes = [
    { id: "reached_still_interested", applicableRelationshipTypes: ["BUYER"], displayName: "Reached" },
    { id: "showing_requested", applicableRelationshipTypes: ["PROSPECT"], displayName: "Showing" },
    { id: "follow_up_later", applicableRelationshipTypes: ["BUYER"], displayName: "Later", requiresNextFollowUpAt: true },
    { id: "qualification_updated", applicableRelationshipTypes: ["BUYER"], displayName: "Qualified", allowsQualificationUpdates: true },
  ];
  const allowed = allowedRelationshipFollowUpOutcomes({ outcomes, relationshipType: "BUYER" });
  assert.deepEqual(allowed.map((outcome) => outcome.id), ["reached_still_interested", "follow_up_later", "qualification_updated"]);
  assert.equal(outcomeRequiresNextFollowUpAt(allowed[1]), true);
  assert.equal(outcomeAllowsQualificationUpdates(allowed[2]), true);
});
