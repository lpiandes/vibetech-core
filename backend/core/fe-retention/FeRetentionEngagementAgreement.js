/**
 * VibeKeep engagement agreement — operational contract, not a substitute for counsel review.
 */
import { VIBEKEEP_AGREEMENT_VERSION, VIBEKEEP_OPS_EMAIL, VIBEKEEP_OPS_PHONE_DISPLAY } from "./FeRetentionOnboardingCatalog.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandAssetOrigin() {
  const origin = safeString(process.env.APP_ORIGIN || process.env.NEXTAUTH_URL || process.env.APP_URL);
  if (origin) return origin.replace(/\/$/, "");
  return "https://app.vtechdevelopment.com";
}

export function buildFeRetentionEngagementAgreement({
  profile = {},
  signedName = "",
  signedAt = null,
} = {}) {
  const legal = safeString(profile.legalBusinessName) || "the Agency";
  const address = [
    safeString(profile.street),
    [safeString(profile.city), safeString(profile.region), safeString(profile.postalCode)].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n");
  const date = signedAt ? String(signedAt) : new Date().toISOString();
  const signer = safeString(signedName) || "[signature required]";
  const logoUrl = `${brandAssetOrigin()}/brand/vibetech-wordmark.png`;

  const text = [
    `VIBEKEEP ENGAGEMENT AGREEMENT`,
    `VibeTech Development`,
    `Version ${VIBEKEEP_AGREEMENT_VERSION}`,
    ``,
    `This agreement is between VibeTech Development (“VibeTech”, “we”) and:`,
    `${legal}`,
    address || "(address on file)",
    ``,
    `1. Service. VibeKeep sends policy-related SMS (welcome, payment reminders, birthday/holiday, lapse follow-up) for the Agency’s book at $200 per month unless complimentary access is granted. The Agency may cancel in billing; amounts already billed are not refunded except as required by law.`,
    ``,
    `2. Agency responsibilities. The Agency is responsible for the accuracy of business and A2P registration information it provides (legal name, EIN, address, website, authorized representative). The Agency represents that each mobile number it uploads was obtained with consent to receive policy-related texts, and that it will honor STOP. The Agency will not use VibeKeep for spam, debt collection harassment, or messages that do not match the registered 10DLC campaign.`,
    ``,
    `3. Texting and carriers. VibeTech buys and assigns a Twilio number and submits or assists 10DLC (A2P) registration using the Agency’s information. Carriers (not VibeTech) approve Brand and Campaign. Delivery is not guaranteed. Filtered, delayed, or failed texts are not a refund event. Until the campaign is approved, messages may fail.`,
    ``,
    `4. No insurance advice. VibeKeep is software. It does not replace the Agency’s duty to service policies, reinstate coverage, or advise clients. Missed premiums, lapses, and carrier actions remain the Agency’s and the policyholder’s responsibility.`,
    ``,
    `5. Limitation of liability. To the fullest extent allowed by law, VibeTech’s total liability under this agreement is limited to the fees the Agency paid for VibeKeep in the three months before the claim. VibeTech is not liable for lost commissions, lapsed policies, carrier filtering, Twilio or Stripe outages, or indirect damages.`,
    ``,
    `6. Indemnity. The Agency will defend and indemnify VibeTech against claims arising from the Agency’s content, consent practices, A2P information, or misuse of the service.`,
    ``,
    `7. Signature. Typing the owner’s legal name below is the Agency’s electronic signature and has the same effect as a wet-ink signature.`,
    ``,
    `Questions: ${VIBEKEEP_OPS_EMAIL} or ${VIBEKEEP_OPS_PHONE_DISPLAY}.`,
    ``,
    `Signed electronically:`,
    `Business: ${legal}`,
    `Signer: ${signer}`,
    `Date (UTC): ${date}`,
  ].join("\n");

  const html = `<div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.55;color:#f1f5f9;max-width:720px;background:#070b14;border:1px solid rgba(34,211,238,0.28);border-radius:16px;overflow:hidden">
  <div style="padding:20px 24px 16px;background:linear-gradient(120deg, rgba(34,211,238,0.16) 0%, rgba(168,85,247,0.16) 100%);border-bottom:1px solid rgba(148,163,184,0.12)">
    <img src="${escapeHtml(logoUrl)}" alt="VibeTech Development" width="168" height="36" style="display:block;height:36px;width:auto;background:#fff;padding:6px 10px;border-radius:10px"/>
    <p style="margin:14px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#67e8f9;font-weight:700">VibeKeep</p>
    <h1 style="margin:4px 0 0;font-size:1.35rem;letter-spacing:-0.03em;color:#f1f5f9">Engagement Agreement</h1>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:13px">Version ${escapeHtml(VIBEKEEP_AGREEMENT_VERSION)}</p>
  </div>
  <div style="padding:20px 24px 24px">
    <p style="margin:0 0 1rem"><strong style="color:#67e8f9">${escapeHtml(legal)}</strong><br/>${escapeHtml(address || "(address on file)").replace(/\n/g, "<br/>")}</p>
    <ol style="margin:0 0 1.25rem;padding-left:1.2rem;color:#e2e8f0">
      <li style="margin-bottom:0.65rem"><strong style="color:#f1f5f9">Service.</strong> VibeKeep sends policy-related SMS for the Agency’s book at $200/month unless complimentary access is granted. Cancel in billing; amounts already billed are not refunded except as required by law.</li>
      <li style="margin-bottom:0.65rem"><strong style="color:#f1f5f9">Agency responsibilities.</strong> The Agency is responsible for A2P information it provides and for consent on every mobile number it uploads. STOP must be honored. No spam or off-campaign content.</li>
      <li style="margin-bottom:0.65rem"><strong style="color:#f1f5f9">Texting and carriers.</strong> VibeTech assigns a Twilio number and uses this information for 10DLC registration. Carriers approve Brand/Campaign. Delivery is not guaranteed.</li>
      <li style="margin-bottom:0.65rem"><strong style="color:#f1f5f9">No insurance advice.</strong> Software only. Lapses and carrier actions remain the Agency’s responsibility.</li>
      <li style="margin-bottom:0.65rem"><strong style="color:#f1f5f9">Limitation of liability.</strong> VibeTech’s total liability is limited to fees paid for VibeKeep in the three months before the claim. No liability for lost commissions, lapses, filtering, or outages.</li>
      <li style="margin-bottom:0.65rem"><strong style="color:#f1f5f9">Indemnity.</strong> The Agency indemnifies VibeTech for claims arising from the Agency’s content, consent, A2P data, or misuse.</li>
      <li><strong style="color:#f1f5f9">Signature.</strong> Typing the owner’s name is an electronic signature.</li>
    </ol>
    <p style="color:#94a3b8;font-size:13px">Questions: ${escapeHtml(VIBEKEEP_OPS_EMAIL)} or ${escapeHtml(VIBEKEEP_OPS_PHONE_DISPLAY)}.</p>
    <div style="margin-top:16px;padding:12px 14px;border-radius:12px;border:1px solid rgba(168,85,247,0.35);background:rgba(15,23,42,0.8)">
      <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#a855f7">Electronic signature</p>
      <p style="margin:6px 0 0"><strong>Signed:</strong> ${escapeHtml(signer)}<br/><strong>Date (UTC):</strong> ${escapeHtml(date)}</p>
    </div>
  </div>
</div>`;

  return { version: VIBEKEEP_AGREEMENT_VERSION, text, html, legalName: legal, signer, signedAt: date, logoUrl };
}
