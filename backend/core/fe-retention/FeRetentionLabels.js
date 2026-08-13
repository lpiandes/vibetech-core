/**
 * Human labels for FE retention auto-send kinds (dashboard + logs).
 */
const KIND_LABELS = Object.freeze({
  sms_opt_out: "Client opted out (STOP)",
  sms_opt_in: "Client opted back in (START)",
  inbound_yes: "Client replied YES",
  agent_inbound_sms: "Agent alert text (inbound)",
  agent_inbound_email: "Agent alert email (inbound)",
  agent_missed_payment_sms: "Agent alert text",
  gmail_lapse_unmatched: "Gmail lapse — unmatched",
  welcome: "Welcome",
  docsMail: "Policy papers in the mail",
  paymentReminder: "Payment reminder",
  birthday: "Birthday",
  holiday: "Holiday greeting",
  lapseRecovery: "Lapse / missed payment recovery",
  missedPaymentNotice: "Missed payment notice",
  agent_missed_payment_email: "Agent alert email",
  gmail_lapse_detect: "Gmail lapse detection",
});

export function feSendReasonLabel(kind) {
  const key = String(kind ?? "").trim();
  return KIND_LABELS[key] || key || "Message";
}

export const MONTH_OPTIONS = Object.freeze([
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]);

export function daysInMonth(month) {
  const m = Math.min(12, Math.max(1, Number(month) || 12));
  if (m === 2) return 28;
  if ([4, 6, 9, 11].includes(m)) return 30;
  return 31;
}

export function normalizeHolidayDate({ month = 12, day = 25 } = {}) {
  const holidayMonth = Math.min(12, Math.max(1, Number(month) || 12));
  const maxDay = daysInMonth(holidayMonth);
  const holidayDay = Math.min(maxDay, Math.max(1, Number(day) || 25));
  return { holidayMonth, holidayDay };
}
