import assert from "node:assert/strict";
import { test } from "node:test";

import { channelPermissionLabel } from "./relationshipFollowUpDraftSemantics.ts";

test("relationship follow-up draft channel labels describe preference blocking, not send readiness", () => {
  assert.equal(channelPermissionLabel({ permitted: true }), "not blocked");
  assert.equal(channelPermissionLabel({ permitted: false, reason: "communication_not_permitted:opt_out" }), "blocked (communication_not_permitted:opt_out)");
  assert.equal(channelPermissionLabel({ permitted: false, reason: "communication_not_permitted:suppressed" }), "blocked (communication_not_permitted:suppressed)");
  assert.equal(channelPermissionLabel(null), "blocked (not permitted)");
});
