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
      const providerDetail = String(data?.message ?? data?.error ?? "").trim();
      const isTestModeRecipient =
        /only send testing emails to your own email address/i.test(providerDetail)
        || /verify a domain/i.test(providerDetail);
      return {
        sent: false,
        reason: isTestModeRecipient ? "resend_domain_unverified" : "provider_error",
        message: isTestModeRecipient
          ? `${providerDetail} Until the sending domain is verified in Resend, use Copy invitation link, or invite the Resend account email.`
          : (providerDetail
            ? `Invitation email failed: ${providerDetail}`
            : "We could not send the invitation email. Try again in a moment."),
        providerStatus: response.status,
      };
    }

    return {
      sent: true,
      reason: "resend",
      providerMessageId: String(data.id ?? ""),
    };
  }
}
