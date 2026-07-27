import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createGoogleAuthedClient } from "../oauth/GoogleOAuthClient.js";

function text(value) { return value === null || value === undefined ? "" : String(value); }
function customerId(value) { return text(value).replace(/\D/g, ""); }

/**
 * Google Ads adapter. It only accepts an already-approved, explicit mutate
 * payload. Campaign creation is never allowed to silently spend money.
 */
export class GoogleAdsIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z", apiVersion = process.env.GOOGLE_ADS_API_VERSION || "v24" } = {}) {
    super(); this._fetch = fetchImpl; this._nowISO = String(nowISO); this._apiVersion = text(apiVersion);
  }
  get id() { return "google_ads"; }
  get displayName() { return "Google Ads"; }
  get supportedConnectionTypes() { return ["google_ads"]; }
  get supportedCapabilities() { return [INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN, INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE]; }
  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Google Ads", summary: "Create owner-approved, paused campaign drafts and read campaign performance.", estimatedTime: "20 minutes",
      prerequisites: ["Google Ads account", "Google Ads API developer token", "Google OAuth access to the customer account"],
      steps: ["Enter the Google Ads customer ID and developer token", "Connect Google", "Run a read-only account test", "Create a paused test campaign and approve its launch separately"],
      permissionsRequested: ["Google Ads API access", "Google account access"], verificationMethod: "Google Ads search stream account probe.",
      commonProblems: ["Developer token is not approved", "Wrong customer or manager account ID", "Google user lacks Ads account access"],
      reconnectInstructions: "Update the customer ID or token, then reconnect and rerun the test.", documentationReference: "https://developers.google.com/google-ads/api/docs/get-started/make-first-call",
    });
  }
  async healthCheck() { return { status: "requires_connection", providerId: this.id }; }
  async #creds({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) throw new Error("Google Ads credentials required.");
    const value = credentialResolver.resolve(connection.credentialReference);
    const id = customerId(value.customerId || value.customer_id);
    const developerToken = text(value.developerToken || value.developer_token);
    if (!id || !developerToken) throw new Error("Google Ads customer ID and developer token are required.");
    let accessToken = text(value.accessToken || value.access_token);
    if (!accessToken && (value.refreshToken || value.refresh_token)) {
      const auth = createGoogleAuthedClient({ refreshToken: value.refreshToken || value.refresh_token });
      const token = await auth.getAccessToken();
      accessToken = text(token?.token);
    }
    if (!accessToken) throw new Error("Google Ads OAuth access token is required.");
    return { customerId: id, developerToken, loginCustomerId: customerId(value.loginCustomerId || value.login_customer_id), accessToken };
  }
  #headers(creds) {
    return { Authorization: `Bearer ${creds.accessToken}`, "developer-token": creds.developerToken, ...(creds.loginCustomerId ? { "login-customer-id": creds.loginCustomerId } : {}), "Content-Type": "application/json" };
  }
  #url(customer, operation) { return `https://googleads.googleapis.com/${this._apiVersion}/customers/${customer}:${operation}`; }
  async verifyConnection({ connection, credentialResolver } = {}) {
    try {
      const creds = await this.#creds({ connection, credentialResolver });
      const res = await this._fetch(this.#url(creds.customerId, "searchStream"), { method: "POST", headers: this.#headers(creds), body: JSON.stringify({ query: "SELECT customer.id FROM customer LIMIT 1" }) });
      if (!res.ok) return deepFreeze({ status: "failed", verifiedAt: this._nowISO, capabilitiesVerified: [], code: "verification_failed", message: `Google Ads account probe failed (${res.status}).` });
      return deepFreeze({ status: "success", verifiedAt: this._nowISO, capabilitiesVerified: this.supportedCapabilities, code: "verified", message: "Google Ads account connection verified." });
    } catch (error) { return deepFreeze({ status: "failed", verifiedAt: this._nowISO, capabilitiesVerified: [], code: "verification_failed", message: String(error?.message ?? error) }); }
  }
  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    try {
      const creds = await this.#creds({ connection, credentialResolver });
      const capability = text(actionRequest?.capability); const params = actionRequest?.parameters ?? {};
      if (capability === INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE) {
        const query = text(params.query) || "SELECT campaign.id, campaign.name, metrics.clicks, metrics.impressions, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_30_DAYS";
        const res = await this._fetch(this.#url(creds.customerId, "searchStream"), { method: "POST", headers: this.#headers(creds), body: JSON.stringify({ query }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return deepFreeze({ status: "failed", error: text(data?.error?.message || `google_ads_http_${res.status}`), completedAt: this._nowISO, retryable: res.status >= 500 });
        return deepFreeze({ externalReference: `google_ads_report_${this._nowISO}`, status: "completed", completedAt: this._nowISO, metadata: deepFreeze({ results: data }) });
      }
      if (capability === INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN) {
        if (!actionRequest?.requiresApproval || !actionRequest?.outboundApproved) return deepFreeze({ status: "failed", error: "owner_approval_required", completedAt: this._nowISO });
        if (!Array.isArray(params.mutateOperations) || !params.mutateOperations.length) return deepFreeze({ status: "failed", error: "approved_mutateOperations_required", completedAt: this._nowISO });
        const res = await this._fetch(this.#url(creds.customerId, "mutate"), { method: "POST", headers: this.#headers(creds), body: JSON.stringify({ mutateOperations: params.mutateOperations, partialFailure: false, validateOnly: Boolean(params.validateOnly) }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return deepFreeze({ status: "failed", error: text(data?.error?.message || `google_ads_http_${res.status}`), completedAt: this._nowISO, retryable: res.status >= 500 });
        return deepFreeze({ externalReference: text(data?.mutateOperationResponses?.[0]?.campaignResult?.resourceName || `google_ads_mutate_${this._nowISO}`), status: "completed", completedAt: this._nowISO, metadata: deepFreeze({ response: data, validateOnly: Boolean(params.validateOnly) }) });
      }
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    } catch (error) { return deepFreeze({ status: "failed", error: String(error?.message ?? error), retryable: true, completedAt: this._nowISO }); }
  }
}
