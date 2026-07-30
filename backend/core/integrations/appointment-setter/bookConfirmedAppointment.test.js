import assert from "node:assert/strict";
import { test } from "node:test";

import { bookConfirmedAppointment, parseSelectedSlot } from "./bookConfirmedAppointment.js";

function makeWorkspace({ connected = false, status = "CONNECTED" } = {}) {
  return {
    connected: {
      integrationPlatform: connected
        ? {
          credentialResolver: {},
          connectionRuntime: {
            getConnectionByType: (type) => (type === "calendar" ? { status, connectionType: "calendar" } : null),
          },
        }
        : {
          connectionRuntime: {
            getConnectionByType: () => null,
            getConnections: () => [],
          },
        },
    },
  };
}

const SLOT = { startISO: "2026-08-01T14:00:00.000Z", endISO: "2026-08-01T14:30:00.000Z", label: "Sat, Aug 1 at 10:00 AM" };

function makeGetWorkspace(workspace) {
  return async () => workspace;
}

test("parseSelectedSlot accepts a rich slot object", () => {
  const parsed = parseSelectedSlot(SLOT);
  assert.equal(parsed.start.toISOString(), SLOT.startISO);
  assert.equal(parsed.label, SLOT.label);
});

test("no calendar connected: ok:true, confirmed:false, honest reason, work still enqueued", async () => {
  const workspace = makeWorkspace({ connected: false });
  const result = await bookConfirmedAppointment({
    businessId: "biz_1",
    name: "Sam",
    phone: "+15551234567",
    slot: SLOT,
    getWorkspace: makeGetWorkspace(workspace),
  });
  assert.equal(result.ok, true);
  assert.equal(result.confirmed, false);
  assert.equal(result.reason, "calendar_not_connected");
  assert.equal(result.event.ok, false);
  assert.ok(result.work);
});

test("calendar connected and create succeeds: ok:true, confirmed:true", async () => {
  const workspace = makeWorkspace({ connected: true, status: "CONNECTED" });
  const adapter = {
    executeAction: async () => ({ status: "completed", externalReference: "evt_123", metadata: { htmlLink: "https://calendar.google.com/evt_123" } }),
  };
  const result = await bookConfirmedAppointment({
    businessId: "biz_1",
    name: "Sam",
    phone: "+15551234567",
    slot: SLOT,
    adapter,
    getWorkspace: makeGetWorkspace(workspace),
  });
  assert.equal(result.ok, true);
  assert.equal(result.confirmed, true);
  assert.equal(result.event.ok, true);
  assert.equal(result.event.externalReference, "evt_123");
});

test("calendar connected but create fails: ok:false (never say confirmed)", async () => {
  const workspace = makeWorkspace({ connected: true, status: "CONNECTED" });
  const adapter = {
    executeAction: async () => ({ status: "failed", error: "calendar_quota_exceeded" }),
  };
  const result = await bookConfirmedAppointment({
    businessId: "biz_1",
    name: "Sam",
    phone: "+15551234567",
    slot: SLOT,
    adapter,
    getWorkspace: makeGetWorkspace(workspace),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "calendar_quota_exceeded");
  assert.equal(result.confirmed, undefined);
});

test("calendar connected but adapter throws: ok:false with error message as reason", async () => {
  const workspace = makeWorkspace({ connected: true, status: "CONNECTED" });
  const adapter = {
    executeAction: async () => { throw new Error("network_timeout"); },
  };
  const result = await bookConfirmedAppointment({
    businessId: "biz_1",
    phone: "+15551234567",
    slot: SLOT,
    adapter,
    getWorkspace: makeGetWorkspace(workspace),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "network_timeout");
});

test("missing slot or workspace loader fails fast without confirming anything", async () => {
  const noSlot = await bookConfirmedAppointment({ businessId: "biz_1", getWorkspace: async () => null });
  assert.equal(noSlot.ok, false);
  assert.equal(noSlot.reason, "slot_required");

  const noLoader = await bookConfirmedAppointment({ businessId: "biz_1", slot: SLOT });
  assert.equal(noLoader.ok, false);
  assert.equal(noLoader.reason, "workspace_loader_missing");
});
