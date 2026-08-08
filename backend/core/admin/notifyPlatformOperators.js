/**
 * Notify platform operators about open operator actions.
 * Set PLATFORM_OPERATOR_EMAIL (comma-separated).
 * Optional: PLATFORM_OPERATOR_WEBHOOK_URL for Slack/etc.
 * Email uses the same Resend/SMTP provider as invitations (RESEND_API_KEY or SMTP_*).
 */
import {
  createInvitationDeliveryProvider,
  resolveOpsFromAddress,
  resolveOpsFromCandidates,
  parseResendAllowedRecipient,
} from "../platform/delivery/createInvitationDeliveryProvider.js";

function safeString(v) {
  return v == null ? "" : String(v).trim();
}

/** Avoid re-emailing the same action set every few minutes on Admin refresh. */
const recentlyNotified = new Map();
const DEDUPE_MS = 15 * 60 * 1000;

/** Default ops inbox when PLATFORM_OPERATOR_EMAIL is unset — white-glove setup requests. */
export const DEFAULT_PLATFORM_OPERATOR_EMAIL = "leopiandes@vtechdevelopment.com";

/**
 * Resend account email — required until vtechdevelopment.com is verified.
 * Without a verified domain, Resend rejects every other recipient.
 */
export const RESEND_ACCOUNT_OPS_FALLBACK_EMAIL = "lpiandes27@gmail.com";

function resolveOperatorEmails({ toEmails = null, fallbackDefaultEmail = false } = {}) {
  const fromEnv = safeString(process.env.PLATFORM_OPERATOR_EMAIL)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const override = Array.isArray(toEmails)
    ? toEmails.map((e) => safeString(e)).filter(Boolean)
    : [];
  let emails = [...new Set([...fromEnv, ...override])];
  if (!emails.length && fallbackDefaultEmail) {
    emails = [DEFAULT_PLATFORM_OPERATOR_EMAIL];
  }
  if (fallbackDefaultEmail && !emails.includes(DEFAULT_PLATFORM_OPERATOR_EMAIL)) {
    emails = [...emails, DEFAULT_PLATFORM_OPERATOR_EMAIL];
  }
  // Always include Resend-account fallback so ops mail lands while domain is unverified.
  if (!emails.includes(RESEND_ACCOUNT_OPS_FALLBACK_EMAIL)) {
    emails = [...emails, RESEND_ACCOUNT_OPS_FALLBACK_EMAIL];
  }
  return emails;
}

export async function notifyPlatformOperators({
  actions = [],
  fetchImpl = globalThis.fetch,
  force = false,
  deliveryProvider = null,
  /** Optional override / merge recipients (e.g. always include Leo for client setup handoffs). */
  toEmails = null,
  /** When true and no PLATFORM_OPERATOR_EMAIL, fall back to DEFAULT_PLATFORM_OPERATOR_EMAIL. */
  fallbackDefaultEmail = false,
  /** Preferred From: — we retry other verified candidates if this fails. */
  from = null,
  replyTo = "support@vtechdevelopment.com",
} = {}) {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) {
    return { ok: true, skipped: true, reason: "no_actions" };
  }

  let emails = resolveOperatorEmails({ toEmails, fallbackDefaultEmail });
  const webhook = safeString(process.env.PLATFORM_OPERATOR_WEBHOOK_URL);

  if (!emails.length && !webhook) {
    return { ok: true, skipped: true, reason: "no_notify_channel" };
  }

  const fingerprint = list.map((a) => String(a.id)).sort().join("|");
  const last = recentlyNotified.get(fingerprint) ?? 0;
  if (!force && Date.now() - last < DEDUPE_MS) {
    return { ok: true, skipped: true, reason: "deduped", fingerprint };
  }

  const bodyText = list.map((action) => {
    const steps = (action.steps ?? []).map((step, i) => `  ${i + 1}. ${step}`).join("\n");
    const payload = action.payload ? JSON.stringify(action.payload, null, 2) : "{}";
    return [
      `## ${action.title}`,
      action.summary,
      "",
      "Steps:",
      steps || "  (no steps listed)",
      "",
      "Payload:",
      payload,
      action.href ? `Admin: ${action.href}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  const subject = `[VIBETech] ${list.length} operator action(s) need you`;
  const results = { email: null, webhook: null, from: null, fromAttempts: [] };

  if (webhook) {
    try {
      const res = await fetchImpl(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: subject,
          actions: list,
          bodyText,
        }),
      });
      results.webhook = { ok: res.ok, status: res.status };
    } catch (err) {
      results.webhook = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (emails.length) {
    const fromCandidates = deliveryProvider
      ? [safeString(from) || resolveOpsFromAddress()]
      : resolveOpsFromCandidates(from);
    const replyToAddress = safeString(replyTo) || "support@vtechdevelopment.com";
    const emailResults = [];
    const triedRecipients = new Set();

    async function tryDeliver(to) {
      if (!to || triedRecipients.has(to)) return null;
      triedRecipients.add(to);
      let delivered = null;
      for (const fromAddress of fromCandidates) {
        try {
          const provider = deliveryProvider
            ?? createInvitationDeliveryProvider({ from: fromAddress });
          const sent = await provider.send({
            to,
            subject,
            text: bodyText,
            html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(bodyText)}</pre>`,
            replyTo: replyToAddress,
          });
          results.fromAttempts.push({
            to,
            from: fromAddress,
            sent: Boolean(sent?.sent),
            reason: sent?.reason ?? null,
            message: sent?.message ?? null,
          });
          if (sent?.sent) {
            delivered = { to, ...sent, from: fromAddress };
            results.from = fromAddress;
            break;
          }
          const allowed = parseResendAllowedRecipient(sent?.message ?? sent?.providerDetail ?? "");
          if (allowed && !triedRecipients.has(allowed) && !emails.includes(allowed)) {
            emails.push(allowed);
          }
        } catch (err) {
          results.fromAttempts.push({
            to,
            from: fromAddress,
            sent: false,
            reason: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return delivered;
    }

    // Snapshot recipients up front, then drain any Resend-allowed extras discovered mid-loop.
    const queue = [...emails];
    while (queue.length) {
      const to = queue.shift();
      const delivered = await tryDeliver(to);
      emailResults.push(
        delivered
        ?? {
          to,
          sent: false,
          reason: "all_from_failed",
          message: "Could not send ops email from any configured From address.",
        },
      );
      for (const extra of emails) {
        if (!triedRecipients.has(extra) && !queue.includes(extra)) {
          queue.push(extra);
        }
      }
    }
    results.email = emailResults;
    if (!results.from && fromCandidates[0]) results.from = fromCandidates[0];
  }

  recentlyNotified.set(fingerprint, Date.now());

  const emailSent = Array.isArray(results.email) && results.email.some((row) => row?.sent === true);
  const webhookOk = Boolean(results.webhook?.ok);
  const delivered = emailSent || webhookOk;
  const attemptedDelivery = Boolean(emails.length || webhook);

  return {
    ok: delivered || (!attemptedDelivery && Boolean(list.length)),
    delivered,
    results,
    count: list.length,
    fingerprint,
    reason: delivered
      ? null
      : attemptedDelivery
        ? "delivery_failed"
        : "no_notify_channel",
    error: delivered
      ? null
      : attemptedDelivery
        ? "Could not deliver ops email/webhook. Check RESEND_API_KEY / SMTP and PLATFORM_OPERATOR_EMAIL."
        : "no_notify_channel",
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
