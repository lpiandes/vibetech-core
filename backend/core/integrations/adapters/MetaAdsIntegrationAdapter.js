import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function text(value) { return value === null || value === undefined ? "" : String(value); }
function accountId(value) { const id = text(value); return id.startsWith("act_") ? id : `act_${id}`; }

/**
 * Meta Marketing API adapter. Campaigns are always created PAUSED; activating
 * or funding one remains a separate owner action in Meta Ads Manager.
 */
export class MetaAdsIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z", graphApiVersion = process.env.META_GRAPH_API_VERSION || "" } = {}) {
    super(); this._fetch = fetchImpl; this._nowISO = String(nowISO); this._graphApiVersion = text(graphApiVersion).replace(/^\/+|\/+$/g, "");
  }
  get id() { return "meta_ads"; }
  get displayName() { return "Meta Ads"; }
  get supportedConnectionTypes() { return ["meta_ads"]; }
  get supportedCapabilities() { return [INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN, INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE]; }
  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Meta Ads", summary: "Read ad performance and create owner-approved campaigns as paused drafts.", estimatedTime: "20 minutes",
      prerequisites: ["Meta Business Portfolio", "Ad account", "System user or user access token with ads permissions"],
      steps: ["Enter the ad account ID and access token", "Set the supported Graph API version", "Run a read-only account test", "Create a paused test campaign and review it in Ads Manager"],
      permissionsRequested: ["ads_read", "ads_management"], verificationMethod: "Meta ad-account account-status probe.",
      commonProblems: ["Token is expired", "System user lacks ad-account access", "Graph API version has expired"],
      reconnectInstructions: "Replace the access token, confirm account permissions, and rerun the test.", documentationReference: "https://developers.facebook.com/docs/marketing-apis/",
    });
  }
  async healthCheck() { return { status: this._graphApiVersion ? "requires_connection" : "not_configured", providerId: this.id }; }
  #url(path) { if (!this._graphApiVersion) throw new Error("META_GRAPH_API_VERSION must be configured before connecting Meta Ads."); return `https://graph.facebook.com/${this._graphApiVersion}/${path.replace(/^\//, "")}`; }
  #creds({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) throw new Error("Meta Ads credentials required.");
    const value = credentialResolver.resolve(connection.credentialReference);
    const accessToken = text(value.accessToken || value.access_token);
    const adAccountId = accountId(value.adAccountId || value.ad_account_id);
    if (!accessToken || adAccountId === "act_") throw new Error("Meta Ads access token and ad account ID are required.");
    return { accessToken, adAccountId };
  }
  async #request({ path, method = "GET", accessToken, parameters = null }) {
    const url = new URL(this.#url(path));
    const options = { method, headers: {} };
    if (method === "GET") { url.searchParams.set("access_token", accessToken); for (const [key, value] of Object.entries(parameters ?? {})) if (value !== undefined && value !== null) url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value)); }
    else { options.headers["Content-Type"] = "application/json"; options.body = JSON.stringify({ ...(parameters ?? {}), access_token: accessToken }); }
    const res = await this._fetch(url.toString(), options); const data = await res.json().catch(() => ({})); return { res, data };
  }
  async verifyConnection({ connection, credentialResolver } = {}) {
    try {
      const creds = this.#creds({ connection, credentialResolver }); const { res, data } = await this.#request({ path: creds.adAccountId, accessToken: creds.accessToken, parameters: { fields: "id,name,account_status" } });
      if (!res.ok) return deepFreeze({ status: "failed", verifiedAt: this._nowISO, capabilitiesVerified: [], code: "verification_failed", message: text(data?.error?.message || `Meta Ads account probe failed (${res.status}).`) });
      return deepFreeze({ status: "success", verifiedAt: this._nowISO, capabilitiesVerified: this.supportedCapabilities, code: "verified", message: "Meta Ads account connection verified." });
    } catch (error) { return deepFreeze({ status: "failed", verifiedAt: this._nowISO, capabilitiesVerified: [], code: "verification_failed", message: String(error?.message ?? error) }); }
  }
  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    try {
      const creds = this.#creds({ connection, credentialResolver }); const capability = text(actionRequest?.capability); const params = actionRequest?.parameters ?? {};
      if (capability === INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE) {
        const { res, data } = await this.#request({ path: `${creds.adAccountId}/insights`, accessToken: creds.accessToken, parameters: { fields: text(params.fields || "campaign_id,campaign_name,impressions,clicks,spend"), time_range: params.timeRange ?? { since: params.since, until: params.until }, level: text(params.level || "campaign") } });
        if (!res.ok) return deepFreeze({ status: "failed", error: text(data?.error?.message || `meta_http_${res.status}`), retryable: res.status >= 500, completedAt: this._nowISO });
        return deepFreeze({ externalReference: `meta_ads_report_${this._nowISO}`, status: "completed", completedAt: this._nowISO, metadata: deepFreeze({ data: data?.data ?? [] }) });
      }
      if (capability === INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN) {
        if (!actionRequest?.requiresApproval || !actionRequest?.outboundApproved) return deepFreeze({ status: "failed", error: "owner_approval_required", completedAt: this._nowISO });
        const campaign = params.campaign && typeof params.campaign === "object" ? params.campaign : null;
        if (!campaign?.name || !campaign?.objective) return deepFreeze({ status: "failed", error: "approved_campaign_name_and_objective_required", completedAt: this._nowISO });
        // Never permit an automated campaign to be created active.
        const { res, data } = await this.#request({ path: `${creds.adAccountId}/campaigns`, method: "POST", accessToken: creds.accessToken, parameters: { ...campaign, status: "PAUSED" } });
        if (!res.ok) return deepFreeze({ status: "failed", error: text(data?.error?.message || `meta_http_${res.status}`), retryable: res.status >= 500, completedAt: this._nowISO });
        return deepFreeze({ externalReference: text(data?.id), status: "completed", completedAt: this._nowISO, metadata: deepFreeze({ campaignStatus: "PAUSED", id: data?.id ?? null }) });
      }
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    } catch (error) { return deepFreeze({ status: "failed", error: String(error?.message ?? error), retryable: true, completedAt: this._nowISO }); }
  }
}
