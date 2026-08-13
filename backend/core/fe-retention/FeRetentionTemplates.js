function firstName(fullName = "") {
  const part = String(fullName ?? "").trim().split(/\s+/)[0];
  return part || "there";
}

export const DEFAULT_FE_RETENTION_TEMPLATES = Object.freeze({
  welcome:
    "Hi {{firstName}} — welcome! We're glad to have you. Your policy is set up and we're here if you need anything. Reply STOP to opt out.",
  docsMail:
    "Hi {{firstName}} — your physical policy documents should arrive in the mail within {{docsArriveDays}} days. Keep an eye on your mailbox. Reply STOP to opt out.",
  paymentReminder:
    "Hi {{firstName}} — friendly reminder: your {{carrier}} policy payment is due in {{reminderDays}} days. Paying on time keeps your coverage active. Reply STOP to opt out.",
  birthday:
    "Happy Birthday, {{firstName}}! Wishing you a wonderful day — we're grateful to have you as a client. Reply STOP to opt out.",
  holiday:
    "Merry Christmas and happy holidays, {{firstName}}! Thank you for trusting us with your coverage. Reply STOP to opt out.",
  lapseRecovery:
    "Hi {{firstName}} — it looks like your {{carrier}} policy may have missed a payment. Reply YES and we'll help get it reinstated before coverage is lost. Reply STOP to opt out.",
});

/**
 * @param {string} template
 * @param {Record<string, string|number>} vars
 */
export function renderFeTemplate(template, vars = {}) {
  let out = String(template ?? "");
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, String(value ?? ""));
  }
  return out.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "").trim();
}

/**
 * @param {{ name?: string, policy?: { carrier?: string, docsArriveDays?: number }, settings?: { templates?: object } }} input
 */
function clampReminderDays(value) {
  return Math.min(14, Math.max(1, Number(value) || 3));
}

/**
 * Keep payment-reminder copy aligned with the "days before due" setting.
 * Prefers {{reminderDays}}; rewrites older "coming up soon" / literal day counts.
 */
export function syncPaymentReminderTemplate(template, reminderDaysBefore = 3) {
  const days = clampReminderDays(reminderDaysBefore);
  const dayWord = days === 1 ? "day" : "days";
  let text = String(template ?? "").trim();
  if (!text) {
    return DEFAULT_FE_RETENTION_TEMPLATES.paymentReminder;
  }
  if (/coming up soon/i.test(text)) {
    text = text.replace(/coming up soon\.?/i, `due in {{reminderDays}} ${dayWord}.`);
  }
  if (/\{\{reminderDays\}\}/.test(text)) {
    // Keep placeholder; normalize "day/days" after it for singular settings.
    return text.replace(/\{\{reminderDays\}\}\s*days?/gi, `{{reminderDays}} ${dayWord}`);
  }
  if (/due in \d+\s*days?/i.test(text)) {
    return text.replace(/due in \d+\s*days?/i, `due in {{reminderDays}} ${dayWord}`);
  }
  return text;
}

export function buildFeMessageBodies({ kind, client, settings } = {}) {
  const templates = {
    ...DEFAULT_FE_RETENTION_TEMPLATES,
    ...(settings?.templates && typeof settings.templates === "object" ? settings.templates : {}),
  };
  const reminderDays = clampReminderDays(settings?.reminderDaysBefore);
  const vars = {
    firstName: firstName(client?.name),
    name: String(client?.name ?? "").trim() || "there",
    carrier: String(client?.policy?.carrier ?? "insurance").trim() || "insurance",
    docsArriveDays: Number(client?.policy?.docsArriveDays ?? 10) || 10,
    reminderDays,
  };
  const key = String(kind ?? "");
  let template = templates[key] ?? "";
  const clientOverride = client?.templateOverrides?.[key];
  if (clientOverride && String(clientOverride).trim()) {
    template = String(clientOverride).trim();
  }
  if (key === "paymentReminder") {
    template = syncPaymentReminderTemplate(template, reminderDays);
  }
  return renderFeTemplate(template, vars);
}
