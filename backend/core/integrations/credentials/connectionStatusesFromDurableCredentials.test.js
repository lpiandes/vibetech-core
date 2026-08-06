import assert from "node:assert/strict";
import { test } from "node:test";

import {
  connectionStatusesFromCredentials,
  mergeConnectionStatuses,
} from "./connectionStatusesFromDurableCredentials.js";

test("gmail and gcal credential ids map to connection types", () => {
  const statuses = connectionStatusesFromCredentials([
    { credentialId: "cred_gmail_abc", providerType: "gmail" },
    { credentialId: "cred_gcal_abc", providerType: "google_calendar" },
  ]);
  assert.equal(statuses.business_email, "CONNECTED");
  assert.equal(statuses.calendar, "CONNECTED");
});

test("credentials upgrade stale NOT_CONNECTED snapshot and never demote", () => {
  const merged = mergeConnectionStatuses(
    { business_email: "NOT_CONNECTED", calendar: "NOT_CONNECTED", sms_channel: "CONNECTED" },
    { business_email: "CONNECTED", calendar: "CONNECTED" },
  );
  assert.equal(merged.business_email, "CONNECTED");
  assert.equal(merged.calendar, "CONNECTED");
  assert.equal(merged.sms_channel, "CONNECTED");
});

test("stale credential absence does not wipe a live CONNECTED runtime status", () => {
  const merged = mergeConnectionStatuses(
    { business_email: "CONNECTED" },
    {},
  );
  assert.equal(merged.business_email, "CONNECTED");
});
