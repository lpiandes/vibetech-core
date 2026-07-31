import test from "node:test";
import assert from "node:assert/strict";

import { zonedTimeToUtc, civilDateInTimeZone, addCivilDays, resolveTimeZone } from "./timezone.js";

test("resolveTimeZone picks the first valid IANA candidate", () => {
  assert.equal(resolveTimeZone("America/New_York"), "America/New_York");
  assert.equal(resolveTimeZone(null, "America/Chicago"), "America/Chicago");
  assert.equal(resolveTimeZone("Not/AZone", "America/Denver"), "America/Denver");
});

test("resolveTimeZone falls back to America/New_York, then UTC", () => {
  assert.equal(resolveTimeZone(null, undefined, ""), "America/New_York");
  assert.equal(resolveTimeZone("bogus/zone"), "America/New_York");
});

test("zonedTimeToUtc converts EDT (summer) civil time correctly", () => {
  // 2026-07-27 09:00 America/New_York is EDT (UTC-4) => 13:00 UTC.
  const ms = zonedTimeToUtc({ timeZone: "America/New_York", year: 2026, month: 7, day: 27, hour: 9, minute: 0 });
  const d = new Date(ms);
  assert.equal(d.getUTCHours(), 13);
  assert.equal(d.getUTCMinutes(), 0);
});

test("zonedTimeToUtc converts EST (winter) civil time correctly", () => {
  // 2026-01-15 09:00 America/New_York is EST (UTC-5) => 14:00 UTC.
  const ms = zonedTimeToUtc({ timeZone: "America/New_York", year: 2026, month: 1, day: 15, hour: 9, minute: 0 });
  const d = new Date(ms);
  assert.equal(d.getUTCHours(), 14);
  assert.equal(d.getUTCMinutes(), 0);
});

test("zonedTimeToUtc handles the spring-forward DST gap (2026-03-08 America/New_York)", () => {
  // At 2:00am local, clocks jump to 3:00am (EST -> EDT). A nominal 02:30 civil
  // time doesn't really exist that day; this should still resolve to a
  // sane, monotonic instant rather than throwing or silently wrapping.
  const beforeMs = zonedTimeToUtc({ timeZone: "America/New_York", year: 2026, month: 3, day: 8, hour: 1, minute: 0 });
  const gapMs = zonedTimeToUtc({ timeZone: "America/New_York", year: 2026, month: 3, day: 8, hour: 2, minute: 30 });
  const afterMs = zonedTimeToUtc({ timeZone: "America/New_York", year: 2026, month: 3, day: 8, hour: 3, minute: 30 });
  assert.ok(beforeMs < gapMs);
  assert.ok(gapMs <= afterMs);
});

test("zonedTimeToUtc handles the fall-back DST overlap (2026-11-01 America/New_York)", () => {
  // Clocks fall back from EDT to EST at 2:00am -> 1:00am. 09:00 the same day
  // is unambiguous and after the transition (EST, UTC-5) => 14:00 UTC.
  const ms = zonedTimeToUtc({ timeZone: "America/New_York", year: 2026, month: 11, day: 1, hour: 9, minute: 0 });
  const d = new Date(ms);
  assert.equal(d.getUTCHours(), 14);
});

test("zonedTimeToUtc treats UTC as a no-op offset", () => {
  const ms = zonedTimeToUtc({ timeZone: "UTC", year: 2026, month: 7, day: 27, hour: 9, minute: 30 });
  assert.equal(ms, Date.UTC(2026, 6, 27, 9, 30));
});

test("civilDateInTimeZone reports the correct calendar day even when it differs from UTC's", () => {
  // 2026-07-27 02:00 UTC is still 2026-07-26 22:00 in America/New_York (EDT).
  const instant = new Date(Date.UTC(2026, 6, 27, 2, 0, 0));
  const civil = civilDateInTimeZone(instant, "America/New_York");
  assert.equal(civil.year, 2026);
  assert.equal(civil.month, 7);
  assert.equal(civil.day, 26);
  assert.equal(civil.hour, 22);
  assert.equal(civil.dayOfWeek, 0); // Sunday
});

test("addCivilDays performs pure calendar arithmetic across a DST boundary", () => {
  const next = addCivilDays({ year: 2026, month: 11, day: 1 }, 1);
  assert.deepEqual(next, { year: 2026, month: 11, day: 2, dayOfWeek: 1 });
});
