/**
 * Frontend-owned invitation delivery wiring.
 * Uses fetch-based Resend + Noop only — never imports backend/delivery or nodemailer.
 */

type DeliveryResult = {
  sent: boolean;
  reason: string;
  message: string;
};

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  businessName?: string;
  role?: string;
};

class NoopInvitationDeliveryProvider {
  async send(_input?: SendInput): Promise<DeliveryResult> {
    return {
      sent: false,
      reason: "noop",
      message: "Invitation email delivery is disabled (noop).",
    };
  }
}

class UnconfiguredProductionDeliveryProvider {
  async send(_input?: SendInput): Promise<DeliveryResult> {
    return {
      sent: false,
      reason: "email_not_configured",
      message: "Invitation email delivery is not configured.",
    };
  }
}

class ResendInvitationDeliveryProvider {
  apiKey: string;
  from: string;

  constructor({ apiKey, from }: { apiKey: string; from: string }) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send({ to, subject, html, text }: SendInput): Promise<DeliveryResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        sent: false,
        reason: "resend_error",
        message: `Resend delivery failed (${response.status}): ${body.slice(0, 200)}`,
      };
    }

    return {
      sent: true,
      reason: "resend",
      message: "Invitation email sent.",
    };
  }
}

function resolveFromAddress() {
  return (
    process.env.INVITATION_EMAIL_FROM ??
    process.env.RESEND_FROM ??
    process.env.SMTP_FROM ??
    "VIBETech <invitations@vibetech.app>"
  );
}

/**
 * Production Next delivery port. SMTP/nodemailer stays backend-only;
 * Vercel uses Resend (fetch) or noop/unconfigured.
 */
export function createFrontendInvitationDeliveryProvider() {
  const explicit = String(process.env.INVITATION_DELIVERY_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "noop") return new NoopInvitationDeliveryProvider();

  const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (resendApiKey) {
    return new ResendInvitationDeliveryProvider({
      apiKey: resendApiKey,
      from: resolveFromAddress(),
    });
  }

  if (process.env.NODE_ENV === "production") {
    return new UnconfiguredProductionDeliveryProvider();
  }

  return new NoopInvitationDeliveryProvider();
}
