/**
 * Human-facing FE retention settings catalog — labels, help, editable templates.
 * Keep UI and persistence keyed off these helpers (no hardcoded JSON dumps).
 */
import { DEFAULT_FE_RETENTION_TEMPLATES } from "./FeRetentionTemplates.js";

export const FE_MESSAGE_TEMPLATE_FIELDS = Object.freeze([
  {
    key: "welcome",
    label: "Welcome text",
    help: "Sent automatically when you add a new client.",
  },
  {
    key: "docsMail",
    label: "Policy papers in the mail",
    help: "Sent with welcome. Use {{docsArriveDays}} for how many days until papers arrive.",
  },
  {
    key: "paymentReminder",
    label: "Payment reminder",
    help: "Sent automatically before each due date. Use {{reminderDays}}, {{carrier}}, and {{firstName}}.",
  },
  {
    key: "birthday",
    label: "Birthday text",
    help: "Sent on the client’s birthday.",
  },
  {
    key: "holiday",
    label: "Holiday / Christmas text",
    help: "Sent on the holiday date you set below.",
  },
  {
    key: "lapseRecovery",
    label: "Missed payment / lapse recovery",
    help: "Sent to the client when a policy is marked missed or lapsed. You also get a text and email alert.",
  },
]);

export function paymentReminderFieldLabel(reminderDaysBefore = 3) {
  const days = Math.min(14, Math.max(1, Number(reminderDaysBefore) || 3));
  return `Payment reminder (${days} day${days === 1 ? "" : "s"} before due)`;
}

export function listFeMessageTemplateFields({ reminderDaysBefore = 3 } = {}) {
  return FE_MESSAGE_TEMPLATE_FIELDS.map((field) => (
    field.key === "paymentReminder"
      ? { ...field, label: paymentReminderFieldLabel(reminderDaysBefore) }
      : field
  ));
}

export function mergeFeTemplates(raw = {}) {
  return {
    ...DEFAULT_FE_RETENTION_TEMPLATES,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
}

export const FE_SETTINGS_HELP = Object.freeze({
  reminderDaysBefore: {
    label: "Remind clients this many days before payment is due",
    help: "Example: 3 means we text them 3 days before their monthly due day.",
  },
  docsArriveDaysDefault: {
    label: "Default “papers arrive in X days”",
    help: "Used in the policy-papers text for new clients (and as the default on the add-client form).",
  },
  holidayMonth: {
    label: "Holiday send date",
    help: "Month and day the holiday text goes out (default December 25).",
  },
  holidayDay: {
    label: "Holiday send day",
    help: "Day of the holiday send month.",
  },
});

export function describeTwilioReadiness({ ready, fromNumber, missing = [] } = {}) {
  if (ready && fromNumber) {
    return {
      ready: true,
      badge: "Active",
      message: `Texts send from VibeTech’s number (${fromNumber}). Agents do not connect Twilio.`,
    };
  }
  const miss = Array.isArray(missing) && missing.length
    ? missing.join(", ")
    : "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_FROM (or TWILIO_PHONE_NUMBER)";
  return {
    ready: false,
    badge: "Not ready",
    message: `Texts cannot send yet. VibeTech platform Twilio is missing: ${miss}. Add these in Vercel env (production), then redeploy.`,
  };
}
