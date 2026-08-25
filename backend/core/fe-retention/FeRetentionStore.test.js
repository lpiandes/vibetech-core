import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyFeRetentionState,
  upsertFeClient,
  setFeClientPolicyStatus,
  setFeClientSmsOptOut,
  appendFeMessageLog,
  readFeRetentionState,
  markClientTouchSent,
  normalizeFePhone,
} from "./FeRetentionStore.js";
import { planFeRetentionSends, buildFeNeedsAttention, feRetentionCatchUpDue } from "./FeRetentionNeedsAttention.js";
import { classifyCarrierNoticeText } from "./FeRetentionLapseFromGmail.js";
import { businessGrantsFeRetentionAccess, isFeRetentionOnlyPurchasedScope } from "./feRetentionEntitlement.js";
import { buildFeMessageBodies } from "./FeRetentionTemplates.js";

test("normalizeFePhone formats US numbers as E.164", () => {
  assert.equal(normalizeFePhone("6038182383"), "+16038182383");
  assert.equal(normalizeFePhone("(603) 818-2383"), "+16038182383");
  assert.equal(normalizeFePhone("+16038182383"), "+16038182383");
});

test("upsertFeClient requires name and phone or email", () => {
  const state = emptyFeRetentionState();
  const bad = upsertFeClient(state, { name: "Ada" });
  assert.equal(bad.ok, false);
  const ok = upsertFeClient(state, { name: "Ada Lovelace", phone: "+15551234567", policy: { carrier: "Mutual of Omaha", dueDay: 5 } });
  assert.equal(ok.ok, true);
  assert.equal(ok.isNew, true);
  assert.equal(ok.client.policy.carrier, "Mutual of Omaha");
  assert.equal(ok.client.phone, "+15551234567");
});

test("planFeRetentionSends schedules welcome and birthday", () => {
  const now = new Date("2026-07-15T13:00:00.000Z"); // daily cron 13:00 UTC (9 AM EDT)
  let state = emptyFeRetentionState();
  const created = upsertFeClient(state, {
    name: "Pat Client",
    phone: "+15550001111",
    birthday: "1990-07-15",
    policy: { carrier: "Aetna", dueDay: 18 },
  });
  state = created.state;
  state.settings.reminderDaysBefore = 3;
  const planned = planFeRetentionSends(state, { now });
  const kinds = planned.map((p) => p.kind).sort();
  assert.ok(kinds.includes("welcome"));
  assert.ok(kinds.includes("docsMail"));
  assert.ok(kinds.includes("birthday"));
  assert.ok(kinds.includes("paymentReminder")); // due day 18, reminder 3 days before = July 15
});

test("buildFeNeedsAttention surfaces lapses", () => {
  let state = emptyFeRetentionState();
  const created = upsertFeClient(state, {
    name: "Risk Client",
    phone: "+15550002222",
    policy: { carrier: "Gerber", dueDay: 1, status: "active" },
  });
  state = setFeClientPolicyStatus(created.state, { clientId: created.client.id, status: "lapsed" }).state;
  const attention = buildFeNeedsAttention(state);
  assert.equal(attention.atRiskCount, 1);
  assert.ok(attention.cards.some((c) => c.type === "lapse"));
});

test("classifyCarrierNoticeText detects missed and lapsed", () => {
  assert.equal(classifyCarrierNoticeText("Your premium is past due").match, true);
  assert.equal(classifyCarrierNoticeText("Your premium is past due").status, "missed");
  assert.equal(classifyCarrierNoticeText("Policy has lapsed for non-payment").status, "lapsed");
  assert.equal(classifyCarrierNoticeText("Newsletter from agency").match, false);
});

test("entitlement helpers", () => {
  assert.equal(businessGrantsFeRetentionAccess(["fe_retention_crm"]), true);
  assert.equal(isFeRetentionOnlyPurchasedScope(["fe_retention_crm"]), true);
  assert.equal(isFeRetentionOnlyPurchasedScope(["fe_retention_crm", "ai_receptionist"]), false);
});

test("templates render first name", () => {
  const body = buildFeMessageBodies({
    kind: "birthday",
    client: { name: "Jordan Lee", policy: { carrier: "XYZ" } },
    settings: {},
  });
  assert.match(body, /Jordan/);
});

test("payment reminder includes reminderDays from settings", () => {
  const body = buildFeMessageBodies({
    kind: "paymentReminder",
    client: { name: "Jordan Lee", policy: { carrier: "XYZ" } },
    settings: { reminderDaysBefore: 5 },
  });
  assert.match(body, /due in 5 days/);
  assert.match(body, /Jordan/);
  assert.match(body, /XYZ/);
});

test("STOP opt-out pauses client and skips planner", () => {
  let state = emptyFeRetentionState();
  const created = upsertFeClient(state, {
    name: "Opt Out Client",
    phone: "+15551234567",
    birthday: "07-15",
    policy: { dueDay: 18, carrier: "A" },
  });
  state = created.state;
  const opted = setFeClientSmsOptOut(state, { clientId: created.client.id, optedOut: true });
  state = opted.state;
  assert.equal(opted.client.smsOptedOut, true);

  const attention = buildFeNeedsAttention(state, { now: new Date("2026-07-15T12:00:00Z") });
  assert.ok(attention.cards.some((c) => c.type === "sms_opt_out"));

  const planned = planFeRetentionSends(state, { now: new Date("2026-07-15T12:00:00Z") });
  assert.equal(planned.length, 0);
});

test("isFeSmsOptOutKeyword recognizes STOP variants", async () => {
  const { isFeSmsOptOutKeyword, classifyFeInboundSms } = await import("./FeRetentionInbound.js");
  assert.equal(isFeSmsOptOutKeyword("STOP"), true);
  assert.equal(isFeSmsOptOutKeyword("stop."), true);
  assert.equal(isFeSmsOptOutKeyword("YES"), false);
  assert.equal(classifyFeInboundSms({ body: "START" }), "start");
  assert.equal(classifyFeInboundSms({ body: "yes" }), "yes");
  assert.equal(classifyFeInboundSms({ body: "hello" }), "ignored");
});

test("scheduled kinds wait until daily cron (13:00 UTC)", () => {
  let state = emptyFeRetentionState();
  const created = upsertFeClient(state, {
    name: "Pat Client",
    phone: "+15550001111",
    birthday: "1990-07-15",
    policy: { carrier: "Aetna", dueDay: 18 },
  });
  state = created.state;
  state.settings.reminderDaysBefore = 3;
  const beforeCron = planFeRetentionSends(state, { now: new Date("2026-07-15T12:59:00.000Z") });
  assert.ok(beforeCron.every((p) => p.kind === "welcome" || p.kind === "docsMail"));
  const afterCron = planFeRetentionSends(state, { now: new Date("2026-07-15T13:00:00.000Z") });
  assert.ok(afterCron.some((p) => p.kind === "birthday"));
});

test("catch-up stays due when a same-day tick ran but birthday was not sent", () => {
  let state = emptyFeRetentionState();
  const created = upsertFeClient(state, {
    name: "Pat Client",
    phone: "+15550001111",
    birthday: "1990-07-15",
    policy: { carrier: "Aetna", dueDay: 18 },
  });
  state = created.state;
  state = markClientTouchSent(state, { clientId: created.client.id, field: "welcome" });
  state = markClientTouchSent(state, { clientId: created.client.id, field: "docsMail" });
  state.settings.lastSchedulerRunAt = "2026-07-15T13:01:00.000Z";
  const now = new Date("2026-07-15T13:20:00.000Z");
  assert.equal(feRetentionCatchUpDue(state, now), true);
  assert.ok(planFeRetentionSends(state, { now }).some((p) => p.kind === "birthday"));

  state = appendFeMessageLog(state, {
    clientId: created.client.id,
    kind: "birthday",
    ok: true,
    at: "2026-07-15T13:05:00.000Z",
  }).state;
  assert.equal(
    planFeRetentionSends(state, { now }).some((p) => p.kind === "birthday"),
    false,
  );
});

test("winter cron 13:00 UTC (8 AM EST) still sends scheduled kinds", () => {
  let state = emptyFeRetentionState();
  const created = upsertFeClient(state, {
    name: "Pat Client",
    phone: "+15550001111",
    birthday: "1990-01-15",
    policy: { carrier: "Aetna", dueDay: 18 },
  });
  state = created.state;
  const atCron = planFeRetentionSends(state, { now: new Date("2026-01-15T13:00:00.000Z") });
  assert.ok(atCron.some((p) => p.kind === "birthday"));
});

test("findFeClientForCarrierNotice prefers policy number", async () => {
  const { findFeClientForCarrierNotice } = await import("./FeRetentionGmailMatch.js");
  const clients = [
    { id: "a", name: "Ann", policy: { policyNumber: "POL-999" } },
    { id: "b", name: "Bob Smith", policy: { policyNumber: "XYZ-12345" } },
  ];
  const found = findFeClientForCarrierNotice(clients, {
    subject: "Policy XYZ-12345 is past due",
    snippet: "Please remit",
  });
  assert.equal(found?.id, "b");
});

test("per-client holiday override and templateOverrides", () => {
  let state = emptyFeRetentionState();
  state.settings.holidayMonth = 12;
  state.settings.holidayDay = 25;
  const created = upsertFeClient(state, {
    name: "Hanukkah Client",
    phone: "+15559876543",
    holidayMonth: 12,
    holidayDay: 14,
    templateOverrides: {
      holiday: "Happy Hanukkah, {{firstName}}! Reply STOP to opt out.",
    },
  });
  state = created.state;
  const body = buildFeMessageBodies({
    kind: "holiday",
    client: created.client,
    settings: state.settings,
  });
  assert.match(body, /Hanukkah/);
  assert.doesNotMatch(body, /Christmas/);

  const planned = planFeRetentionSends(state, { now: new Date("2026-12-14T14:00:00Z") }); // 9 AM EST
  assert.ok(planned.some((p) => p.kind === "holiday" && p.clientId === created.client.id));
  const notYet = planFeRetentionSends(state, { now: new Date("2026-12-25T14:00:00Z") });
  assert.ok(!notYet.some((p) => p.kind === "holiday" && p.clientId === created.client.id));
});

test("old Dec 22 default migrates to 25 until customized", () => {
  const installation = {
    configuration: {
      feRetention: {
        settings: { holidayMonth: 12, holidayDay: 22, templates: {} },
        clients: [],
        messageLog: [],
      },
    },
  };
  const state = readFeRetentionState(installation);
  assert.equal(state.settings.holidayDay, 25);
});

test("buildFeAgentAlertSms names client and status", async () => {
  const { buildFeAgentAlertSms } = await import("./FeRetentionOutbound.js");
  const text = buildFeAgentAlertSms({
    client: { name: "Pat Client", phone: "+15551212", policy: { status: "lapsed" } },
    businessName: "Demo Book",
  });
  assert.match(text, /Pat Client/);
  assert.match(text, /lapsed/);
  assert.match(text, /Demo Book/);
});

