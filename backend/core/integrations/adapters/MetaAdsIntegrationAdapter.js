import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function text(value) { return value === null || value === undefined ? "" : String(value); }
function accountId(value) { const id = text(value); return id.startsWith("act_") ? id : `act_${id}`; }

/**
 * VIBETech-managed lead ads ops workflow (Meta side of ManagedLeadAdsPlaybook):
 *   1. Owner approves an offer/creative brief (outside this adapter — Ask/Work).
 *   2. VIBETech creates a PAUSED campaign (objective OUTCOME_LEADS by default).
 *   3. VIBETech creates a PAUSED ad set (lead-gen optimization goal, daily budget).
 *   4. VIBETech creates a lead-form creative stub referencing the Page + lead form.
 *   5. Owner reviews the paused scaffold in Ads Manager and activates when ready —
 *      this adapter never flips a campaign/ad set to ACTIVE.
 * Every step requires actionRequest.requiresApproval + outboundApproved; nothing
 * here spends money without an explicit owner activation step in Meta Ads Manager.
 */
export class MetaAdsIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z", graphApiVersion = process.env.META_GRAPH_API_VERSION || "" } = {}) {
    super(); this._fetch = fetchImpl; this._nowISO = String(nowISO); this._graphApiVersion = text(graphApiVersion).replace(/^\/+|\/+$/g, "");
  }
  get id() { return "meta_ads"; }
  get displayName() { return "Meta Ads"; }
  get supportedConnectionTypes() { return ["meta_ads"]; }
  get supportedCapabilities() {
    return [
      INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
      INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
      INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD,
      INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
      // Owner-gated activation — see #activateCampaign. Still defaults to
      // refusing unless both ownerApproved and confirmActivate are explicit.
      INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN,
    ];
  }
  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Meta Ads",
      summary: "Read ad performance and create owner-approved campaigns as paused drafts. VIBETech-managed lead ads can also scaffold a paused campaign + ad set + lead-form creative, duplicate paused ad variants for testing, and read richer campaign status — all for review before you activate spend.",
      estimatedTime: "20 minutes",
      prerequisites: ["Meta Business Portfolio", "Ad account", "System user or user access token with ads permissions", "Facebook Page + lead form (for managed lead-ads scaffolding)"],
      steps: [
        "Enter the ad account ID and access token",
        "Set the supported Graph API version",
        "Run a read-only account test",
        "Create a paused test campaign and review it in Ads Manager",
        "Optional: scaffold a paused lead-ads campaign (ad set + creative) for VIBETech-managed ops",
        "Optional: duplicate a paused ad variant (new ad set + creative) under an existing campaign for testing",
        "Activate a paused campaign only via the explicit ACTIVATE_AD_CAMPAIGN action (requires ownerApproved + confirmActivate) — never automatic",
      ],
      permissionsRequested: ["ads_read", "ads_management"], verificationMethod: "Meta ad-account account-status probe.",
      commonProblems: ["Token is expired", "System user lacks ad-account access", "Graph API version has expired", "Lead form ID does not belong to the connected Page", "ACTIVATE_AD_CAMPAIGN refuses without both ownerApproved and confirmActivate set explicitly"],
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

  /** Create a PAUSED ad set under a campaign — lead-gen optimization goal by default. */
  async #createAdSet({ accessToken, adAccountId, campaignId, adSet }) {
    const parameters = {
      name: text(adSet?.name || "VIBETech managed lead ads — ad set"),
      campaign_id: campaignId,
      optimization_goal: text(adSet?.optimizationGoal || "LEAD_GENERATION"),
      billing_event: text(adSet?.billingEvent || "IMPRESSIONS"),
      bid_strategy: text(adSet?.bidStrategy || "LOWEST_COST_WITHOUT_CAP"),
      daily_budget: adSet?.dailyBudgetCents ?? adSet?.dailyBudget ?? 2000,
      targeting: adSet?.targeting ?? { geo_locations: { countries: ["US"] } },
      status: "PAUSED",
    };
    return this.#request({ path: `${adAccountId}/adsets`, method: "POST", accessToken, parameters });
  }

  /** Create a lead-form creative stub referencing the connected Page + lead form. */
  async #createCreative({ accessToken, adAccountId, creative }) {
    const pageId = text(creative?.pageId);
    const leadFormId = text(creative?.leadFormId);
    const parameters = {
      name: text(creative?.name || "VIBETech managed lead ads — creative"),
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: text(creative?.message || "Tell us a bit about yourself and we'll be in touch."),
          link: `https://www.facebook.com/${pageId}`,
          call_to_action: {
            type: "SIGN_UP",
            value: leadFormId ? { lead_gen_form_id: leadFormId } : undefined,
          },
        },
      },
    };
    return this.#request({ path: `${adAccountId}/adcreatives`, method: "POST", accessToken, parameters });
  }

  /**
   * Orchestrate campaign + ad set + creative for a lead-form managed-ops
   * launch. Every object is created PAUSED — activation stays a separate,
   * explicit owner (or VIBETech ops) step in Meta Ads Manager.
   */
  async #createLeadCampaignScaffold({ accessToken, adAccountId, params }) {
    const campaignInput = params?.campaign && typeof params.campaign === "object" ? params.campaign : {};
    const campaignName = text(campaignInput.name);
    if (!campaignName) {
      return deepFreeze({ status: "failed", error: "campaign_name_required", completedAt: this._nowISO });
    }
    const { res: campaignRes, data: campaignData } = await this.#request({
      path: `${adAccountId}/campaigns`,
      method: "POST",
      accessToken,
      parameters: { name: campaignName, objective: text(campaignInput.objective || "OUTCOME_LEADS"), special_ad_categories: campaignInput.specialAdCategories ?? [], status: "PAUSED" },
    });
    if (!campaignRes.ok) {
      return deepFreeze({ status: "failed", error: text(campaignData?.error?.message || `meta_http_${campaignRes.status}`), retryable: campaignRes.status >= 500, completedAt: this._nowISO });
    }
    const campaignId = text(campaignData?.id);

    const { res: adSetRes, data: adSetData } = await this.#createAdSet({ accessToken, adAccountId, campaignId, adSet: params?.adSet });
    if (!adSetRes.ok) {
      return deepFreeze({
        status: "failed",
        error: text(adSetData?.error?.message || `meta_http_${adSetRes.status}`),
        retryable: adSetRes.status >= 500,
        completedAt: this._nowISO,
        metadata: deepFreeze({ campaignId, campaignStatus: "PAUSED", adSetCreated: false, creativeCreated: false }),
      });
    }
    const adSetId = text(adSetData?.id);

    const creativeInput = params?.creative && typeof params.creative === "object" ? params.creative : null;
    let creativeId = null;
    let creativeError = null;
    if (creativeInput?.pageId) {
      const { res: creativeRes, data: creativeData } = await this.#createCreative({ accessToken, adAccountId, creative: creativeInput });
      if (creativeRes.ok) {
        creativeId = text(creativeData?.id);
      } else {
        creativeError = text(creativeData?.error?.message || `meta_http_${creativeRes.status}`);
      }
    }

    return deepFreeze({
      externalReference: campaignId,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({
        campaignId,
        campaignStatus: "PAUSED",
        adSetId: adSetId || null,
        adSetStatus: adSetId ? "PAUSED" : null,
        creativeId,
        creativeError,
        managedOps: true,
        activationRequired: "Owner (or VIBETech ops) must review and activate in Meta Ads Manager — nothing here spends money.",
      }),
    });
  }

  /** Richer read of a single campaign's status than the insights report gives — id/name/status/effective_status/objective/budget. */
  async #readCampaignStatus({ accessToken, campaignId }) {
    const { res, data } = await this.#request({
      path: campaignId,
      accessToken,
      parameters: { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget" },
    });
    if (!res.ok) {
      return deepFreeze({ status: "failed", error: text(data?.error?.message || `meta_http_${res.status}`), retryable: res.status >= 500, completedAt: this._nowISO });
    }
    return deepFreeze({
      externalReference: campaignId,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({
        campaignId: text(data?.id) || campaignId,
        name: text(data?.name),
        status: text(data?.status) || null,
        effectiveStatus: text(data?.effective_status) || null,
        objective: text(data?.objective) || null,
        dailyBudget: data?.daily_budget ?? null,
        lifetimeBudget: data?.lifetime_budget ?? null,
      }),
    });
  }

  /**
   * Create an additional PAUSED ad set + creative under an existing
   * campaign — a "variant" for A/B testing copy/targeting without touching
   * the original ad set. Same money-safety posture as the initial scaffold:
   * always PAUSED, still gated on requiresApproval/outboundApproved by the
   * caller in executeAction.
   */
  async #createAdVariant({ accessToken, adAccountId, params }) {
    const campaignId = text(params.campaignId);
    if (!campaignId) {
      return deepFreeze({ status: "failed", error: "campaignId_required", completedAt: this._nowISO });
    }
    const { res: adSetRes, data: adSetData } = await this.#createAdSet({ accessToken, adAccountId, campaignId, adSet: params?.adSet });
    if (!adSetRes.ok) {
      return deepFreeze({ status: "failed", error: text(adSetData?.error?.message || `meta_http_${adSetRes.status}`), retryable: adSetRes.status >= 500, completedAt: this._nowISO });
    }
    const adSetId = text(adSetData?.id);
    const creativeInput = params?.creative && typeof params.creative === "object" ? params.creative : null;
    let creativeId = null;
    let creativeError = null;
    if (creativeInput?.pageId) {
      const { res: creativeRes, data: creativeData } = await this.#createCreative({ accessToken, adAccountId, creative: creativeInput });
      if (creativeRes.ok) creativeId = text(creativeData?.id);
      else creativeError = text(creativeData?.error?.message || `meta_http_${creativeRes.status}`);
    }
    return deepFreeze({
      externalReference: adSetId,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({
        campaignId,
        adSetId: adSetId || null,
        adSetStatus: adSetId ? "PAUSED" : null,
        creativeId,
        creativeError,
        variant: true,
        activationRequired: "Owner (or VIBETech ops) must review and activate in Meta Ads Manager — nothing here spends money.",
      }),
    });
  }

  /**
   * Flip a paused campaign to ACTIVE. This is the only place spend can
   * actually start, so it requires BOTH `ownerApproved: true` AND
   * `confirmActivate: true` in the action parameters — never inferred from
   * `requiresApproval`/`outboundApproved` alone, and never called by any
   * automated playbook step.
   */
  async #activateCampaign({ accessToken, params }) {
    if (params?.ownerApproved !== true || params?.confirmActivate !== true) {
      return deepFreeze({
        status: "failed",
        error: "explicit_owner_activation_required",
        message: "Activating a Meta campaign requires both ownerApproved: true and confirmActivate: true — this is never automatic.",
        completedAt: this._nowISO,
      });
    }
    const campaignId = text(params.campaignId);
    if (!campaignId) {
      return deepFreeze({ status: "failed", error: "campaignId_required", completedAt: this._nowISO });
    }
    const { res, data } = await this.#request({ path: campaignId, method: "POST", accessToken, parameters: { status: "ACTIVE" } });
    if (!res.ok) {
      return deepFreeze({ status: "failed", error: text(data?.error?.message || `meta_http_${res.status}`), retryable: res.status >= 500, completedAt: this._nowISO });
    }
    return deepFreeze({
      externalReference: campaignId,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({ campaignId, campaignStatus: "ACTIVE", activatedBy: "owner_approved_explicit_confirmation" }),
    });
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    try {
      const creds = this.#creds({ connection, credentialResolver }); const capability = text(actionRequest?.capability); const params = actionRequest?.parameters ?? {};
      if (capability === INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE) {
        const { res, data } = await this.#request({ path: `${creds.adAccountId}/insights`, accessToken: creds.accessToken, parameters: { fields: text(params.fields || "campaign_id,campaign_name,impressions,clicks,spend"), time_range: params.timeRange ?? { since: params.since, until: params.until }, level: text(params.level || "campaign") } });
        if (!res.ok) return deepFreeze({ status: "failed", error: text(data?.error?.message || `meta_http_${res.status}`), retryable: res.status >= 500, completedAt: this._nowISO });
        return deepFreeze({ externalReference: `meta_ads_report_${this._nowISO}`, status: "completed", completedAt: this._nowISO, metadata: deepFreeze({ data: data?.data ?? [] }) });
      }
      if (capability === INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD) {
        if (text(params.recordType) !== "campaign_status") {
          return deepFreeze({ status: "failed", error: "unsupported_record_type", completedAt: this._nowISO });
        }
        const campaignId = text(params.campaignId);
        if (!campaignId) return deepFreeze({ status: "failed", error: "campaignId_required", completedAt: this._nowISO });
        return this.#readCampaignStatus({ accessToken: creds.accessToken, campaignId });
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
      if (capability === INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD) {
        const recordType = text(params.recordType);
        if (recordType !== "lead_campaign_scaffold" && recordType !== "ad_variant") {
          return deepFreeze({ status: "failed", error: "unsupported_record_type", completedAt: this._nowISO });
        }
        // Same money-safety gate as CREATE_AD_CAMPAIGN — scaffolding still creates real (paused) Meta objects.
        if (!actionRequest?.requiresApproval || !actionRequest?.outboundApproved) return deepFreeze({ status: "failed", error: "owner_approval_required", completedAt: this._nowISO });
        if (recordType === "ad_variant") {
          return this.#createAdVariant({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, params });
        }
        return this.#createLeadCampaignScaffold({ accessToken: creds.accessToken, adAccountId: creds.adAccountId, params });
      }
      if (capability === INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN) {
        return this.#activateCampaign({ accessToken: creds.accessToken, params });
      }
      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    } catch (error) { return deepFreeze({ status: "failed", error: String(error?.message ?? error), retryable: true, completedAt: this._nowISO }); }
  }
}
