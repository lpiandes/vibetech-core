import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyCredentialStatusesToConnectionRows,
  connectionStatusesFromCredentials,
  credentialRowImpliesConnected,
  mergeConnectionStatuses,
} from "./connectionStatusesFromDurableCredentials.js";

test("gmail and gcal credential ids map to connection types when secrets exist", () => {
  const statuses = connectionStatusesFromCredentials([
    { credentialId: "cred_gmail_abc", providerType: "gmail", secrets: { refreshToken: "r" }, metadata: { senderEmail: "a@b.com" } },
    { credentialId: "cred_gcal_abc", providerType: "google_calendar", secrets: { refreshToken: "r" } },
    { credentialId: "cred_hubspot_abc", providerType: "hubspot", secrets: { accessToken: "pat-xx" } },
    { credentialId: "cred_twilio_voice_abc", providerType: "twilio_voice", secrets: { accountSid: "AC", authToken: "t", fromNumber: "+1" } },
  ]);
  assert.equal(statuses.business_email, "CONNECTED");
  assert.equal(statuses.calendar, "CONNECTED");
  assert.equal(statuses.hubspot, "CONNECTED");
  assert.equal(statuses.voice_channel, "CONNECTED");
});

test("meta request-setup stub without page token is not Connected", () => {
  assert.equal(credentialRowImpliesConnected({
    credentialId: "cred_meta_abc",
    providerType: "meta_lead_ads",
    secrets: {},
    metadata: { pageName: "Acme" },
  }), false);
  assert.equal(credentialRowImpliesConnected({
    credentialId: "cred_meta_abc",
    providerType: "meta_lead_ads",
    secrets: { pageId: "123", pageAccessToken: "EAAG" },
  }), true);
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

test("applyCredentialStatusesToConnectionRows overlays Connected for Integrations UI", () => {
  const rows = applyCredentialStatusesToConnectionRows(
    [{ id: "voice_channel", status: "NOT_CONNECTED" }, { id: "hubspot", status: "NOT_CONNECTED" }],
    { voice_channel: "CONNECTED" },
  );
  assert.equal(rows[0].status, "CONNECTED");
  assert.equal(rows[1].status, "NOT_CONNECTED");
});
