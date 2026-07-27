import test from "node:test";
import assert from "node:assert/strict";

import { WorkRuntime } from "../../work/WorkRuntime.js";
import { AutomationRuntime } from "../../automations/AutomationRuntime.js";
import {
  ensureEmployeeOperatingAutomationRegistered,
  specialtyAutomationMatchesEvent,
} from "./registerEmployeeOperatingAutomation.js";
import { runSpecialtyDraftJob, buildSpecialtyBriefFromContract } from "./runSpecialtyDraftJob.js";
import { fireSpecialtyTrigger } from "./fireSpecialtyTrigger.js";
import {
  computeNextScheduleRunAfter,
  enqueueSpecialtyScheduleJob,
  normalizeSpecialtySchedule,
  resolveEmployeeSpecialtySchedule,
} from "./specialtyScheduleEngine.js";
import { suggestSpecialtyMessageTemplate, sendSpecialtyOutbound } from "./specialtyOutbound.js";
import { applyOperatingContractPatch, buildOperatingContract } from "../operating-contract/buildOperatingContract.js";
import { InMemoryPlatformJobQueue, JOB_TYPES, DurableWorkflowExecutor } from "../../platform/jobs/PlatformJobQueue.js";
import { processSpecialtyScheduleDueJob } from "../../platform/jobs/processSpecialtyScheduleDueJob.js";
import { AUTOMATION_INTERNAL_EVENT_TYPES } from "../../automations/AutomationEventTypes.js";

const NOW = "2026-07-20T15:00:00.000Z";

function familyCommsEmployee(overrides = {}) {
  const base = {
    employeeId: "emp_family_comms_1",
    label: "A Parent Communications Assistant",
    purpose: "Draft family messages",
    ownerAdded: true,
    capabilities: ["custom_ai_work"],
  };
  const built = buildOperatingContract({
    employee: base,
    industry: "sports",
  });
  const patched = applyOperatingContractPatch({
    employee: { ...base, operatingContract: built.contract },
    industry: "sports",
    patch: {
      scope: {
        answers: {
          audience: { value: "All Families on U12 Team" },
          when: { value: "Once a week on Sundays" },
          where: { value: "Email and SMS" },
          howMany: { value: "1 text and email a week" },
          constraints: { value: "No fees in SMS" },
        },
      },
      trigger: {
        mode: "manual_or_events",
        schedule: { cadence: "weekly", dayOfWeek: 0, hourLocal: 9, timezone: "America/New_York" },
      },
      messageTemplate: {
        emailSubject: "U12 update",
        emailBody: "Hi families...",
        smsBody: "U12 update this week",
        channels: ["email", "sms"],
      },
    },
    actorId: "owner",
    nowISO: NOW,
  });
  return {
    ...base,
    operatingContract: patched.contract,
    automationDefinitions: [{ automationId: `auto_contract_${base.employeeId}`, status: "INACTIVE" }],
    ...overrides,
  };
}

test("buildSpecialtyBriefFromContract includes scope + template", () => {
  const employee = familyCommsEmployee();
  const brief = buildSpecialtyBriefFromContract({
    employee,
    brief: "Ice cancelled",
    triggerLabel: "Schedule changed",
  });
  assert.match(brief, /Ice cancelled/);
  assert.match(brief, /audience:/i);
  assert.match(brief, /U12 update/);
});

test("register + activate specialty automation in runtime", () => {
  const employee = familyCommsEmployee();
  const automationRuntime = new AutomationRuntime({ nowISO: NOW });
  const reg = ensureEmployeeOperatingAutomationRegistered({
    automationRuntime,
    employee,
    nowISO: NOW,
  });
  assert.ok(reg.automationId);
  assert.equal(reg.registered, true);

  automationRuntime.applyEvent({
    id: `evt_act_${reg.automationId}`,
    timestampISO: NOW,
    type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_ACTIVATED,
    payload: { automationId: reg.automationId },
  });
  const auto = automationRuntime.getAutomationById(reg.automationId);
  assert.equal(String(auto.status), "ACTIVE");
  assert.equal(specialtyAutomationMatchesEvent(auto, "SCHEDULE_CHANGE"), true);
  assert.equal(specialtyAutomationMatchesEvent(auto, "SPECIALTY_SCHEDULE_DUE"), true);
});

test("manual mission runSpecialtyDraftJob creates work", async () => {
  const employee = familyCommsEmployee();
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const result = await runSpecialtyDraftJob({
    workRuntime,
    employee,
    brief: "Practice moved to 6pm",
    actorId: "owner",
    businessId: "biz_test",
    knowledgeDocuments: [],
    triggerEventType: "SPECIALTY_JOB_REQUESTED",
    nowISO: () => NOW,
  });
  assert.equal(result.ok, true);
  assert.ok(result.workItemId);
  const item = workRuntime.getWorkItem(result.workItemId);
  assert.ok(item);
  assert.match(String(item.description ?? ""), /Practice moved/);
});

test("fireSpecialtyTrigger blocked when inactive; works when active", async () => {
  const employee = familyCommsEmployee();
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const automationRuntime = new AutomationRuntime({ nowISO: NOW });
  ensureEmployeeOperatingAutomationRegistered({ automationRuntime, employee, nowISO: NOW });

  const blocked = await fireSpecialtyTrigger({
    workRuntime,
    automationRuntime,
    employee,
    eventType: "SCHEDULE_CHANGE",
    businessId: "biz_test",
    nowISO: () => NOW,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "automation_inactive");

  const autos = automationRuntime.getAutomations();
  automationRuntime.applyEvent({
    id: "evt_activate",
    timestampISO: NOW,
    type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_ACTIVATED,
    payload: { automationId: autos[0].id },
  });

  const fired = await fireSpecialtyTrigger({
    workRuntime,
    automationRuntime,
    employee: { ...employee, automationDefinitions: [{ status: "ACTIVE" }] },
    eventType: "SCHEDULE_CHANGE",
    businessId: "biz_test",
    nowISO: () => NOW,
  });
  assert.equal(fired.ok, true);
  assert.ok(fired.workItemId);
});

test("schedule engine computes next Sunday and enqueues job", async () => {
  const schedule = normalizeSpecialtySchedule({
    cadence: "weekly",
    dayOfWeek: 0,
    hourLocal: 9,
  });
  assert.ok(schedule);
  const runAfter = computeNextScheduleRunAfter({
    schedule,
    fromISO: "2026-07-20T15:00:00.000Z", // Monday
  });
  assert.ok(runAfter);
  assert.equal(new Date(runAfter).getUTCDay(), 0);

  const queue = new InMemoryPlatformJobQueue({ nowISO: () => NOW });
  const enq = await enqueueSpecialtyScheduleJob({
    queue,
    businessId: "biz_1",
    employeeId: "emp_1",
    schedule,
  });
  assert.equal(enq.ok, true);
  assert.equal(JOB_TYPES.SPECIALTY_SCHEDULE_DUE, "specialty_schedule_due");
});

test("resolveEmployeeSpecialtySchedule from Sunday when text", () => {
  const employee = familyCommsEmployee();
  const schedule = resolveEmployeeSpecialtySchedule(employee);
  assert.ok(schedule);
  assert.equal(schedule.cadence, "weekly");
  assert.equal(schedule.dayOfWeek, 0);
});

test("suggestSpecialtyMessageTemplate fills email/sms", () => {
  const employee = familyCommsEmployee();
  const t = suggestSpecialtyMessageTemplate({ employee, businessName: "Top Gun Hockey Club" });
  assert.match(t.emailSubject, /Top Gun/);
  assert.ok(t.emailBody.length > 20);
  assert.ok(t.smsBody.length > 5);
  assert.ok(t.channels.includes("email"));
});

test("sendSpecialtyOutbound requires approval and recipients", async () => {
  const denied = await sendSpecialtyOutbound({
    businessId: "biz",
    workItem: { id: "w1", title: "t", description: "body" },
    outboundApproved: false,
    recipients: [{ email: "a@b.com" }],
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "outbound_approval_required");

  const noRecipients = await sendSpecialtyOutbound({
    businessId: "biz",
    workItem: { id: "w1" },
    outboundApproved: true,
    recipients: [],
  });
  assert.equal(noRecipients.ok, false);
  assert.equal(noRecipients.reason, "no_recipients");

  const sent = await sendSpecialtyOutbound({
    businessId: "biz",
    workItem: { id: "w1", title: "Hi", description: "Body" },
    outboundApproved: true,
    recipients: [{ email: "parent@example.com" }],
    channels: ["email"],
    emailSubject: "Sub",
    emailBody: "Hello",
    sendEmail: async () => ({ ok: true }),
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.results[0].channel, "email");
});

test("processSpecialtyScheduleDueJob drafts and chains next", async () => {
  const employee = familyCommsEmployee({
    automationDefinitions: [{ status: "ACTIVE" }],
  });
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => NOW });
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const automationRuntime = new AutomationRuntime({ nowISO: NOW });
  const reg = ensureEmployeeOperatingAutomationRegistered({
    automationRuntime,
    employee,
    nowISO: NOW,
  });
  automationRuntime.applyEvent({
    id: "evt_on",
    timestampISO: NOW,
    type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_ACTIVATED,
    payload: { automationId: reg.automationId },
  });

  const job = await queue.enqueue({
    businessId: "biz_sched",
    jobType: JOB_TYPES.SPECIALTY_SCHEDULE_DUE,
    idempotencyKey: "test_sched_1",
    payload: { employeeId: employee.employeeId, eventType: "SPECIALTY_SCHEDULE_DUE" },
    runAfter: NOW,
  });

  const outcome = await processSpecialtyScheduleDueJob({
    job,
    queue,
    nowISO: () => NOW,
    loadWorkspace: async () => ({
      ok: true,
      workRuntime,
      automationRuntime,
      employee,
      knowledgeDocuments: [],
    }),
  });
  assert.equal(outcome.ok, true);
  assert.ok(outcome.workItemId);
  assert.equal(outcome.nextSchedule?.ok, true);

  const executor = new DurableWorkflowExecutor({
    queue: new InMemoryPlatformJobQueue({ nowISO: () => NOW }),
    runSpecialtySchedule: async () => ({ ok: true, workItemId: "x" }),
  });
  assert.ok(executor.runSpecialtySchedule);
});

test("messageTemplate persists on operating contract patch", () => {
  const employee = familyCommsEmployee();
  const next = applyOperatingContractPatch({
    employee,
    industry: "sports",
    patch: {
      messageTemplate: {
        emailSubject: "New subject",
        emailBody: "New body",
        smsBody: "SMS",
        channels: ["email"],
      },
    },
    nowISO: NOW,
  });
  assert.equal(next.contract.messageTemplate.emailSubject, "New subject");
  assert.equal(next.completeness.complete, true);
});
