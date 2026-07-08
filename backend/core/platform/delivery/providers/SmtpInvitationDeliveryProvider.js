import nodemailer from "nodemailer";

import { InvitationDeliveryProvider } from "../InvitationDeliveryProvider.js";

export class SmtpInvitationDeliveryProvider extends InvitationDeliveryProvider {
  constructor({ host, port, secure, user, pass, from }) {
    super();
    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(payload) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      return {
        sent: true,
        reason: "smtp",
        providerMessageId: String(info.messageId ?? ""),
      };
    } catch {
      return {
        sent: false,
        reason: "provider_error",
        message: "We could not send the invitation email. Try again in a moment.",
      };
    }
  }
}
