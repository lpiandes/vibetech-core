import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldFillIfEmpty, namesConflictMaterially } from "./ImportMergePolicy.js";

test("shouldFillIfEmpty fills blank display names", () => {
  assert.equal(shouldFillIfEmpty("", "Jane Doe"), true);
  assert.equal(shouldFillIfEmpty("Jane Doe", "John Doe"), false);
});

test("namesConflictMaterially detects different names", () => {
  assert.equal(namesConflictMaterially("Jane Doe", "John Smith"), true);
  assert.equal(namesConflictMaterially("Jane", "Jane Doe"), false);
});
