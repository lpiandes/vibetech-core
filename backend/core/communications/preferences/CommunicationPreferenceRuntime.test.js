import assert from "node:assert/strict";
import { test } from "node:test";

import { CommunicationPreferenceRuntime } from "./CommunicationPreferenceRuntime.js";
import { PREFERENCE_EVENT_TYPES } from "./CommunicationPreferenceEventTypes.js";
import { checkCommunicationPermitted } from "./CommunicationPreferenceEnforcer.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("CommunicationPreferenceEnforcer blocks opt_out", () => {
  const runtime = new CommunicationPreferenceRuntime();
  runtime.applyEvent({
    id: "evt_1",
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "test",
    payload: {
      preference: {
        id: "pref_1",
        partyId: "party_1",
        workspaceId: "ws_1",
        channel: "sms",
        scope: "all",
        status: "opt_out",
        source: "inbound_reply",
        recordedAt: NOW,
      },
    },
  });

  const result = checkCommunicationPermitted({
    preferenceRuntime: runtime,
    partyId: "party_1",
    channel: "sms",
  });
  assert.equal(result.permitted, false);
  assert.ok(result.reason.includes("opt_out"));
});

test("CommunicationPreferenceEnforcer allows when no preference", () => {
  const runtime = new CommunicationPreferenceRuntime();
  const result = checkCommunicationPermitted({
    preferenceRuntime: runtime,
    partyId: "party_1",
    channel: "email",
  });
  assert.equal(result.permitted, true);
});
