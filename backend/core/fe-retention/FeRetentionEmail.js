/**
 * Agent notification email for FE Retention (missed payment / lapse).
 * Reuses the same delivery provider as invites (Resend / SMTP).
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function buildFeMissedPaymentEmail({ client, businessName = "your book" } = {}) {
  const name = safeString(client?.name) || "A client";
  const status = safeString(client?.policy?.status) || "missed";
  const subject = `Policy attention: ${name} — ${status}`;
  const text = [
    `Client: ${name}`,
    `Phone: ${safeString(client?.phone) || "—"}`,
    `Email: ${safeString(client?.email) || "—"}`,
    `Carrier: ${safeString(client?.policy?.carrier) || "—"}`,
    `Policy #: ${safeString(client?.policy?.policyNumber) || "—"}`,
    `Status: ${status}`,
    "",
    `Book: ${safeString(businessName) || "FE Retention"}`,
    "",
    "A retention recovery text was sent to the client when a phone number was on file.",
    "Open your FE Retention dashboard to follow up before the policy terminates.",
  ].join("\n");

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5;color:#0f172a">
  <h2 style="margin:0 0 12px">Policy needs attention</h2>
  <p><strong>${escapeHtml(name)}</strong> is marked <strong>${escapeHtml(status)}</strong>.</p>
  <ul>
    <li>Phone: ${escapeHtml(safeString(client?.phone) || "—")}</li>
    <li>Carrier: ${escapeHtml(safeString(client?.policy?.carrier) || "—")}</li>
    <li>Policy #: ${escapeHtml(safeString(client?.policy?.policyNumber) || "—")}</li>
  </ul>
  <p>A recovery text was sent when possible. Open your FE Retention dashboard to follow up.</p>
</div>`;

  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ send: (input: object) => Promise<object> }} deliveryProvider
 */
export async function sendFeAgentNotifyEmail({
  deliveryProvider,
  to,
  client,
  businessName,
} = {}) {
  const recipient = safeString(to);
  if (!recipient) {
    return deepFreeze({ ok: false, reason: "no_recipient" });
  }
  if (!deliveryProvider?.send) {
    return deepFreeze({ ok: false, reason: "email_provider_missing" });
  }
  const payload = buildFeMissedPaymentEmail({ client, businessName });
  try {
    const result = await deliveryProvider.send({
      to: recipient,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    const sent = result?.sent !== false && result?.reason !== "email_not_configured" && result?.reason !== "noop";
    return deepFreeze({
      ok: Boolean(sent),
      reason: result?.reason ?? null,
      message: result?.message ?? null,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "send_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
