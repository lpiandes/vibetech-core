import assert from "node:assert/strict";
import { test } from "node:test";

import { formatProductErrorMessage, presentProductError } from "./productErrors.ts";

test("maps stale approval to recovery copy", () => {
  const view = presentProductError({ reason: "stale_approval_specification_hash" });
  assert.match(view.title, /Plan changed/i);
  assert.equal(view.dataSafe, true);
  assert.equal(view.canRetry, true);
  assert.ok(view.supportReferenceId);
  assert.ok(!/stale_approval_specification_hash/.test(view.message));
});

test("maps missing relation to migration guidance", () => {
  const view = presentProductError("relation \"ai_builder_sessions\" does not exist");
  assert.match(view.nextAction, /migration/i);
});

test("never leaks snake_case as the only message", () => {
  const message = formatProductErrorMessage("permission_denied");
  assert.ok(!message.startsWith("permission_denied"));
  assert.match(message, /Ref:/);
});
