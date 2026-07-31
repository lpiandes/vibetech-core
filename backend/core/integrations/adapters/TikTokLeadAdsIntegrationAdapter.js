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
 * Platform-level TikTok Marketing API access token / advertiser id — the
 * VIBETech-ops-managed fallback used when a business hasn't connected its own
 * TikTok Ads credential. `TIKTOK_ADS_ACCESS_TOKEN`/`TIKTOK_ADS_ADVERTISER_ID`
 * are accepted as aliases of `TIKTOK_ACCESS_TOKEN`/`TIKTOK_ADVERTISER_ID` so
 * ops can name the env vars either way.
 */
function platformAccessToken() {
  return safeString(process.env.TIKTOK_ACCESS_TOKEN) || safeString(process.env.TIKTOK_ADS_ACCESS_TOKEN);
}

function platformAdvertiserId() {
  return safeString(process.env.TIKTOK_ADVERTISER_ID) || safeString(process.env.TIKTOK_ADS_ADVERTISER_ID);
}

/**
 * TikTok Marketing API credentials for VIBETech-managed campaign creation.
 * This checks the platform-level (not per-business) env credential only —
 * see `isTikTokMarketingApiUsable` for the combined per-business-or-platform
 * check the adapter itself uses.
 */
export function isTikTokMarketingApiConfigured() {
  return Boolean(platformAccessToken() && platformAdvertiserId());
}

/** Overall "is TikTok lead ads usable at all" gate for provider registration. */
export function isTikTokLeadAdsConfigured() {
  return isTikTokLeadAdsWebhookConfigured() || isTikTokMarketingApiConfigured();
}

/** Resolve a per-business TikTok Ads credential via the connection's credentialResolver, if any. */
function resolveConnectionCreds({ connection, credentialResolver }) {
  if (!connection?.credentialReference || !credentialResolver) return null;
  let value;
  try {
    value = credentialResolver.resolve(connection.credentialReference);
  } catch {
    return null;
  }
  const accessToken = safeString(value?.accessToken || value?.access_token);
  const advertiserId = safeString(value?.advertiserId || value?.advertiser_id);
  if (!accessToken || !advertiserId) return null;
  return { accessToken, advertiserId, source: "connection" };
}

function resolvePlatformCreds() {
  const accessToken = platformAccessToken();
  const advertiserId = platformAdvertiserId();
  if (!accessToken || !advertiserId) return null;
  return { accessToken, advertiserId, source: "platform_env" };
}

/**
 * Prefer a business's own connected TikTok Ads credential; fall back to the
 * VIBETech-managed platform credential (env vars) when the business hasn't
 * connected one yet. Either path is enough to consider TikTok Ads "usable".
 */
function resolveCreds({ connection, credentialResolver }) {
  return resolveConnectionCreds({ connection, credentialResolver }) || resolvePlatformCreds();
}

/** Human-readable list of exactly what's missing, for clear not_configured errors. */
function describeMissingCreds({ connection, credentialResolver }) {
  const missing = [];
  if (connection?.credentialReference && credentialResolver) {
    let value = null;
    try {
      value = credentialResolver.resolve(connection.credentialReference);
    } catch (err) {
      missing.push(`connected TikTok Ads credential could not be resolved (${String(err?.message ?? err)})`);
    }
    if (value) {
      const fields = [];
      if (!safeString(value?.accessToken || value?.access_token)) fields.push("access token");
      if (!safeString(value?.advertiserId || value?.advertiser_id)) fields.push("advertiser id");
      if (fields.length) missing.push(`connected TikTok Ads credential is missing ${fields.join(" and ")}`);
    }
  } else {
    missing.push("no per-business TikTok Ads connection");
  }
  const envMissing = [];
  if (!platformAccessToken()) envMissing.push("TIKTOK_ACCESS_TOKEN (or TIKTOK_ADS_ACCESS_TOKEN)");
  if (!platformAdvertiserId()) envMissing.push("TIKTOK_ADVERTISER_ID (or TIKTOK_ADS_ADVERTISER_ID)");
  if (envMissing.length) missing.push(`platform fallback env not set: ${envMissing.join(", ")}`);
  return missing;
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
      // Owner-gated activation — see #activateCampaign. Refuses unless both
      // ownerApproved and confirmActivate are explicit; never automatic.
      INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN,
    ];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "VIBETech-managed TikTok lead ads",
      summary: "VIBETech ops runs TikTok lead-form ads on your behalf as part of the managed lead ads playbook. Connect your own TikTok Ads access token + advertiser ID below, or VIBETech ops can run campaigns on the platform-managed credential (env: TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID, aka TIKTOK_ADS_ACCESS_TOKEN / TIKTOK_ADS_ADVERTISER_ID) until you connect your own.",
      estimatedTime: "Managed by VIBETech ops",
      prerequisites: ["TikTok Business Center account", "TikTok Ads Manager advertiser ID", "Lead Generation objective enabled on the advertiser account"],
      steps: [
        "Connect your own TikTok Ads access token + advertiser ID (preferred), or ask VIBETech ops to configure the platform-managed credential",
        "VIBETech ops scaffolds a paused campaign for your offer/creative brief",
        "Owner reviews the paused campaign and approves the budget",
        "VIBETech ops (or the owner) activates the campaign in TikTok Ads Manager, or via the ACTIVATE_AD_CAMPAIGN action (requires ownerApproved + confirmActivate)",
        "New lead-form submissions webhook into the same appointment-setter pipeline as Meta leads",
      ],
      permissionsRequested: ["ads_management", "leads_retrieval"],
      verificationMethod: "TikTok Marketing API advertiser probe (per-business credential, or platform credential if not connected).",
      commonProblems: [
        "Neither a per-business connection nor platform TIKTOK_ACCESS_TOKEN/TIKTOK_ADVERTISER_ID env is configured",
        "Advertiser account missing Lead Generation objective",
        "ACTIVATE_AD_CAMPAIGN refuses without both ownerApproved and confirmActivate set explicitly",
      ],
      reconnectInstructions: "Reconnect with a fresh TikTok Ads access token, or contact VIBETech ops to refresh the platform Business Center credential.",
      documentationReference: "https://business-api.tiktok.com/portal/docs",
    });
  }

  async healthCheck({ connection, credentialResolver } = {}) {
    const creds = resolveCreds({ connection, credentialResolver });
    if (!creds) {
      return {
        status: "not_configured",
        providerId: this.id,
        message: `TikTok Marketing API credentials aren't available yet (${describeMissingCreds({ connection, credentialResolver }).join("; ")}).`,
        missing: describeMissingCreds({ connection, credentialResolver }),
      };
    }
    return { status: "requires_connection", providerId: this.id, credentialSource: creds.source };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    const creds = resolveCreds({ connection, credentialResolver });
    if (!creds) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "not_configured",
        message: `TikTok Marketing API credentials are not configured (${describeMissingCreds({ connection, credentialResolver }).join("; ")}).`,
      });
    }
    try {
      const res = await this._fetch(
        `${TIKTOK_API_BASE}/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([creds.advertiserId]))}`,
        { headers: { "Access-Token": creds.accessToken } },
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
      advertiserId: safeString(lead.advertiser_id || body?.advertiser_id || platformAdvertiserId()),
      createdTime: safeString(lead.create_time || lead.created_time),
      raw: deepFreeze(lead),
    });
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
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
      const creds = resolveCreds({ connection, credentialResolver });
      if (!creds) {
        return deepFreeze({
          status: "failed",
          error: "not_configured",
          message: `TikTok ad performance reporting isn't available yet (${describeMissingCreds({ connection, credentialResolver }).join("; ")}).`,
          completedAt: this._nowISO,
        });
      }
      try {
        const startDate = safeString(params.since);
        const endDate = safeString(params.until);
        const query = new URLSearchParams({
          advertiser_id: creds.advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: JSON.stringify(["campaign_id"]),
          metrics: JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "ctr"]),
          start_date: startDate,
          end_date: endDate,
          page_size: "100",
        });
        const res = await this._fetch(`${TIKTOK_API_BASE}/report/integrated/get/?${query.toString()}`, {
          headers: { "Access-Token": creds.accessToken },
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
          metadata: deepFreeze({ list: Array.isArray(data?.data?.list) ? data.data.list : [], credentialSource: creds.source }),
        });
      } catch (err) {
        return deepFreeze({ status: "failed", error: String(err?.message ?? err), retryable: true, completedAt: this._nowISO });
      }
    }

    if (capability === INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN) {
      if (!actionRequest?.requiresApproval || !actionRequest?.outboundApproved) {
        return deepFreeze({ status: "failed", error: "owner_approval_required", completedAt: this._nowISO });
      }
      const creds = resolveCreds({ connection, credentialResolver });
      if (!creds) {
        return deepFreeze({
          status: "failed",
          error: "managed_ops_required",
          message: `TikTok Marketing API isn't configured yet (${describeMissingCreds({ connection, credentialResolver }).join("; ")}). VIBETech ops will launch this campaign manually as part of the managed lead ads playbook.`,
          completedAt: this._nowISO,
        });
      }
      const campaign = params.campaign && typeof params.campaign === "object" ? params.campaign : null;
      if (!campaign?.name) {
        return deepFreeze({ status: "failed", error: "approved_campaign_name_required", completedAt: this._nowISO });
      }
      try {
        const res = await this._fetch(`${TIKTOK_API_BASE}/campaign/create/`, {
          method: "POST",
          headers: {
            "Access-Token": creds.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            advertiser_id: creds.advertiserId,
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
          metadata: deepFreeze({ campaignId, campaignStatus: "DISABLE", managedOps: creds.source === "platform_env" }),
        });
      } catch (err) {
        return deepFreeze({ status: "failed", error: String(err?.message ?? err), retryable: true, completedAt: this._nowISO });
      }
    }

    if (capability === INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN) {
      // The only place spend can actually start — requires BOTH flags
      // explicitly, never inferred from requiresApproval/outboundApproved,
      // and never called by any automated playbook step.
      if (params?.ownerApproved !== true || params?.confirmActivate !== true) {
        return deepFreeze({
          status: "failed",
          error: "explicit_owner_activation_required",
          message: "Activating a TikTok campaign requires both ownerApproved: true and confirmActivate: true — this is never automatic.",
          completedAt: this._nowISO,
        });
      }
      const creds = resolveCreds({ connection, credentialResolver });
      if (!creds) {
        return deepFreeze({
          status: "failed",
          error: "not_configured",
          message: `Cannot activate — TikTok Marketing API credentials aren't available (${describeMissingCreds({ connection, credentialResolver }).join("; ")}).`,
          completedAt: this._nowISO,
        });
      }
      const campaignId = safeString(params.campaignId);
      if (!campaignId) {
        return deepFreeze({ status: "failed", error: "campaignId_required", completedAt: this._nowISO });
      }
      try {
        const res = await this._fetch(`${TIKTOK_API_BASE}/campaign/status/update/`, {
          method: "POST",
          headers: { "Access-Token": creds.accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            advertiser_id: creds.advertiserId,
            campaign_ids: [campaignId],
            operation_status: "ENABLE",
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
        return deepFreeze({
          externalReference: campaignId,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ campaignId, campaignStatus: "ENABLE", activatedBy: "owner_approved_explicit_confirmation" }),
        });
      } catch (err) {
        return deepFreeze({ status: "failed", error: String(err?.message ?? err), retryable: true, completedAt: this._nowISO });
      }
    }

    return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
  }
}
