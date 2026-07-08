import assert from "node:assert/strict";
import { test } from "node:test";

import { createEntityRef, ENTITY_TYPES } from "./EntityRef.js";
import { toEntityRef, toEntityRefs, extractEntityIds } from "./EntityRefResolver.js";

test("toEntityRef normalizes single-key bags", () => {
  const ref = toEntityRef({ partyId: "party_1" });
  assert.equal(ref.entityType, ENTITY_TYPES.PARTY);
  assert.equal(ref.entityId, "party_1");
});

test("toEntityRef normalizes string prefixes", () => {
  const ref = toEntityRef("req_abc");
  assert.equal(ref.entityType, ENTITY_TYPES.REQUEST);
  assert.equal(ref.entityId, "req_abc");
});

test("toEntityRef normalizes type/id and sourceReference", () => {
  assert.deepEqual(toEntityRef({ type: "approval", id: "apr_1" }), createEntityRef({ entityType: "approval", entityId: "apr_1" }));
  assert.deepEqual(toEntityRef({ sourceType: "request", sourceId: "req_1" }), createEntityRef({ entityType: "request", entityId: "req_1" }));
});

test("toEntityRefs deduplicates", () => {
  const refs = toEntityRefs([{ partyId: "p1" }, { entityType: "Party", entityId: "p1" }]);
  assert.equal(refs.length, 1);
});

test("extractEntityIds filters by entity type", () => {
  const ids = extractEntityIds([{ requestId: "r1" }, { workItemId: "w1" }], ENTITY_TYPES.REQUEST);
  assert.deepEqual(ids, ["r1"]);
});
