import { MetaAdsIntegrationAdapter } from "../adapters/MetaAdsIntegrationAdapter.js";
import { GoogleAdsIntegrationAdapter } from "../adapters/GoogleAdsIntegrationAdapter.js";
import { TikTokLeadAdsIntegrationAdapter } from "../adapters/TikTokLeadAdsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const SUPPORTED_DAY_RANGES = Object.freeze([7, 30]);

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function computeCtr(clicks, impressions) {
  return impressions > 0 ? round2((clicks / impressions) * 100) : 0;
}

function computeCpl(spend, leads) {
  return leads > 0 ? round2(spend / leads) : null;
}

/** Normalize the requested `days` query param — only 7 and 30 are supported today. */
export function normalizeDayRange(days) {
  const n = Number(days);
  return SUPPORTED_DAY_RANGES.includes(n) ? n : 30;
}

function dateRangeForDays(days, nowISO) {
  const end = new Date(nowISO);
  const until = end.toISOString().slice(0, 10);
  const start = new Date(end.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const since = start.toISOString().slice(0, 10);
  return { since, until };
}

function emptyTotals() {
  return { spend: 0, impressions: 0, clicks: 0, ctr: 0 };
}

/** Sum campaign metrics into provider totals. leads/cpl only appear when at least one campaign reported real leads. */
function sumTotals(campaigns) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += toNumber(c.spend);
      acc.impressions += toNumber(c.impressions);
      acc.clicks += toNumber(c.clicks);
      if (typeof c.leads === "number") acc.leads = (acc.leads ?? 0) + c.leads;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0 },
  );
  const result = {
    spend: round2(totals.spend),
    impressions: totals.impressions,
    clicks: totals.clicks,
    ctr: computeCtr(totals.clicks, totals.impressions),
  };
  if (typeof totals.leads === "number") {
    result.leads = round2(totals.leads);
    result.cpl = computeCpl(result.spend, result.leads);
  }
  return result;
}

/** Credential resolver backed directly by `platformStore.listIntegrationCredentialsForWorkspace` rows — no vault hydration required for a read-only metrics pull. */
function credentialResolverFor(rows) {
  return {
    resolve(ref) {
      const row = rows.find((r) => String(r.credentialId) === String(ref?.credentialId));
      if (!row) throw new Error(`AdsMetricsAggregator: credential not found: ${ref?.credentialId}`);
      return { ...(row.secrets ?? {}), metadata: row.metadata ?? {} };
    },
  };
}

function extractGoogleAdsRows(payload) {
  if (Array.isArray(payload)) return payload.flatMap((chunk) => extractGoogleAdsRows(chunk));
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

function normalizeMetaCampaign(row = {}) {
  const impressions = toNumber(row.impressions);
  const clicks = toNumber(row.clicks);
  const spend = round2(row.spend);
  const campaign = {
    id: text(row.campaign_id),
    name: text(row.campaign_name) || text(row.campaign_id) || "Untitled campaign",
    status: null,
    spend,
    impressions,
    clicks,
    ctr: computeCtr(clicks, impressions),
  };
  const leadAction = Array.isArray(row.actions)
    ? row.actions.find((a) => /lead/i.test(text(a?.action_type)))
    : null;
  if (leadAction) {
    const leads = toNumber(leadAction.value);
    campaign.leads = leads;
    campaign.cpl = computeCpl(spend, leads);
  }
  return campaign;
}

function normalizeGoogleCampaign(row = {}) {
  const campaign = row.campaign ?? {};
  const metrics = row.metrics ?? {};
  const impressions = toNumber(metrics.impressions);
  const clicks = toNumber(metrics.clicks);
  const costMicros = toNumber(metrics.costMicros ?? metrics.cost_micros);
  const spend = round2(costMicros / 1_000_000);
  const normalized = {
    id: text(campaign.id),
    name: text(campaign.name) || text(campaign.id) || "Untitled campaign",
    status: text(campaign.status) || null,
    spend,
    impressions,
    clicks,
    ctr: computeCtr(clicks, impressions),
  };
  if (metrics.conversions !== undefined && metrics.conversions !== null) {
    const leads = toNumber(metrics.conversions);
    normalized.leads = leads;
    normalized.cpl = computeCpl(spend, leads);
  }
  return normalized;
}

function normalizeTikTokCampaign(row = {}) {
  const dims = row.dimensions ?? {};
  const metrics = row.metrics ?? {};
  const impressions = toNumber(metrics.impressions);
  const clicks = toNumber(metrics.clicks);
  const spend = round2(metrics.spend);
  return {
    id: text(dims.campaign_id),
    name: text(metrics.campaign_name) || text(dims.campaign_id) || "Untitled campaign",
    status: null,
    spend,
    impressions,
    clicks,
    ctr: computeCtr(clicks, impressions),
  };
}

function providerResult({ id, label, status, message = null, totals = emptyTotals(), campaigns = [] }) {
  const out = { id, label, status, totals, campaigns };
  if (message) out.message = message;
  return out;
}

async function fetchMetaProvider({ rows, since, until, fetchImpl, nowISO }) {
  const id = "meta_ads";
  const label = "Meta Ads";
  const row = rows.find((r) => String(r.providerType) === "meta_ads");
  if (!row) {
    return providerResult({ id, label, status: "not_connected" });
  }
  const adapter = new MetaAdsIntegrationAdapter({ fetchImpl, nowISO });
  const health = await adapter.healthCheck();
  if (health.status === "not_configured") {
    return providerResult({
      id,
      label,
      status: "not_configured",
      message: "Set META_GRAPH_API_VERSION to enable Meta Ads reporting.",
    });
  }
  try {
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
        parameters: {
          fields: "campaign_id,campaign_name,impressions,clicks,spend,actions",
          since,
          until,
          level: "campaign",
        },
      },
      connection: { credentialReference: { credentialId: row.credentialId } },
      credentialResolver: credentialResolverFor(rows),
    });
    if (result.status !== "completed") {
      return providerResult({
        id,
        label,
        status: "error",
        message: result.error ?? "Could not load Meta Ads metrics.",
      });
    }
    const campaigns = (result.metadata?.data ?? []).map(normalizeMetaCampaign);
    return providerResult({ id, label, status: "connected", totals: sumTotals(campaigns), campaigns });
  } catch (err) {
    return providerResult({ id, label, status: "error", message: String(err?.message ?? err) });
  }
}

async function fetchGoogleProvider({ rows, since, until, fetchImpl, nowISO }) {
  const id = "google_ads";
  const label = "Google Ads";
  const row = rows.find((r) => String(r.providerType) === "google_ads");
  if (!row) {
    return providerResult({ id, label, status: "not_connected" });
  }
  const adapter = new GoogleAdsIntegrationAdapter({ fetchImpl, nowISO });
  try {
    const query = `SELECT campaign.id, campaign.name, campaign.status, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`;
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
        parameters: { query },
      },
      connection: { credentialReference: { credentialId: row.credentialId } },
      credentialResolver: credentialResolverFor(rows),
    });
    if (result.status !== "completed") {
      return providerResult({
        id,
        label,
        status: "error",
        message: result.error ?? "Could not load Google Ads metrics.",
      });
    }
    const campaigns = extractGoogleAdsRows(result.metadata?.results).map(normalizeGoogleCampaign);
    return providerResult({ id, label, status: "connected", totals: sumTotals(campaigns), campaigns });
  } catch (err) {
    return providerResult({ id, label, status: "error", message: String(err?.message ?? err) });
  }
}

async function fetchTikTokProvider({ rows, since, until, fetchImpl, nowISO }) {
  const id = "tiktok_ads";
  const label = "TikTok Ads";
  // TikTok Ads shares its connection with the lead-ads adapter
  // (supportedConnectionTypes: ["tiktok_lead_ads"]) — a business's own
  // connected credential takes priority; the platform env credential
  // (isTikTokMarketingApiConfigured) is the VIBETech-managed fallback.
  const row = rows.find((r) => String(r.providerType) === "tiktok_lead_ads");
  const connection = row ? { credentialReference: { credentialId: row.credentialId } } : null;
  const credentialResolver = row ? credentialResolverFor(rows) : null;
  const adapter = new TikTokLeadAdsIntegrationAdapter({ fetchImpl, nowISO });
  const health = await adapter.healthCheck({ connection, credentialResolver });
  if (health.status === "not_configured") {
    return providerResult({
      id,
      label,
      status: "not_configured",
      message: health.message || "TikTok Marketing API isn't configured yet. Ad performance reporting isn't available until a business credential or VIBETech ops platform credential is set up.",
    });
  }
  try {
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
        parameters: { since, until },
      },
      connection,
      credentialResolver,
    });
    if (result.status !== "completed") {
      return providerResult({
        id,
        label,
        status: "error",
        message: result.error ?? "Could not load TikTok Ads metrics.",
      });
    }
    const campaigns = (result.metadata?.list ?? []).map(normalizeTikTokCampaign);
    return providerResult({ id, label, status: "connected", totals: sumTotals(campaigns), campaigns });
  } catch (err) {
    return providerResult({ id, label, status: "error", message: String(err?.message ?? err) });
  }
}

/**
 * Pull ad performance from every connected ads provider for a workspace and
 * normalize into a single shape the Ads dashboard can render directly.
 * Never fakes numbers — providers without a stored credential (or without
 * platform config, for TikTok) come back `not_connected` / `not_configured`
 * with empty totals/campaigns instead of synthetic data.
 *
 * @param {{
 *   businessId: string,
 *   platformStore: { listIntegrationCredentialsForWorkspace: (workspaceId: string) => Promise<any[]> },
 *   days?: 7|30,
 *   nowISO?: string,
 *   fetchImpl?: typeof fetch,
 * }} input
 */
export async function fetchAdsMetrics({
  businessId,
  platformStore,
  days = 30,
  nowISO = new Date().toISOString(),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!businessId) throw new Error("fetchAdsMetrics requires businessId.");
  if (!platformStore?.listIntegrationCredentialsForWorkspace) {
    throw new Error("fetchAdsMetrics requires platformStore.listIntegrationCredentialsForWorkspace.");
  }
  const normalizedDays = normalizeDayRange(days);
  const { since, until } = dateRangeForDays(normalizedDays, nowISO);
  const rawRows = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
  const rows = Array.isArray(rawRows) ? rawRows : [];

  const [meta, google, tiktok] = await Promise.all([
    fetchMetaProvider({ rows, since, until, fetchImpl, nowISO }),
    fetchGoogleProvider({ rows, since, until, fetchImpl, nowISO }),
    fetchTikTokProvider({ rows, since, until, fetchImpl, nowISO }),
  ]);

  return deepFreeze({
    dateRange: { since, until, days: normalizedDays },
    providers: [meta, google, tiktok],
  });
}
