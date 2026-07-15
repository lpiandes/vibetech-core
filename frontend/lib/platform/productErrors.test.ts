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

test("maps installed_specification_required before generic install failures", () => {
  const view = presentProductError("installed_specification_required");
  assert.match(view.title, /Go live with your business first/i);
  assert.ok(!/Go-live did not finish/i.test(view.title));
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
