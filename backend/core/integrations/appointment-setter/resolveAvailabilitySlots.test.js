import test from "node:test";
import assert from "node:assert/strict";

import { resolveNextSlots } from "./resolveAvailabilitySlots.js";

function member(id, { weekly, bookable = true, overrides = [] } = {}) {
  return { memberId: id, displayName: id, timezone: null, weekly, overrides, bookable, updatedAt: null };
}

function mondayNineAm() {
  // Find the next Monday (or today if Monday) at 08:00 local time.
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  return date;
}

test("resolveNextSlots only returns slots inside weekday windows", () => {
  const now = mondayNineAm();
  const availability = {
    timezone: "America/New_York",
    members: { a: member("a", { weekly: [{ day: 1, start: "09:00", end: "10:00" }] }) },
  };
  const slots = resolveNextSlots({ availability, count: 5, now, durationMinutes: 30, daysAhead: 0 });
  assert.equal(slots.length, 2, "one hour window at 30 min slots yields 2 slots");
  for (const slot of slots) {
    const start = new Date(slot.startISO);
    assert.equal(start.getDay(), 1);
    assert.equal(slot.memberId, "a");
  }
  assert.equal(new Date(slots[0].startISO).getHours(), 9);
  assert.equal(new Date(slots[0].startISO).getMinutes(), 0);
  assert.equal(new Date(slots[1].startISO).getHours(), 9);
  assert.equal(new Date(slots[1].startISO).getMinutes(), 30);
});

test("resolveNextSlots skips days member is not scheduled (weekends)", () => {
  // Saturday 08:00 — member only works Mon-Fri, so first slot should land on the following Monday.
  const now = mondayNineAm();
  now.setDate(now.getDate() + 5); // Saturday
  const availability = {
    timezone: "America/New_York",
    members: { a: member("a", { weekly: [{ day: 1, start: "09:00", end: "17:00" }] }) },
  };
  const slots = resolveNextSlots({ availability, count: 1, now, durationMinutes: 30 });
  assert.equal(slots.length, 1);
  assert.equal(new Date(slots[0].startISO).getDay(), 1);
});

test("resolveNextSlots subtracts busy intervals", () => {
  const now = mondayNineAm();
  const availability = {
    timezone: "America/New_York",
    members: { a: member("a", { weekly: [{ day: 1, start: "09:00", end: "10:00" }] }) },
  };
  const nineAm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  const nineThirty = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0, 0);
  const busyIntervals = [{ start: nineAm.toISOString(), end: nineThirty.toISOString() }];
  const slots = resolveNextSlots({ availability, count: 5, now, durationMinutes: 30, busyIntervals, daysAhead: 0 });
  assert.equal(slots.length, 1, "the 9:00-9:30 slot is busy, only 9:30 remains");
  assert.equal(new Date(slots[0].startISO).getMinutes(), 30);
});

test("resolveNextSlots respects date overrides (blocked day, and custom windows)", () => {
  const now = mondayNineAm();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const blocked = {
    timezone: "America/New_York",
    members: {
      a: member("a", {
        weekly: [{ day: 1, start: "09:00", end: "17:00" }],
        overrides: [{ date: dateKey, blocked: true }],
      }),
    },
  };
  const slotsBlocked = resolveNextSlots({ availability: blocked, count: 1, now, durationMinutes: 30 });
  assert.equal(new Date(slotsBlocked[0].startISO).getDate() !== now.getDate(), true, "blocked day is skipped entirely");

  const customWindow = {
    timezone: "America/New_York",
    members: {
      a: member("a", {
        weekly: [{ day: 1, start: "09:00", end: "17:00" }],
        overrides: [{ date: dateKey, windows: [{ start: "13:00", end: "14:00" }] }],
      }),
    },
  };
  const slotsCustom = resolveNextSlots({ availability: customWindow, count: 1, now, durationMinutes: 30 });
  assert.equal(new Date(slotsCustom[0].startISO).getHours(), 13);
});

test("resolveNextSlots spreads across multiple bookable members", () => {
  const now = mondayNineAm();
  const weekly = [{ day: 1, start: "09:00", end: "12:00" }];
  const availability = {
    timezone: "America/New_York",
    members: {
      a: member("a", { weekly }),
      b: member("b", { weekly }),
    },
  };
  const slots = resolveNextSlots({ availability, count: 3, now, durationMinutes: 30 });
  assert.equal(slots.length, 3);
  const memberIds = new Set(slots.map((s) => s.memberId));
  assert.ok(memberIds.size >= 2, "slots should be spread across both members, not all from one");
});

test("resolveNextSlots ignores non-bookable members", () => {
  const now = mondayNineAm();
  const availability = {
    timezone: "America/New_York",
    members: {
      a: member("a", { weekly: [{ day: 1, start: "09:00", end: "17:00" }], bookable: false }),
    },
  };
  const slots = resolveNextSlots({ availability, count: 3, now });
  assert.equal(slots.length, 0);
});
