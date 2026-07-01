/**
 * EmailProvider (abstract interface)
 *
 * Providers should only execute outbound delivery.
 * They must NOT update runtime/business state directly.
 */
export class EmailProvider {
  async connect() {
    throw new Error("EmailProvider.connect() not implemented.");
  }

  /**
   * @param {object} params
   * @param {import('../../core/communication/Communication.js').CommunicationModel|any} params.communication
   * @returns {Promise<{providerMessageId?:string, providerStatus?:string, sentTimestampISO?:string}>}
   */
  async send({ communication } = {}) {
    throw new Error("EmailProvider.send() not implemented.");
  }

  async disconnect() {
    // optional
  }

  async health() {
    return { ok: true };
  }
}

