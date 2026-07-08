import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EMPLOYEE_NOT_READY_MESSAGE,
  shouldClearProspectReadinessError,
} from "../../lib/home/prospectInquiryReadiness.js";

test("shouldClearProspectReadinessError clears stale employee-not-ready when coordinator becomes ready", () => {
  assert.equal(shouldClearProspectReadinessError(EMPLOYEE_NOT_READY_MESSAGE, true), true);
});

test("shouldClearProspectReadinessError keeps employee-not-ready while coordinator still blocked", () => {
  assert.equal(shouldClearProspectReadinessError(EMPLOYEE_NOT_READY_MESSAGE, false), false);
});

test("shouldClearProspectReadinessError keeps unrelated errors even when coordinator is ready", () => {
  assert.equal(shouldClearProspectReadinessError("Network error. Please try again.", true), false);
});

test("shouldClearProspectReadinessError ignores null error", () => {
  assert.equal(shouldClearProspectReadinessError(null, true), false);
});
