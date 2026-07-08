/**
 * Universal provider adapter contract.
 * Providers know implementation. Core knows capabilities.
 */
export class IntegrationProvider {
  get id() {
    throw new Error("IntegrationProvider.id not implemented.");
  }

  get providerType() {
    return this.id;
  }

  get displayName() {
    throw new Error("IntegrationProvider.displayName not implemented.");
  }

  get supportedConnectionTypes() {
    throw new Error("IntegrationProvider.supportedConnectionTypes not implemented.");
  }

  get supportedCapabilities() {
    throw new Error("IntegrationProvider.supportedCapabilities not implemented.");
  }

  get configurationRequirements() {
    return [];
  }

  getSetupGuidance() {
    return null;
  }

  async healthCheck() {
    return { status: "unknown" };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    void connection;
    void credentialResolver;
    throw new Error("IntegrationProvider.verifyConnection not implemented.");
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    void actionRequest;
    void connection;
    void credentialResolver;
    throw new Error("IntegrationProvider.executeAction not implemented.");
  }

  normalizeInboundEvent({ payload, headers } = {}) {
    void payload;
    void headers;
    return null;
  }

  validateWebhook({ payload, headers } = {}) {
    void payload;
    void headers;
    return { valid: false, reason: "not_supported" };
  }
}
