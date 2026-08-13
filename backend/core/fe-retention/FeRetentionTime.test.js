import test from "node:test";
import assert from "node:assert/strict";
import {
  alreadySentOnLocalDate,
  daysUntilBirthday,
  easternDateKey,
  feScheduledSweepDue,
  getZonedParts,
  isAtOrAfterScheduledSendHour,
} from "./FeRetentionTime.js";

test("daily cron 13:00 UTC is the send window in summer (9 AM EDT)", () => {
  const cronTick = new Date("2026-07-15T13:00:00.000Z");
  const parts = getZonedParts(cronTick);
  assert.equal(parts.hour, 9);
  assert.equal(easternDateKey(cronTick), "2026-07-15");
  assert.equal(isAtOrAfterScheduledSendHour(cronTick), true);
  const before = new Date("2026-07-15T12:59:00.000Z");
  assert.equal(isAtOrAfterScheduledSendHour(before), false);
  assert.equal(easternDateKey(before), "2026-07-15");
});

test("daily cron 13:00 UTC is the send window in winter too (8 AM EST)", () => {
  const cronTick = new Date("2026-01-15T13:00:00.000Z");
  assert.equal(getZonedParts(cronTick).hour, 8);
  assert.equal(isAtOrAfterScheduledSendHour(cronTick), true);
  assert.equal(easternDateKey(cronTick), "2026-01-15");
  const beforeCron = new Date("2026-01-15T12:59:00.000Z");
  assert.equal(isAtOrAfterScheduledSendHour(beforeCron), false);
});

test("evening Eastern is still in the send window after UTC midnight", () => {
  // 9 PM EDT July 15 = 01:00 UTC July 16; Eastern date is still July 15.
  const evening = new Date("2026-07-16T01:00:00.000Z");
  assert.equal(easternDateKey(evening), "2026-07-15");
  assert.equal(isAtOrAfterScheduledSendHour(evening), true);
});

test("feScheduledSweepDue is true after cron until a same-day run is recorded", () => {
  const afterCron = new Date("2026-07-15T13:00:00.000Z");
  assert.equal(feScheduledSweepDue(null, afterCron), true);
  assert.equal(feScheduledSweepDue("2026-07-14T13:00:00.000Z", afterCron), true);
  assert.equal(feScheduledSweepDue("2026-07-15T13:01:00.000Z", afterCron), false);
  assert.equal(feScheduledSweepDue(null, new Date("2026-07-15T12:59:00.000Z")), false);
});

test("daysUntilBirthday is 0 on the Eastern calendar day", () => {
  const nineAm = new Date("2026-07-15T13:00:00.000Z");
  assert.equal(daysUntilBirthday("1990-07-15", nineAm), 0);
  assert.equal(daysUntilBirthday("07-15", nineAm), 0);
});

test("alreadySentOnLocalDate uses Eastern date of log timestamp", () => {
  const log = [{
    clientId: "c1",
    kind: "birthday",
    ok: true,
    at: "2026-07-15T13:05:00.000Z",
  }];
  assert.equal(
    alreadySentOnLocalDate(log, { clientId: "c1", kind: "birthday", dateKey: "2026-07-15" }),
    true,
  );
  assert.equal(
    alreadySentOnLocalDate(log, { clientId: "c1", kind: "birthday", dateKey: "2026-07-14" }),
    false,
  );
});
