import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceCalendarHoldParams,
  enqueueVoiceCalendarHold,
} from "./enqueueVoiceCalendarHold.js";

test("hold params create tomorrow slot titled HOLD", () => {
  const params = buildVoiceCalendarHoldParams({
    from: "+15551212",
    speech: "Book tomorrow",
    nowMs: Date.parse("2026-07-26T15:00:00.000Z"),
  });
  assert.match(params.summary, /HOLD/);
  assert.match(params.summary, /\+15551212/);
  assert.ok(params.start.dateTime);
  assert.ok(params.end.dateTime);
});

test("enqueue skips when calendar not connected", async () => {
  const result = await enqueueVoiceCalendarHold({
    businessId: "biz",
    getWorkspace: async () => ({
      connected: {
        integrationPlatform: {
          connectionRuntime: {
            getConnectionByType: () => null,
            getConnections: () => [],
          },
          credentialResolver: {},
        },
      },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "calendar_not_connected");
});

test("enqueue creates HOLD when calendar connected", async () => {
  const result = await enqueueVoiceCalendarHold({
    businessId: "biz",
    from: "+1",
    speech: "book",
    getWorkspace: async () => ({
      connected: {
        integrationPlatform: {
          connectionRuntime: {
            getConnectionByType: () => ({ id: "cal", status: "CONNECTED", connectionType: "calendar" }),
            getConnections: () => [],
          },
          credentialResolver: { resolve: async () => ({}) },
        },
      },
    }),
    adapter: {
      executeAction: async () => ({
        status: "completed",
        externalReference: "evt_1",
        metadata: { htmlLink: "https://calendar.google.com/x" },
      }),
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.externalReference, "evt_1");
});
