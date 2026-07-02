/**
 * CommunicationProvider (contract).
 *
 * Providers must NOT mutate CommunicationRuntime state.
 * They only execute external delivery using a frozen CommunicationMessage view from the runtime.
 */
export class CommunicationProvider {
  /**
   * @returns {string}
   */
  get id() {
    throw new Error("CommunicationProvider.id getter not implemented.");
  }

  /**
   * @returns {string}
   */
  get name() {
    throw new Error("CommunicationProvider.name getter not implemented.");
  }

  /**
   * @returns {string[]}
   */
  get supportedChannels() {
    throw new Error("CommunicationProvider.supportedChannels getter not implemented.");
  }

  /**
   * @returns {string}
   */
  get health() {
    return "unknown";
  }

  /**
   * Execute external delivery.
   *
   * @param {object} message - frozen communication message (from CommunicationRuntime)
   * @returns {Promise<{providerMessageId: string, status: string, sentAt: string|null, metadata?: object}>|{providerMessageId: string, status: string, sentAt: string|null, metadata?: object>}
   */
  send(message) {
    throw new Error("CommunicationProvider.send(message) not implemented.");
  }
}

