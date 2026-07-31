import { NoopInvitationDeliveryProvider } from "./providers/NoopInvitationDeliveryProvider.js";
import { ResendInvitationDeliveryProvider } from "./providers/ResendInvitationDeliveryProvider.js";
import { SmtpInvitationDeliveryProvider } from "./providers/SmtpInvitationDeliveryProvider.js";
import { InvitationDeliveryProvider } from "./InvitationDeliveryProvider.js";

/** @type {import("../InvitationDeliveryProvider.js").InvitationDeliveryProvider | null} */
let testProviderOverride = null;

export function setInvitationDeliveryProviderForTests(provider) {
  testProviderOverride = provider;
}

export function resetInvitationDeliveryProviderForTests() {
  testProviderOverride = null;
}

function resolveFromAddress() {
  return (
    process.env.INVITATION_EMAIL_FROM ??
    process.env.RESEND_FROM ??
    process.env.SMTP_FROM ??
    "VIBETech <invitations@vibetech.app>"
  );
}

/** Ops / white-glove handoffs.
 * Prefer a From address already verified for invitations (Resend rejects unverified senders).
 * support@ is used as Reply-To when we must send from invitations@.
 */
export function resolveOpsFromAddress() {
  return (
    process.env.OPS_EMAIL_FROM ??
    process.env.SUPPORT_EMAIL_FROM ??
    process.env.INVITATION_EMAIL_FROM ??
    process.env.RESEND_FROM ??
    process.env.SMTP_FROM ??
    "VIBETech Support <support@vtechdevelopment.com>"
  );
}

/** Candidate From addresses for ops mail — first success wins.
 * Prefer invitations@ when support@ may be unverified in Resend (common after
 * flipping INVITATION_EMAIL_FROM to support@ without verifying the domain identity).
 */
export function resolveOpsFromCandidates(preferred = null) {
  const list = [
    preferred,
    process.env.OPS_EMAIL_FROM,
    "VIBETech <invitations@vtechdevelopment.com>",
    process.env.INVITATION_EMAIL_FROM,
    process.env.SUPPORT_EMAIL_FROM,
    process.env.RESEND_FROM,
    process.env.SMTP_FROM,
    "VIBETech Support <support@vtechdevelopment.com>",
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return [...new Set(list)];
}

class UnconfiguredProductionDeliveryProvider extends InvitationDeliveryProvider {
  async send() {
    return {
      sent: false,
      reason: "email_not_configured",
      message: "Invitation email delivery is not configured.",
    };
  }
}

export function createInvitationDeliveryProvider(options = {}) {
  if (testProviderOverride) return testProviderOverride;

  const from = String(options.from ?? "").trim() || resolveFromAddress();

  const explicit = String(process.env.INVITATION_DELIVERY_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "noop") return new NoopInvitationDeliveryProvider();

  const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (resendApiKey) {
    return new ResendInvitationDeliveryProvider({
      apiKey: resendApiKey,
      from,
    });
  }

  const smtpHost = String(process.env.SMTP_HOST ?? "").trim();
  if (smtpHost) {
    return new SmtpInvitationDeliveryProvider({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
      user: String(process.env.SMTP_USER ?? "").trim() || undefined,
      pass: String(process.env.SMTP_PASS ?? "").trim() || undefined,
      from,
    });
  }

  if (process.env.NODE_ENV === "production") {
    return new UnconfiguredProductionDeliveryProvider();
  }

  return new NoopInvitationDeliveryProvider();
}
