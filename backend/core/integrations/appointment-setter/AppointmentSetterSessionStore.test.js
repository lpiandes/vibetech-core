import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePhone,
  getSession,
  upsertSession,
  clearSession,
  readAppointmentSetterSessionsState,
  writeAppointmentSetterSessionsState,
  getDurableSession,
  upsertDurableSession,
} from "./AppointmentSetterSessionStore.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_biz_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: {},
    ...overrides,
  };
}

function makePlatformStore(installation) {
  return {
    async getBusinessOSInstallation() {
      return installation;
    },
    async upsertBusinessOSInstallation(row) {
      installation.configuration = row.configuration;
      return row;
    },
  };
}

test("normalizePhone handles 10-digit and international formats", () => {
  assert.equal(normalizePhone("(555) 123-4567"), "+15551234567");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone(""), "");
});

test("sync in-memory session helpers still work for unit tests", () => {
  clearSession({ businessId: "sync_biz", phone: "5551230000" });
  assert.equal(getSession({ businessId: "sync_biz", phone: "5551230000" }), null);
  const created = upsertSession({ businessId: "sync_biz", phone: "5551230000", name: "Sam", stage: "qualify" });
  assert.equal(created.phone, "+15551230000");
  assert.equal(created.stage, "qualify");
  const updated = upsertSession({ businessId: "sync_biz", phone: "5551230000", stage: "offer", answers: { need: "coverage" } });
  assert.equal(updated.stage, "offer");
  assert.equal(updated.answers.need, "coverage");
  assert.equal(getSession({ businessId: "sync_biz", phone: "5551230000" }).stage, "offer");
});

test("durable session roundtrip: upsert then read back from installation", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const created = await upsertDurableSession({
    platformStore,
    businessId: "biz_1",
    phone: "5559990000",
    name: "Jamie",
    stage: "qualify",
    answers: { source: "meta_lead_ads" },
    actorId: "test",
  });
  assert.equal(created.phone, "+15559990000");
  assert.equal(created.stage, "qualify");
  assert.ok(installation.configuration.appointmentSetterSessions, "session state should be persisted onto installation.configuration");

  const state = readAppointmentSetterSessionsState(installation);
  assert.equal(Object.keys(state.byKey).length, 1);
  const key = Object.keys(state.byKey)[0];
  assert.equal(key, "biz_1:+15559990000");

  const read = await getDurableSession({ platformStore, businessId: "biz_1", phone: "5559990000" });
  assert.equal(read.name, "Jamie");
  assert.equal(read.stage, "qualify");

  const updated = await upsertDurableSession({
    platformStore,
    businessId: "biz_1",
    phone: "5559990000",
    stage: "confirm",
    selectedSlot: { startISO: "2026-08-03T14:00:00.000Z", label: "Mon Aug 3 at 10:00 AM" },
    actorId: "test",
  });
  assert.equal(updated.stage, "confirm");
  assert.equal(updated.selectedSlot.label, "Mon Aug 3 at 10:00 AM");

  const readAgain = await getDurableSession({ platformStore, businessId: "biz_1", phone: "5559990000" });
  assert.equal(readAgain.stage, "confirm");
  assert.equal(readAgain.name, "Jamie", "prior fields survive a partial patch");
});

test("writeAppointmentSetterSessionsState prunes old and stale terminal sessions", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const now = Date.now();
  const veryOld = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(); // > 30 days
  const oldBooked = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(); // > 14 days, booked
  const recentBooked = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  const recentActive = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

  await writeAppointmentSetterSessionsState({
    platformStore,
    installation,
    state: {
      byKey: {
        "biz_1:+15550000001": { businessId: "biz_1", phone: "+15550000001", stage: "offer", updatedAt: veryOld },
        "biz_1:+15550000002": { businessId: "biz_1", phone: "+15550000002", stage: "booked", updatedAt: oldBooked },
        "biz_1:+15550000003": { businessId: "biz_1", phone: "+15550000003", stage: "booked", updatedAt: recentBooked },
        "biz_1:+15550000004": { businessId: "biz_1", phone: "+15550000004", stage: "offer", updatedAt: recentActive },
      },
    },
  });

  const state = readAppointmentSetterSessionsState(installation);
  const keys = Object.keys(state.byKey);
  assert.equal(keys.includes("biz_1:+15550000001"), false, "sessions older than 30 days are pruned");
  assert.equal(keys.includes("biz_1:+15550000002"), false, "booked/closed sessions older than 14 days are pruned");
  assert.equal(keys.includes("biz_1:+15550000003"), true, "recent booked sessions are kept");
  assert.equal(keys.includes("biz_1:+15550000004"), true, "recent active sessions are kept");
});
