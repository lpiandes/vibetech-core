import { InvitationDeliveryProvider } from "../InvitationDeliveryProvider.js";

export class ResendInvitationDeliveryProvider extends InvitationDeliveryProvider {
  constructor({ apiKey, from }) {
    super();
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(payload) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        sent: false,
        reason: "provider_error",
        message: "We could not send the invitation email. Try again in a moment.",
      };
    }

    return {
      sent: true,
      reason: "resend",
      providerMessageId: String(data.id ?? ""),
    };
  }
}
