import { CommunicationProvider } from "../communications/providers/CommunicationProvider.js";

/**
 * Deterministic CommunicationProvider for campaign delivery tests and mock email connections.
 */
export class DeterministicCampaignEmailProvider extends CommunicationProvider {
  constructor({ shouldFail = false, nowISO = "2026-07-01T00:00:00.000Z", id = "campaign_mock_email" } = {}) {
    super();
    this._shouldFail = Boolean(shouldFail);
    this._nowISO = String(nowISO);
    this._id = String(id);
    this._sent = new Set();
  }

  get id() {
    return this._id;
  }

  get name() {
    return "Deterministic campaign email provider";
  }

  get supportedChannels() {
    return ["email"];
  }

  get health() {
    return "healthy";
  }

  async send(message) {
    const messageId = String(message?.id ?? "");
    if (this._shouldFail) {
      throw new Error("campaign_mock_email_send_failed");
    }
    if (this._sent.has(messageId)) {
      return {
        providerMessageId: `prov_dup_${messageId}`,
        status: "sent",
        sentAt: this._nowISO,
        metadata: { idempotent: true },
      };
    }
    this._sent.add(messageId);
    return {
      providerMessageId: `prov_${messageId}`,
      status: "sent",
      sentAt: this._nowISO,
      metadata: { provider: this._id },
    };
  }
}
