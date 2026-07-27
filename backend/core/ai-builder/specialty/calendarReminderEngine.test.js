import test from "node:test";
import assert from "node:assert/strict";

import {
  computeReminderRunAfter,
  enqueueCalendarReminderJobs,
  ensureCalendarReminderEmployee,
  reminderIdempotencyKey,
  EVENT_REMINDER_DUE,
} from "./calendarReminderEngine.js";
import { InMemoryPlatformJobQueue, JOB_TYPES } from "../../platform/jobs/PlatformJobQueue.js";
import { CALENDAR_REMINDER_OFFSETS, markCalendarReminderFired, upsertCalendarEvent, emptyCrmState } from "../../crm/CrmStore.js";
import { resolveOperatingContractSchema } from "../operating-contract/OperatingContractSchemas.js";

test("reminder offsets compute runAfter correctly", () => {
  const start = "2026-07-22T18:00:00.000Z";
  assert.equal(computeReminderRunAfter(start, "24h"), "2026-07-21T18:00:00.000Z");
  assert.equal(computeReminderRunAfter(start, "1h"), "2026-07-22T17:00:00.000Z");
  assert.equal(computeReminderRunAfter(start, "10m"), "2026-07-22T17:50:00.000Z");
});

test("enqueueCalendarReminderJobs skips past windows and dedupes", async () => {
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => "2026-07-21T12:00:00.000Z" });
  const event = {
    id: "evt_practice",
    title: "U12 Practice",
    start: "2026-07-22T18:00:00.000Z",
    visibility: "org",
  };
  const first = await enqueueCalendarReminderJobs({
    queue,
    businessId: "biz_1",
    event,
    nowISO: () => "2026-07-21T12:00:00.000Z",
  });
  assert.equal(first.ok, true);
  // 24h is still in the future from 12:00 (runAfter 18:00 prev day) — wait
  // start 22@18:00, now 21@12:00 → 24h runAfter = 21@18:00 (future), 1h and 10m future
  assert.equal(first.count, 3);
  assert.ok(first.jobs.every((j) => j.jobType === JOB_TYPES.CALENDAR_REMINDER_DUE));

  const second = await enqueueCalendarReminderJobs({
    queue,
    businessId: "biz_1",
    event,
    nowISO: () => "2026-07-21T12:00:00.000Z",
  });
  assert.equal(second.count, 3);
  assert.ok(second.jobs.every((j) => j.deduped === true));
  assert.equal(
    reminderIdempotencyKey({ businessId: "biz_1", eventId: "evt_practice", offset: "24h" }),
    "calendar_reminder:biz_1:evt_practice:24h",
  );
});

test("ensureCalendarReminderEmployee creates ACTIVE calendar reminder AI", () => {
  const { employee, created } = ensureCalendarReminderEmployee({ employees: [], industry: "sports" });
  assert.equal(created, true);
  assert.equal(employee.roleId, "calendar_reminder");
  assert.ok(employee.operatingContract?.trigger?.eventTypes?.includes(EVENT_REMINDER_DUE));
  assert.equal(employee.automationDefinitions?.[0]?.status, "ACTIVE");

  const schema = resolveOperatingContractSchema({ employee, industry: "sports" });
  assert.equal(schema.schemaId, "sports_calendar_reminder");

  const again = ensureCalendarReminderEmployee({ employees: [employee], industry: "sports" });
  assert.equal(again.created, false);
});

test("markCalendarReminderFired tracks offsets on CRM event", () => {
  let crm = emptyCrmState();
  crm = upsertCalendarEvent(crm, {
    id: "evt_1",
    title: "Game",
    start: "2026-07-28T15:00:00.000Z",
    end: "2026-07-28T16:00:00.000Z",
  });
  assert.deepEqual(crm.calendarEvents[0].reminderOffsets, [...CALENDAR_REMINDER_OFFSETS]);
  crm = markCalendarReminderFired(crm, { eventId: "evt_1", offset: "24h" });
  assert.deepEqual(crm.calendarEvents[0].remindersFired, ["24h"]);
});
