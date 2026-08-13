import {
  getFeClient,
  isFeClientSmsPaused,
  listFeClients,
  readFeRetentionState,
} from "./FeRetentionStore.js";
import {
  alreadySentOnLocalDate,
  daysUntilBirthday,
  daysUntilDueDay,
  daysUntilMonthDay,
  easternDateKey,
  FE_SCHEDULED_KINDS,
  isAtOrAfterScheduledSendHour,
} from "./FeRetentionTime.js";

const MAX_SENDS_PER_TICK = 40;

/**
 * Build Needs Attention cards + recent log for the agent dashboard.
 */
export function buildFeNeedsAttention(state, { now = new Date() } = {}) {
  const clients = listFeClients(state);
  const settings = state?.settings ?? {};
  const reminderDays = Number(settings.reminderDaysBefore ?? 3) || 3;
  const cards = [];

  for (const notice of state?.unmatchedCarrierNotices ?? []) {
    if (notice.dismissed) continue;
    cards.push({
      id: `unmatched:${notice.id}`,
      type: "gmail_unmatched",
      priority: 0,
      title: "Carrier email — no matching client",
      body: `Looks like a ${notice.status || "lapse"} notice (“${notice.subject || "no subject"}”). Match it to a client or dismiss.`,
      clientId: "",
      clientName: "",
      status: "gmail_unmatched",
      noticeId: notice.id,
    });
  }

  for (const client of clients) {
    if (isFeClientSmsPaused(client)) {
      cards.push({
        id: `sms_opt_out:${client.id}`,
        type: "sms_opt_out",
        priority: 0,
        title: "SMS paused — client opted out",
        body: `We will not text ${client.name} anymore. They replied STOP. Keeping texts paused is required for legal compliance.`,
        clientId: client.id,
        clientName: client.name,
        status: "sms_opt_out",
      });
    }

    if (client.reinstatementStatus === "open") {
      cards.push({
        id: `reinstatement:${client.id}`,
        type: "reinstatement",
        priority: 0,
        title: "Client asked to reinstate",
        body: `${client.name} replied YES after a missed/lapse text. Follow up to get coverage back on the books.`,
        clientId: client.id,
        clientName: client.name,
        status: "reinstatement",
      });
    }

    const status = client.policy?.status || "active";
    if (status === "missed" || status === "lapsed") {
      cards.push({
        id: `lapse:${client.id}`,
        type: "lapse",
        priority: status === "lapsed" ? 1 : 2,
        title: status === "lapsed" ? "Policy lapsed" : "Missed payment",
        body: `Would you like help getting ${client.name}'s policy back on the books before it's terminated?`,
        clientId: client.id,
        clientName: client.name,
        status,
      });
    }

    if (!isFeClientSmsPaused(client)) {
      const bdays = daysUntilBirthday(client.birthday, now);
      if (bdays != null && bdays >= 0 && bdays <= 7) {
        cards.push({
          id: `birthday:${client.id}:${bdays}`,
          type: "birthday",
          priority: 4,
          title: bdays === 0 ? "Birthday today" : `Birthday in ${bdays} day${bdays === 1 ? "" : "s"}`,
          body: `${client.name} — automatic birthday text ${bdays === 0 ? "sends with today’s 1:00 PM UTC job" : "is scheduled for the daily 1:00 PM UTC job"}.`,
          clientId: client.id,
          clientName: client.name,
          days: bdays,
        });
      }

      if (status === "active") {
        const untilDue = daysUntilDueDay(client.policy?.dueDay, now);
        if (untilDue != null && untilDue <= reminderDays) {
          cards.push({
            id: `payment:${client.id}:${untilDue}`,
            type: "payment_reminder",
            priority: 3,
            title: untilDue === 0 ? "Payment due today" : `Payment in ${untilDue} day${untilDue === 1 ? "" : "s"}`,
            body: `${client.name} — ${client.policy?.carrier || "policy"} reminder ${untilDue === 0 ? "sends with today’s 1:00 PM UTC job" : "upcoming (daily 1:00 PM UTC job)"}.`,
            clientId: client.id,
            clientName: client.name,
            days: untilDue,
          });
        }
      }
    }
  }

  cards.sort((a, b) => a.priority - b.priority || String(a.title).localeCompare(String(b.title)));

  const recent = (state?.messageLog ?? []).slice(0, 40);
  const holidayMonth = Number(settings.holidayMonth ?? 12);
  const holidayDay = Number(settings.holidayDay ?? 25);
  const holidayDays = daysUntilMonthDay({ month: holidayMonth, day: holidayDay }, now);
  const isHolidayWindow = holidayDays != null && holidayDays <= 2;

  return {
    cards,
    recentSends: recent,
    holiday: {
      month: holidayMonth,
      day: holidayDay,
      activeWindow: isHolidayWindow,
    },
    clientCount: clients.length,
    atRiskCount: clients.filter((c) => c.policy?.status === "missed" || c.policy?.status === "lapsed").length,
    sendHourNote: "Scheduled texts (birthday, holiday, payment reminder) go out with the daily 1:00 PM UTC job (~9 AM Eastern in summer, ~8 AM Eastern in winter).",
  };
}

/**
 * Pure planner: which touchpoints are due for this business now.
 * Birthday / holiday / payment wait until the daily cron (13:00 UTC), then catch up same day.
 * Welcome / docsMail retry immediately if never sent.
 */
export function planFeRetentionSends(state, { now = new Date() } = {}) {
  const clients = listFeClients(state);
  const settings = state?.settings ?? {};
  const reminderDays = Number(settings.reminderDaysBefore ?? 3) || 3;
  const holidayMonth = Number(settings.holidayMonth ?? 12);
  const holidayDay = Number(settings.holidayDay ?? 25);
  const day = easternDateKey(now);
  const afterCron = isAtOrAfterScheduledSendHour(now);
  const planned = [];

  for (const client of clients) {
    if (!client.phone) continue;
    if (isFeClientSmsPaused(client)) continue;
    const status = client.policy?.status || "active";

    if (!client.welcomeSentAt) {
      planned.push({ clientId: client.id, kind: "welcome" });
    }
    if (!client.docsMailSentAt) {
      planned.push({ clientId: client.id, kind: "docsMail" });
    }

    if (afterCron) {
      const bdays = daysUntilBirthday(client.birthday, now);
      if (bdays === 0 && !alreadySentOnLocalDate(state.messageLog, { clientId: client.id, kind: "birthday", dateKey: day })) {
        planned.push({ clientId: client.id, kind: "birthday" });
      }

      const clientHolidayMonth = Number(client.holidayMonth) || holidayMonth;
      const clientHolidayDay = Number(client.holidayDay) || holidayDay;
      const untilHoliday = daysUntilMonthDay(
        { month: clientHolidayMonth, day: clientHolidayDay },
        now,
      );
      if (
        untilHoliday === 0
        && !alreadySentOnLocalDate(state.messageLog, { clientId: client.id, kind: "holiday", dateKey: day })
      ) {
        planned.push({ clientId: client.id, kind: "holiday" });
      }

      if (status === "active") {
        const untilDue = daysUntilDueDay(client.policy?.dueDay, now);
        if (
          untilDue === reminderDays
          && !alreadySentOnLocalDate(state.messageLog, { clientId: client.id, kind: "paymentReminder", dateKey: day })
        ) {
          planned.push({ clientId: client.id, kind: "paymentReminder" });
        }
      }
    }

    if (planned.length >= MAX_SENDS_PER_TICK) break;
  }

  return planned;
}

/** True when there is still unsent work the planner would send right now (retries included). */
export function feRetentionCatchUpDue(state, now = new Date()) {
  return planFeRetentionSends(state, { now }).length > 0;
}

export async function runFeRetentionSchedulerForBusiness({
  platformStore,
  installation,
  integrationPlatform = null,
  emailSender = null,
  now = new Date(),
  deliverTouchpoint,
} = {}) {
  let state = readFeRetentionState(installation);
  const results = [];
  let plannedCount = 0;

  // Drain in batches so a missed tick still clears a large book. Stop if a
  // round sends nothing (Twilio down) so we don't hammer the same failures.
  for (let round = 0; round < 3; round += 1) {
    const planned = planFeRetentionSends(state, { now });
    if (!planned.length) break;
    plannedCount += planned.length;
    let okThisRound = 0;
    for (const item of planned) {
      const client = getFeClient(state, item.clientId);
      if (!client) continue;
      const delivered = await deliverTouchpoint({
        platformStore,
        installation,
        state,
        client,
        kind: item.kind,
        integrationPlatform,
        emailSender,
        agentEmail: state.settings?.agentNotifyEmail,
        agentPhone: state.settings?.agentNotifyPhone,
        actorId: "fe_retention_scheduler",
      });
      state = delivered.state;
      results.push({ ...item, ok: delivered.ok });
      if (delivered.ok) okThisRound += 1;
    }
    if (okThisRound === 0 || planned.length < MAX_SENDS_PER_TICK) break;
  }

  state = {
    ...state,
    settings: {
      ...state.settings,
      lastSchedulerRunAt: now.toISOString(),
    },
  };

  return { planned: plannedCount, results, state };
}

export { daysUntilBirthday, daysUntilDueDay, alreadySentOnLocalDate as alreadySentToday, FE_SCHEDULED_KINDS };
