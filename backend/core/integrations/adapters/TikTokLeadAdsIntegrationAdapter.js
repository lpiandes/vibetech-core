import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Webhook app credentials — required to receive TikTok lead-form events at all. */
export function isTikTokLeadAdsWebhookConfigured() {
  return Boolean(
    safeString(process.env.TIKTOK_APP_ID)
    && safeString(process.env.TIKTOK_APP_SECRET)
    && safeString(process.env.TIKTOK_WEBHOOK_VERIFY_TOKEN),
  );
}

/**
 * TikTok Marketing API credentials for VIBETech-managed campaign creation.
 * This is a platform-level (not per-business) credential today — scaffold
 * stage only. Do not treat this as a per-workspace OAuth connection yet.
 */
export function isTikTokMarketingApiConfigured() {
  return Boolean(
    safeString(process.env.TIKTOK_ACCESS_TOKEN)
    && safeString(process.env.TIKTOK_ADVERTISER_ID),
  );
}

/** Overall "is TikTok lead ads usable at all" gate for provider registration. */
export function isTikTokLeadAdsConfigured() {
  return isTikTokLeadAdsWebhookConfigured() || isTikTokMarketingApiConfigured();
}

/**
 * VIBETech-managed TikTok lead ads — scaffold adapter.
 *
 * Honesty: this is rolling out, not a finished self-serve product. Lead-form
 * webhook ingest and campaign scaffolding both require VIBETech ops to
 * configure platform-level TikTok Business Center credentials; there is no
 * per-business OAuth connect flow yet. Campaigns are always created paused
 * (operation_status DISABLE) — activation is a separate, explicit step.
 */
export class TikTokLeadAdsIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._fetch = fetchImpl;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "tiktok_lead_ads";
  }

  get displayName() {
    return "TikTok Lead Ads (VIBETech-managed)";
  }

  get supportedConnectionTypes() {
    return ["tiktok_lead_ads"];
  }

  get supportedCapabilities() {
    return [
      INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK,
      INTEGRATION_CAPABILITIES.INGEST_FORM_SUBMISSION,
      INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
      INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
    ];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "VIBETech-managed TikTok lead ads",
      summary: "VIBETech ops runs TikTok lead-form ads on your behalf as part of the managed lead ads playbook. This is rolling out — campaign scaffolding requires platform-level TikTok Business Center credentials; there is no self-serve connect yet.",
      estimatedTime: "Managed by VIBETech ops",
      prerequisites: ["TikTok Business Center account", "TikTok Ads Manager advertiser ID", "Lead Generation objective enabled on the advertiser account"],
      steps: [
        "VIBETech ops configures a TikTok Business Center app + advertiser access",
        "VIBETech ops scaffolds a paused campaign for your offer/creative brief",
        "Owner reviews the paused campaign and approves the budget",
        "VIBETech ops (or the owner) activates the campaign in TikTok Ads Manager",
        "New lead-form submissions webhook into the same appointment-setter pipeline as Meta leads",
      ],
      permissionsRequested: ["ads_management", "leads_retrieval"],
      verificationMethod: "TikTok Marketing API advertiser probe (platform credentials).",
      commonProblems: ["Platform TikTok credentials not configured yet — managed ops required", "Advertiser account missing Lead Generation objective"],
      reconnectInstructions: "Contact VIBETech ops to refresh TikTok Business Center credentials.",
      documentationReference: "https://business-api.tiktok.com/portal/docs",
    });
  }

  async healthCheck() {
    if (!isTikTokMarketingApiConfigured()) {
      return { status: "not_configured", providerId: this.id, message: "TikTok Marketing API credentials are not set. VIBETech-managed TikTok lead ads is not available yet." };
    }
    return { status: "requires_connection", providerId: this.id };
  }

  async verifyConnection() {
    if (!isTikTokMarketingApiConfigured()) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "not_configured",
        message: "TikTok Marketing API credentials (TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_ID) are not configured.",
      });
    }
    try {
      const advertiserId = safeString(process.env.TIKTOK_ADVERTISER_ID);
      const res = await this._fetch(
        `${TIKTOK_API_BASE}/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([advertiserId]))}`,
        { headers: { "Access-Token": safeString(process.env.TIKTOK_ACCESS_TOKEN) } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || Number(data?.code) !== 0) {
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "verification_failed",
          message: safeString(data?.message) || `TikTok advertiser probe failed (${res.status}).`,
        });
      }
      return deepFreeze({
        status: "success",
        verifiedAt: this._nowISO,
        capabilitiesVerified: this.supportedCapabilities,
        code: "verified",
        message: "TikTok Marketing API advertiser account verified.",
      });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "verification_failed",
        message: String(err?.message ?? err),
      });
    }
  }

  /**
   * Normalize a TikTok lead-form webhook payload. TikTok's Lead Generation
   * webhook shape varies by integration path (direct webhook vs Business
   * Center lead export) — this handles the common `leads_data`/`leads` array
   * shape and is intentionally defensive since VIBETech ops configures the
   * exact webhook subscription.
   */
  normalizeWebhook({ body = {} } = {}) {
    const leads = Array.isArray(body?.leads_data) ? body.leads_data
      : Array.isArray(body?.leads) ? body.leads
        : [];
    const lead = leads[0] ?? body?.lead ?? {};
    return deepFreeze({
      kind: "tiktok_leadgen",
      leadId: safeString(lead.lead_id || lead.id),
      formId: safeString(lead.form_id || body?.form_id),
      advertiserId: safeString(lead.advertiser_id || body?.advertiser_id || process.env.TIKTOK_ADVERTISER_ID),
      createdTime: safeString(lead.create_time || lead.created_time),
      raw: deepFreeze(lead),
    });
  }

  async executeAction({ actionRequest } = {}) {
    const capability = safeString(actionRequest?.capability);
    const params = actionRequest?.parameters ?? {};

    if (capability === INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK || capability === INTEGRATION_CAPABILITIES.INGEST_FORM_SUBMISSION) {
      const normalized = this.normalizeWebhook({ body: params?.webhookBody ?? params ?? {} });
      return deepFreeze({
        externalReference: normalized.leadId || `tiktok_lead_${this._nowISO}`,
        status: "completed",
        completedAt: this._nowISO,
        metadata: normalized,
      });
    }

    if (capability === INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE) {
      if (!isTikTokMarketingApiConfigured()) {
        return deepFreeze({
          status: "failed",
          error: "not_configured",
          message: "TikTok Marketing API credentials (TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_ID) aren't set. TikTok ad performance reporting isn't available until VIBETech ops configures platform credentials.",
          completedAt: this._nowISO,
        });
      }
      try {
        const advertiserId = safeString(process.env.TIKTOK_ADVERTISER_ID);
        const startDate = safeString(params.since);
        const endDate = safeString(params.until);
        const query = new URLSearchParams({
          advertiser_id: advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: JSON.stringify(["campaign_id"]),
          metrics: JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "ctr"]),
          start_date: startDate,
          end_date: endDate,
          page_size: "100",
        });
        const res = await this._fetch(`${TIKTOK_API_BASE}/report/integrated/get/?${query.toString()}`, {
          headers: { "Access-Token": safeString(process.env.TIKTOK_ACCESS_TOKEN) },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || Number(data?.code) !== 0) {
          return deepFreeze({
            status: "failed",
            error: safeString(data?.message) || `tiktok_http_${res.status}`,
            retryable: res.status >= 500,
            completedAt: this._nowISO,
          });
        }
        return deepFreeze({
          externalReference: `tiktok_ads_report_${this._nowISO}`,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ list: Array.isArray(data?.data?.list) ? data.data.list : [] }),
        });
      } catch (err) {
        return deepFreeze({ status: "failed", error: String(err?.message ?? err), retryable: true, completedAt: this._nowISO });
      }
    }

    if (capability === INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN) {
      if (!actionRequest?.requiresApproval || !actionRequest?.outboundApproved) {
        return deepFreeze({ status: "failed", error: "owner_approval_required", completedAt: this._nowISO });
      }
      if (!isTikTokMarketingApiConfigured()) {
        return deepFreeze({
          status: "failed",
          error: "managed_ops_required",
          message: "TikTok Marketing API isn't configured yet. VIBETech ops will launch this campaign manually as part of the managed lead ads playbook.",
          completedAt: this._nowISO,
        });
      }
      const campaign = params.campaign && typeof params.campaign === "object" ? params.campaign : null;
      if (!campaign?.name) {
        return deepFreeze({ status: "failed", error: "approved_campaign_name_required", completedAt: this._nowISO });
      }
      try {
        const advertiserId = safeString(process.env.TIKTOK_ADVERTISER_ID);
        const res = await this._fetch(`${TIKTOK_API_BASE}/campaign/create/`, {
          method: "POST",
          headers: {
            "Access-Token": safeString(process.env.TIKTOK_ACCESS_TOKEN),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            advertiser_id: advertiserId,
            campaign_name: safeString(campaign.name),
            objective_type: safeString(campaign.objective || "LEAD_GENERATION"),
            budget_mode: safeString(campaign.budgetMode || "BUDGET_MODE_DAY"),
            budget: campaign.dailyBudget ?? 20,
            // Never permit an automated campaign to launch active.
            operation_status: "DISABLE",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || Number(data?.code) !== 0) {
          return deepFreeze({
            status: "failed",
            error: safeString(data?.message) || `tiktok_http_${res.status}`,
            retryable: res.status >= 500,
            completedAt: this._nowISO,
          });
        }
        const campaignId = safeString(data?.data?.campaign_id);
        return deepFreeze({
          externalReference: campaignId,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ campaignId, campaignStatus: "DISABLE", managedOps: true }),
        });
      } catch (err) {
        return deepFreeze({ status: "failed", error: String(err?.message ?? err), retryable: true, completedAt: this._nowISO });
      }
    }

    return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
  }
}
