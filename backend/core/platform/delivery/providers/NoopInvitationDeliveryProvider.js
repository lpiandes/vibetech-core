import { InvitationDeliveryProvider } from "../InvitationDeliveryProvider.js";

/** Development / unconfigured environments: no external email is sent. */
export class NoopInvitationDeliveryProvider extends InvitationDeliveryProvider {
  async send() {
    return {
      sent: false,
      reason: "dev_mailbox",
      message: "Email delivery is not configured. Use the invitation link in development.",
    };
  }
}
