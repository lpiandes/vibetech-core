import { MEMBERSHIP_ROLE_LABELS, INVITATION_TTL_DAYS } from "../permissions/rolePermissions.js";

/**
 * @param {{
 *   businessName: string,
 *   inviterName?: string | null,
 *   role: string,
 *   inviteUrl: string,
 *   expiresAt: string,
 * }} input
 */
export function composeInvitationEmail({ businessName, inviterName, role, inviteUrl, expiresAt }) {
  const roleLabel = MEMBERSHIP_ROLE_LABELS[role] ?? role;
  const inviterLine = inviterName?.trim()
    ? `${inviterName.trim()} invited you to join ${businessName} on VIBETech.`
    : `You've been invited to join ${businessName} on VIBETech.`;
  const expiresLine = formatExpirationLine(expiresAt);
  const subject = `Join ${businessName} on VIBETech`;

  const text = [
    inviterLine,
    "",
    `Role: ${roleLabel}`,
    "",
    "Accept your invitation:",
    inviteUrl,
    "",
    expiresLine,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 12px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;">VIBETech</div>
                <h1 style="margin:16px 0 8px;font-size:24px;line-height:1.3;">You're invited to ${escapeHtml(businessName)}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(inviterLine)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;">
                <p style="margin:0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">Role:</strong> ${escapeHtml(roleLabel)}</p>
                <p style="margin:12px 0 0;font-size:14px;color:#64748b;">${escapeHtml(expiresLine)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;">
                <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">Accept invitation</a>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;max-width:560px;line-height:1.5;">If the button does not work, copy and paste this link into your browser:<br><span style="word-break:break-all;">${escapeHtml(inviteUrl)}</span></p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

function formatExpirationLine(expiresAt) {
  try {
    const date = new Date(expiresAt);
    if (!Number.isNaN(date.getTime())) {
      return `This invitation expires on ${date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`;
    }
  } catch {
    // fall through
  }
  return `This invitation expires in ${INVITATION_TTL_DAYS} days.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
