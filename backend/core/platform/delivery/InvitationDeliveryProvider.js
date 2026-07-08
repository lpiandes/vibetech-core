/**
 * @typedef {object} InvitationDeliveryPayload
 * @property {string} to
 * @property {string} subject
 * @property {string} html
 * @property {string} text
 * @property {string} businessName
 * @property {string} role
 */

/**
 * @typedef {object} InvitationDeliveryResult
 * @property {boolean} sent
 * @property {string} reason
 * @property {string} [message]
 * @property {string} [providerMessageId]
 */

/**
 * Invitation delivery provider boundary.
 * InvitationService depends only on this interface — never on vendor SDKs.
 */
export class InvitationDeliveryProvider {
  /**
   * @param {InvitationDeliveryPayload} payload
   * @returns {Promise<InvitationDeliveryResult>}
   */
  async send(_payload) {
    throw new Error("InvitationDeliveryProvider.send() not implemented.");
  }
}
