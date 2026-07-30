import test from "node:test";
import assert from "node:assert/strict";

import { fetchAdsMetrics, normalizeDayRange } from "./AdsMetricsAggregator.js";

const NOW = "2026-07-30T00:00:00.000Z";

async function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function platformStoreWithRows(rows) {
  return { listIntegrationCredentialsForWorkspace: async () => rows };
}

test("normalizeDayRange only accepts 7 or 30, defaulting otherwise", () => {
  assert.equal(normalizeDayRange(7), 7);
  assert.equal(normalizeDayRange(30), 30);
  assert.equal(normalizeDayRange(90), 30);
  assert.equal(normalizeDayRange(undefined), 30);
});

test("all providers come back not_connected/not_configured with no credentials and no TikTok env", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const result = await fetchAdsMetrics({
      businessId: "biz_1",
      platformStore: platformStoreWithRows([]),
      days: 30,
      nowISO: NOW,
    });
    assert.equal(result.providers.length, 3);
    const byId = Object.fromEntries(result.providers.map((p) => [p.id, p]));
    assert.equal(byId.meta_ads.status, "not_connected");
    assert.deepEqual(byId.meta_ads.campaigns, []);
    assert.equal(byId.google_ads.status, "not_connected");
    assert.equal(byId.tiktok_ads.status, "not_configured");
    assert.equal(result.dateRange.days, 30);
  });
});

test("aggregates Meta Ads campaign metrics (spend/impressions/clicks/ctr/leads/cpl) from a connected credential", async () => {
  await withEnv({ META_GRAPH_API_VERSION: "v25.0" }, async () => {
    const fetchImpl = async (url) => {
      assert.match(String(url), /graph\.facebook\.com/);
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_id: "meta_1",
              campaign_name: "Spring promo",
              impressions: "1000",
              clicks: "50",
              spend: "200.5",
              actions: [{ action_type: "lead", value: "10" }],
            },
          ],
        }),
      };
    };
    const result = await fetchAdsMetrics({
      businessId: "biz_1",
      platformStore: platformStoreWithRows([
        { credentialId: "cred_meta", providerType: "meta_ads", secrets: { adAccountId: "123", accessToken: "tok" } },
      ]),
      days: 7,
      nowISO: NOW,
      fetchImpl,
    });
    const meta = result.providers.find((p) => p.id === "meta_ads");
    assert.equal(meta.status, "connected");
    assert.equal(meta.campaigns.length, 1);
    assert.equal(meta.campaigns[0].name, "Spring promo");
    assert.equal(meta.campaigns[0].leads, 10);
    assert.equal(meta.campaigns[0].cpl, 20.05);
    assert.equal(meta.totals.spend, 200.5);
    assert.equal(meta.totals.impressions, 1000);
    assert.equal(meta.totals.clicks, 50);
    assert.equal(meta.totals.ctr, 5);
    assert.equal(meta.totals.leads, 10);
    assert.equal(meta.totals.cpl, 20.05);
  });
});

test("Meta Ads reports not_configured when META_GRAPH_API_VERSION is missing even with a stored credential", async () => {
  await withEnv({ META_GRAPH_API_VERSION: undefined }, async () => {
    const result = await fetchAdsMetrics({
      businessId: "biz_1",
      platformStore: platformStoreWithRows([
        { credentialId: "cred_meta", providerType: "meta_ads", secrets: { adAccountId: "123", accessToken: "tok" } },
      ]),
      nowISO: NOW,
      fetchImpl: async () => { throw new Error("should not call Graph API"); },
    });
    const meta = result.providers.find((p) => p.id === "meta_ads");
    assert.equal(meta.status, "not_configured");
  });
});

test("aggregates Google Ads campaign metrics from the searchStream response", async () => {
  const fetchImpl = async (url) => {
    assert.match(String(url), /googleads\.googleapis\.com/);
    return {
      ok: true,
      json: async () => ([
        {
          results: [
            {
              campaign: { id: "google_1", name: "Search campaign", status: "ENABLED" },
              metrics: { clicks: "40", impressions: "2000", costMicros: "50000000", conversions: "8" },
            },
          ],
        },
      ]),
    };
  };
  const result = await fetchAdsMetrics({
    businessId: "biz_1",
    platformStore: platformStoreWithRows([
      { credentialId: "cred_google", providerType: "google_ads", secrets: { customerId: "123", developerToken: "dev", accessToken: "access" } },
    ]),
    nowISO: NOW,
    fetchImpl,
  });
  const google = result.providers.find((p) => p.id === "google_ads");
  assert.equal(google.status, "connected");
  assert.equal(google.campaigns.length, 1);
  assert.equal(google.campaigns[0].name, "Search campaign");
  assert.equal(google.campaigns[0].status, "ENABLED");
  assert.equal(google.campaigns[0].spend, 50);
  assert.equal(google.campaigns[0].leads, 8);
  assert.equal(google.totals.clicks, 40);
  assert.equal(google.totals.impressions, 2000);
});

test("TikTok Ads reads real campaign metrics once Marketing API env is configured", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    const fetchImpl = async (url) => {
      assert.match(String(url), /business-api\.tiktok\.com/);
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            list: [
              {
                dimensions: { campaign_id: "tt_1" },
                metrics: { campaign_name: "TikTok leads", spend: "75", impressions: "3000", clicks: "60", ctr: "2.0" },
              },
            ],
          },
        }),
      };
    };
    const result = await fetchAdsMetrics({
      businessId: "biz_1",
      platformStore: platformStoreWithRows([]),
      nowISO: NOW,
      fetchImpl,
    });
    const tiktok = result.providers.find((p) => p.id === "tiktok_ads");
    assert.equal(tiktok.status, "connected");
    assert.equal(tiktok.campaigns[0].name, "TikTok leads");
    assert.equal(tiktok.campaigns[0].spend, 75);
    assert.equal(tiktok.totals.impressions, 3000);
  });
});

test("provider errors surface as status=error with a message instead of throwing", async () => {
  await withEnv({ META_GRAPH_API_VERSION: "v25.0" }, async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "invalid token" } }) });
    const result = await fetchAdsMetrics({
      businessId: "biz_1",
      platformStore: platformStoreWithRows([
        { credentialId: "cred_meta", providerType: "meta_ads", secrets: { adAccountId: "123", accessToken: "bad_tok" } },
      ]),
      nowISO: NOW,
      fetchImpl,
    });
    const meta = result.providers.find((p) => p.id === "meta_ads");
    assert.equal(meta.status, "error");
    assert.match(meta.message, /invalid token/);
  });
});
