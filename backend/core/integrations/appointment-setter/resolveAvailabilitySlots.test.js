import test from "node:test";
import assert from "node:assert/strict";

import { resolveNextSlots } from "./resolveAvailabilitySlots.js";

function member(id, { weekly, bookable = true, overrides = [], timezone = null } = {}) {
  return { memberId: id, displayName: id, timezone, weekly, overrides, bookable, updatedAt: null };
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

test("member timezone (America/New_York) vs UTC server doesn't shift weekday windows incorrectly", () => {
  // `now` is a real instant chosen to be Monday 13:00 UTC, which is Monday
  // 09:00 in America/New_York (EDT, UTC-4) — well inside a 09:00-17:00 window
  // in that timezone but potentially misread as a different weekday/hour if
  // the resolver quietly used server-local time instead of the member's
  // stored IANA timezone.
  let now = new Date(Date.UTC(2026, 6, 27, 13, 0, 0)); // 2026-07-27 is a Monday
  while (now.getUTCDay() !== 1) now = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const availability = {
    timezone: "UTC",
    members: {
      ny: member("ny", { weekly: [{ day: 1, start: "09:00", end: "17:00" }], timezone: "America/New_York" }),
    },
  };

  const slots = resolveNextSlots({ availability, count: 1, now, durationMinutes: 30, daysAhead: 0 });
  assert.equal(slots.length, 1, "09:00 America/New_York window should be open at 13:00 UTC");
  const start = new Date(slots[0].startISO);
  // 09:00 America/New_York (EDT, UTC-4) in late July == 13:00 UTC.
  assert.equal(start.getUTCHours(), 13);
  assert.equal(start.getUTCMinutes(), 0);
  assert.equal(slots[0].timeZone, "America/New_York");
});

test("member timezone conversion is correct across a DST transition (fall back)", () => {
  // 2026-11-01 is the Sunday America/New_York falls back from EDT (UTC-4) to
  // EST (UTC-5). A 09:00 window on the *following* Monday (2026-11-02) should
  // resolve using the post-transition EST offset (UTC-5), not the stale EDT
  // offset — i.e. 09:00 America/New_York == 14:00 UTC that week, not 13:00.
  const now = new Date(Date.UTC(2026, 10, 2, 0, 0, 0)); // 2026-11-02 00:00 UTC (still Sun 8pm EDT)
  const availability = {
    timezone: "America/New_York",
    members: {
      a: member("a", { weekly: [{ day: 1, start: "09:00", end: "10:00" }] }),
    },
  };
  const slots = resolveNextSlots({ availability, count: 1, now, durationMinutes: 30, daysAhead: 1 });
  assert.equal(slots.length, 1);
  const start = new Date(slots[0].startISO);
  assert.equal(start.getUTCHours(), 14, "post-fall-back EST offset (UTC-5) applies to the Monday window");
});
