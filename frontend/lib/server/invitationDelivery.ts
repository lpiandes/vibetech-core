/**
 * Frontend-owned invitation delivery wiring.
 * Uses fetch-based Resend + Noop only — never imports backend/delivery or nodemailer.
 */

type DeliveryResult = {
  sent: boolean;
  reason: string;
  message: string;
};

type SendAttachment = {
  filename: string;
  content: Buffer | Uint8Array | string;
};

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  attachments?: SendAttachment[];
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

  async send(payload: SendInput): Promise<DeliveryResult> {
    const body: Record<string, unknown> = {
      from: String(payload.from ?? "").trim() || this.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    };
    const replyTo = String(payload.replyTo ?? "").trim();
    if (replyTo) body.reply_to = replyTo;
    if (Array.isArray(payload.attachments) && payload.attachments.length) {
      body.attachments = payload.attachments.map((row) => ({
        filename: String(row.filename || "attachment"),
        content: Buffer.isBuffer(row.content) || row.content instanceof Uint8Array
          ? Buffer.from(row.content).toString("base64")
          : String(row.content ?? ""),
      }));
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        reason: "resend_error",
        message: `Resend delivery failed (${response.status}): ${detail.slice(0, 200)}`,
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

function resolveSupportFromAddress() {
  return (
    process.env.SUPPORT_EMAIL_FROM ??
    process.env.OPS_EMAIL_FROM ??
    "VIBETech Support <support@vtechdevelopment.com>"
  );
}

/**
 * Production Next delivery port. SMTP/nodemailer stays backend-only;
 * Vercel uses Resend (fetch) or noop/unconfigured.
 */
export function createFrontendInvitationDeliveryProvider(options: { from?: string } = {}) {
  const explicit = String(process.env.INVITATION_DELIVERY_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "noop") return new NoopInvitationDeliveryProvider();

  const from = String(options.from ?? "").trim() || resolveFromAddress();
  const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (resendApiKey) {
    return new ResendInvitationDeliveryProvider({
      apiKey: resendApiKey,
      from,
    });
  }

  if (process.env.NODE_ENV === "production") {
    return new UnconfiguredProductionDeliveryProvider();
  }

  return new NoopInvitationDeliveryProvider();
}

/** VibeKeep / ops mail — always From support@ when Resend has the domain verified. */
export function createFrontendSupportDeliveryProvider() {
  return createFrontendInvitationDeliveryProvider({
    from: resolveSupportFromAddress(),
  });
}
