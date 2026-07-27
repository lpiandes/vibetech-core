import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createGoogleAuthedClient, isGoogleOAuthAppConfigured } from "../oauth/GoogleOAuthClient.js";
import { google } from "googleapis";

function safeString(value) {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Google Search Console is deliberately read-only: it reports search
 * performance, while editorial / SEO changes remain owner-approved work.
 */
export class GoogleSearchConsoleIntegrationAdapter extends IntegrationProvider {
  constructor({ searchConsoleClient = null, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._searchConsoleClient = searchConsoleClient;
    this._nowISO = String(nowISO);
  }

  get id() { return "google_search_console"; }
  get displayName() { return "Google Search Console"; }
  get supportedConnectionTypes() { return ["google_search_console"]; }
  get supportedCapabilities() { return [INTEGRATION_CAPABILITIES.READ_SEARCH_PERFORMANCE]; }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Google Search Console",
      summary: "Read verified website search performance into VIBETech.",
      estimatedTime: "5 minutes",
      prerequisites: ["Google account with access to the verified Search Console property"],
      steps: ["Click Connect with Google", "Choose the account that owns the site", "Approve read-only Search Console access", "Run a search-performance test"],
      permissionsRequested: ["webmasters.readonly"],
      verificationMethod: "OAuth token resolve + Search Console property list probe.",
      commonProblems: ["The website is not verified in Search Console", "The Google account lacks property access"],
      reconnectInstructions: "Disconnect and reconnect the Google account with property access.",
      documentationReference: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
    });
  }

  async healthCheck() {
    return { status: this._searchConsoleClient || isGoogleOAuthAppConfigured() ? "healthy" : "not_configured", providerId: this.id };
  }

  #clientFor({ connection, credentialResolver }) {
    if (this._searchConsoleClient) return this._searchConsoleClient;
    if (!connection?.credentialReference || !credentialResolver) throw new Error("Google Search Console credentials required.");
    const resolved = credentialResolver.resolve(connection.credentialReference);
    const refreshToken = resolved.refreshToken || resolved.refresh_token;
    if (!refreshToken) throw new Error("Google Search Console refresh token missing.");
    const auth = createGoogleAuthedClient({ refreshToken, accessToken: resolved.accessToken || resolved.access_token || null });
    return google.searchconsole({ version: "v1", auth });
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    try {
      const client = this.#clientFor({ connection, credentialResolver });
      await client.sites.list();
      return deepFreeze({ status: "success", verifiedAt: this._nowISO, capabilitiesVerified: this.supportedCapabilities, code: "verified", message: "Google Search Console connection verified." });
    } catch (error) {
      return deepFreeze({ status: "failed", verifiedAt: this._nowISO, capabilitiesVerified: [], code: "verification_failed", message: String(error?.message ?? error) });
    }
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    if (actionRequest?.capability !== INTEGRATION_CAPABILITIES.READ_SEARCH_PERFORMANCE) {
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    }
    const params = actionRequest?.parameters ?? {};
    const siteUrl = safeString(params.siteUrl);
    const startDate = safeString(params.startDate);
    const endDate = safeString(params.endDate);
    if (!siteUrl || !startDate || !endDate) {
      return deepFreeze({ status: "failed", error: "siteUrl_startDate_endDate_required", completedAt: this._nowISO });
    }
    try {
      const client = this.#clientFor({ connection, credentialResolver });
      const result = await client.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: Array.isArray(params.dimensions) ? params.dimensions : ["query"], rowLimit: Math.min(Number(params.rowLimit) || 25, 25000) },
      });
      return deepFreeze({ externalReference: `gsc_${siteUrl}_${endDate}`, status: "completed", completedAt: this._nowISO, metadata: deepFreeze({ rows: result?.data?.rows ?? [], responseAggregationType: result?.data?.responseAggregationType ?? null }) });
    } catch (error) {
      return deepFreeze({ status: "failed", error: String(error?.message ?? error), retryable: true, completedAt: this._nowISO });
    }
  }
}
