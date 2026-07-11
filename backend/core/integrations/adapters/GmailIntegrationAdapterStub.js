import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Gmail provider registration without importing googleapis.
 * Real Gmail I/O must be injected by a composition root that owns the googleapis dependency.
 */
export class GmailIntegrationAdapterStub extends IntegrationProvider {
  constructor({ nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._nowISO = String(nowISO);
  }

  get id() {
    return "gmail";
  }

  get displayName() {
    return "Gmail";
  }

  get supportedConnectionTypes() {
    return ["business_email"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.SEND_EMAIL];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Gmail",
      summary: "Connect a Google Workspace or Gmail account for outbound email.",
      steps: ["Configure Gmail OAuth credentials in the server composition root.", "Verify the business email connection."],
    });
  }

  async verifyConnection() {
    return deepFreeze({
      status: "failed",
      checkedAt: this._nowISO,
      reason: "gmail_provider_not_wired",
      message: "Gmail delivery is not wired in this runtime.",
    });
  }

  async executeAction() {
    throw new Error("Gmail provider is not wired in this runtime.");
  }
}
