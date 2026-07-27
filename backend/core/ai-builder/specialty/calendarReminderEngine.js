/**
 * Calendar reminder automation — schedules 24h / 1h / 10m jobs before org events.
 * Fired reminders become EVENT_REMINDER_DUE specialty drafts for the Calendar Reminder AI.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { JOB_TYPES } from "../../platform/jobs/PlatformJobQueue.js";
import {
  CALENDAR_REMINDER_OFFSETS,
  markCalendarReminderFired,
  readCrmState,
  writeCrmState,
} from "../../crm/CrmStore.js";
import { buildOperatingContract } from "../operating-contract/buildOperatingContract.js";
import { buildDefaultAutomationPath } from "../operating-contract/automationPath.js";

export const CALENDAR_REMINDER_EMPLOYEE_ID = "emp_calendar_reminder";
export const CALENDAR_REMINDER_ROLE_ID = "calendar_reminder";
export const EVENT_REMINDER_DUE = "EVENT_REMINDER_DUE";

export function offsetMs(offset) {
  const key = String(offset ?? "");
  if (key === "24h") return 24 * 60 * 60 * 1000;
  if (key === "1h") return 60 * 60 * 1000;
  if (key === "10m") return 10 * 60 * 1000;
  return null;
}

export function computeReminderRunAfter(eventStartISO, offset) {
  const startMs = Date.parse(String(eventStartISO ?? ""));
  const ms = offsetMs(offset);
  if (!Number.isFinite(startMs) || ms == null) return null;
  return new Date(startMs - ms).toISOString();
}

export function reminderIdempotencyKey({ businessId, eventId, offset }) {
  return `calendar_reminder:${businessId}:${eventId}:${offset}`;
}

export function findCalendarReminderEmployee(employees = []) {
  const list = Array.isArray(employees) ? employees : [];
  return (
    list.find((e) => String(e.employeeId ?? e.id) === CALENDAR_REMINDER_EMPLOYEE_ID)
    || list.find((e) => String(e.roleId ?? "") === CALENDAR_REMINDER_ROLE_ID)
    || list.find((e) => /calendar\s*remind/i.test(String(e.label ?? e.name ?? "")))
    || null
  );
}

/**
 * Ensure a Calendar Reminder AI teammate exists on the installation.
 * Returns { employee, employees, created }.
 */
export function ensureCalendarReminderEmployee({
  employees = [],
  industry = "sports",
} = {}) {
  const list = Array.isArray(employees) ? [...employees] : [];
  const existing = findCalendarReminderEmployee(list);
  if (existing) {
    return { employee: existing, employees: list, created: false };
  }

  const seed = {
    employeeId: CALENDAR_REMINDER_EMPLOYEE_ID,
    id: CALENDAR_REMINDER_EMPLOYEE_ID,
    roleId: CALENDAR_REMINDER_ROLE_ID,
    archetypeId: "communications_specialist",
    label: "Calendar Reminder",
    name: "Calendar Reminder",
    purpose:
      "Notify everyone who can see a club calendar event 24 hours, 1 hour, and 10 minutes before it starts — drafts for approval first.",
  };
  const built = buildOperatingContract({ employee: seed, industry });
  const path = buildDefaultAutomationPath({
    contract: {
      ...built.contract,
      scope: {
        ...(built.contract?.scope ?? {}),
        answers: {
          audience: { value: "Everyone with calendar access (org + team)" },
          when: { value: "24 hours, 1 hour, and 10 minutes before each org event" },
          where: { value: "Email, in-app team notify" },
          howMany: { value: "3 reminders per event (24h / 1h / 10m)" },
          constraints: {
            value: "Never silent-send customer/family messages; owner approves outbound. Team notify for staff is allowed.",
          },
        },
      },
      trigger: {
        ...(built.contract?.trigger ?? {}),
        mode: "events",
        eventTypes: [EVENT_REMINDER_DUE, "SCHEDULE_CHANGE", "EVENT_UPDATE"],
        summary: "When a club calendar event is approaching (24h / 1h / 10m) or schedule changes.",
      },
      executes: {
        workTypes: ["calendar_reminder_draft", "schedule_update_draft"],
        summary: "Drafts calendar reminders for people who can see the event; outbound stays approval-gated.",
      },
    },
    schema: built.schema,
  });

  // Enable notify_team for staff reminders by default
  const steps = (path.steps ?? []).map((s) => {
    if (s.type === "notify_team") {
      return {
        ...s,
        enabled: true,
        subject: "Calendar reminder",
        body: "Upcoming club event — see Work for the draft.",
      };
    }
    if (s.type === "send_email") {
      return {
        ...s,
        enabled: true,
        subject: "Reminder: upcoming club event",
        body: "",
        requiresApproval: true,
      };
    }
    return s;
  });

  const employee = {
    ...seed,
    operatingContract: {
      ...built.contract,
      schemaId: built.schema?.schemaId ?? "sports_calendar_reminder",
      trigger: {
        mode: "events",
        eventTypes: [EVENT_REMINDER_DUE, "SCHEDULE_CHANGE", "EVENT_UPDATE"],
        schedule: null,
        summary: "When a club calendar event is approaching (24h / 1h / 10m) or schedule changes.",
      },
      executes: {
        workTypes: ["calendar_reminder_draft", "schedule_update_draft"],
        summary: "Drafts calendar reminders for people who can see the event; outbound stays approval-gated.",
      },
      scope: {
        ...(built.contract?.scope ?? {}),
        answers: {
          audience: { value: "Everyone with calendar access (org + team)" },
          when: { value: "24 hours, 1 hour, and 10 minutes before each org event" },
          where: { value: "Email, in-app team notify" },
          howMany: { value: "3 reminders per event (24h / 1h / 10m)" },
          constraints: {
            value: "Never silent-send customer/family messages; owner approves outbound.",
          },
        },
      },
      automationPath: { version: 1, steps },
    },
    automationDefinitions: [
      {
        automationId: `auto_contract_${CALENDAR_REMINDER_EMPLOYEE_ID}`,
        employeeId: CALENDAR_REMINDER_EMPLOYEE_ID,
        status: "ACTIVE",
        metadata: { fromOperatingContract: true, employeeId: CALENDAR_REMINDER_EMPLOYEE_ID },
      },
    ],
  };

  list.push(employee);
  return { employee, employees: list, created: true };
}

/**
 * Enqueue 24h / 1h / 10m reminder jobs for an org calendar event.
 * Skips offsets whose runAfter is already in the past.
 */
export async function enqueueCalendarReminderJobs({
  queue,
  businessId,
  event,
  employeeId = CALENDAR_REMINDER_EMPLOYEE_ID,
  nowISO = () => new Date().toISOString(),
  offsets = CALENDAR_REMINDER_OFFSETS,
} = {}) {
  if (!queue?.enqueue) {
    return deepFreeze({ ok: false, reason: "queue_required", jobs: [] });
  }
  const eventId = String(event?.id ?? "").trim();
  const start = String(event?.start ?? "").trim();
  if (!eventId || !start) {
    return deepFreeze({ ok: false, reason: "event_incomplete", jobs: [] });
  }

  const now = typeof nowISO === "function" ? nowISO() : String(nowISO);
  const jobs = [];
  for (const offset of offsets) {
    const runAfter = computeReminderRunAfter(start, offset);
    if (!runAfter) continue;
    if (String(runAfter) <= String(now)) continue; // already past this window
    const job = await queue.enqueue({
      businessId: String(businessId),
      jobType: JOB_TYPES.CALENDAR_REMINDER_DUE,
      idempotencyKey: reminderIdempotencyKey({ businessId, eventId, offset }),
      runAfter,
      payload: {
        eventId,
        offset,
        employeeId: String(employeeId),
        eventTitle: String(event.title ?? "Event"),
        eventStart: start,
        visibility: String(event.visibility ?? "org"),
      },
    });
    jobs.push(job);
  }
  return deepFreeze({ ok: true, jobs, count: jobs.length });
}

/**
 * Cancel pending reminder jobs for an event, then enqueue fresh ones (edit/reschedule).
 */
export async function rescheduleCalendarReminderJobs({
  queue,
  businessId,
  event,
  employeeId = CALENDAR_REMINDER_EMPLOYEE_ID,
  nowISO = () => new Date().toISOString(),
  offsets = CALENDAR_REMINDER_OFFSETS,
} = {}) {
  const eventId = String(event?.id ?? "").trim();
  let cancelled = { cancelled: 0 };
  if (queue?.cancelPendingByIdempotencyPrefix && eventId) {
    cancelled = await queue.cancelPendingByIdempotencyPrefix({
      businessId: String(businessId),
      jobType: JOB_TYPES.CALENDAR_REMINDER_DUE,
      idempotencyPrefix: `calendar_reminder:${businessId}:${eventId}:`,
    });
  }
  const enqueued = await enqueueCalendarReminderJobs({
    queue,
    businessId,
    event,
    employeeId,
    nowISO,
    offsets,
  });
  return deepFreeze({
    ok: enqueued.ok !== false,
    cancelled: cancelled.cancelled ?? 0,
    ...enqueued,
  });
}

export { markCalendarReminderFired, readCrmState, writeCrmState };
