import test from "node:test";
import assert from "node:assert/strict";

import {
  TikTokLeadAdsIntegrationAdapter,
  isTikTokLeadAdsConfigured,
  isTikTokMarketingApiConfigured,
} from "./TikTokLeadAdsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

const NOW = "2026-07-30T00:00:00.000Z";

function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("TikTok lead ads health is not_configured without platform Marketing API env", async () => {
  await withEnv(
    { TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined, TIKTOK_APP_ID: undefined, TIKTOK_APP_SECRET: undefined, TIKTOK_WEBHOOK_VERIFY_TOKEN: undefined },
    async () => {
      assert.equal(isTikTokLeadAdsConfigured(), false);
      assert.equal(isTikTokMarketingApiConfigured(), false);
      const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
      const health = await adapter.healthCheck();
      assert.equal(health.status, "not_configured");
    },
  );
});

test("TikTok lead ads reports requires_connection once Marketing API env is set", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    assert.equal(isTikTokMarketingApiConfigured(), true);
    assert.equal(isTikTokLeadAdsConfigured(), true);
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const health = await adapter.healthCheck();
    assert.equal(health.status, "requires_connection");
  });
});

test("TikTok campaign create returns managed_ops_required when Marketing API is not configured", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
        requiresApproval: true,
        outboundApproved: true,
        parameters: { campaign: { name: "Managed lead ads test" } },
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.error, "managed_ops_required");
  });
});

test("TikTok campaign create refuses without owner approval even when configured", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
        requiresApproval: false,
        outboundApproved: false,
        parameters: { campaign: { name: "Managed lead ads test" } },
      },
    });
    assert.equal(result.error, "owner_approval_required");
  });
});

test("TikTok campaign create sends a paused (DISABLE) campaign when configured and approved", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    let payload = null;
    const adapter = new TikTokLeadAdsIntegrationAdapter({
      nowISO: NOW,
      fetchImpl: async (_url, init) => {
        payload = JSON.parse(init.body);
        return { ok: true, json: async () => ({ code: 0, data: { campaign_id: "tt_campaign_1" } }) };
      },
    });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
        requiresApproval: true,
        outboundApproved: true,
        parameters: { campaign: { name: "Managed lead ads test" } },
      },
    });
    assert.equal(result.status, "completed");
    assert.equal(payload.operation_status, "DISABLE");
    assert.equal(result.externalReference, "tt_campaign_1");
  });
});

test("TikTok adapter normalizes lead webhook payloads", () => {
  const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
  const normalized = adapter.normalizeWebhook({
    body: { leads_data: [{ lead_id: "lead_1", form_id: "form_1", create_time: "2026-07-30T00:00:00.000Z" }] },
  });
  assert.equal(normalized.leadId, "lead_1");
  assert.equal(normalized.formId, "form_1");
});

test("TikTok adapter supports RECEIVE_WEBHOOK / INGEST_FORM_SUBMISSION / CREATE_AD_CAMPAIGN / READ_AD_PERFORMANCE / ACTIVATE_AD_CAMPAIGN", () => {
  const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
  assert.deepEqual(
    [...adapter.supportedCapabilities].sort(),
    [
      INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN,
      INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
      INTEGRATION_CAPABILITIES.INGEST_FORM_SUBMISSION,
      INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
      INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK,
    ].sort(),
  );
});

test("TikTok ad performance reporting is not_configured without platform Marketing API env", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
        parameters: { since: "2026-07-01", until: "2026-07-30" },
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.error, "not_configured");
  });
});

test("TikTok health is healthy from a per-business connection even without platform env", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const connection = { credentialReference: { credentialId: "cred_1" } };
    const credentialResolver = { resolve: () => ({ accessToken: "biz_tok", advertiserId: "biz_adv_1" }) };
    const health = await adapter.healthCheck({ connection, credentialResolver });
    assert.equal(health.status, "requires_connection");
    assert.equal(health.credentialSource, "connection");
  });
});

test("TikTok health prefers the per-business connection over platform env when both exist", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "platform_tok", TIKTOK_ADVERTISER_ID: "platform_adv" }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const connection = { credentialReference: { credentialId: "cred_1" } };
    const credentialResolver = { resolve: () => ({ accessToken: "biz_tok", advertiserId: "biz_adv_1" }) };
    const health = await adapter.healthCheck({ connection, credentialResolver });
    assert.equal(health.credentialSource, "connection");
  });
});

test("TikTok health is not_configured with a clear reason when neither per-business nor platform creds exist", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const health = await adapter.healthCheck({});
    assert.equal(health.status, "not_configured");
    assert.ok(health.missing.some((m) => /no per-business TikTok Ads connection/.test(m)));
    assert.ok(health.missing.some((m) => /TIKTOK_ACCESS_TOKEN/.test(m)));
  });
});

test("TikTok health surfaces exactly what's missing when a connection exists but lacks an advertiser id", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW });
    const connection = { credentialReference: { credentialId: "cred_1" } };
    const credentialResolver = { resolve: () => ({ accessToken: "biz_tok" }) }; // no advertiserId
    const health = await adapter.healthCheck({ connection, credentialResolver });
    assert.equal(health.status, "not_configured");
    assert.ok(health.missing.some((m) => /missing advertiser id/.test(m)));
  });
});

test("TikTok campaign create uses the per-business credential when connected, ignoring platform env", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "platform_tok", TIKTOK_ADVERTISER_ID: "platform_adv" }, async () => {
    let capturedHeaders = null;
    let payload = null;
    const adapter = new TikTokLeadAdsIntegrationAdapter({
      nowISO: NOW,
      fetchImpl: async (_url, init) => {
        capturedHeaders = init.headers;
        payload = JSON.parse(init.body);
        return { ok: true, json: async () => ({ code: 0, data: { campaign_id: "tt_campaign_biz" } }) };
      },
    });
    const connection = { credentialReference: { credentialId: "cred_1" } };
    const credentialResolver = { resolve: () => ({ accessToken: "biz_tok", advertiserId: "biz_adv_1" }) };
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN,
        requiresApproval: true,
        outboundApproved: true,
        parameters: { campaign: { name: "Owned business campaign" } },
      },
      connection,
      credentialResolver,
    });
    assert.equal(result.status, "completed");
    assert.equal(payload.advertiser_id, "biz_adv_1");
    assert.equal(capturedHeaders["Access-Token"], "biz_tok");
    assert.equal(result.metadata.managedOps, false, "not VIBETech-managed when using the business's own credential");
  });
});

test("TikTok refuses ACTIVATE_AD_CAMPAIGN without both ownerApproved and confirmActivate", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW, fetchImpl: async () => { throw new Error("should not call TikTok API"); } });

    const missingBoth = await adapter.executeAction({
      actionRequest: { capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN, parameters: { campaignId: "tt_campaign_1" } },
    });
    assert.equal(missingBoth.error, "explicit_owner_activation_required");

    const missingConfirm = await adapter.executeAction({
      actionRequest: { capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN, parameters: { campaignId: "tt_campaign_1", ownerApproved: true } },
    });
    assert.equal(missingConfirm.error, "explicit_owner_activation_required");

    const missingOwnerApproval = await adapter.executeAction({
      actionRequest: { capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN, parameters: { campaignId: "tt_campaign_1", confirmActivate: true } },
    });
    assert.equal(missingOwnerApproval.error, "explicit_owner_activation_required");
  });
});

test("TikTok activates a campaign only with explicit ownerApproved + confirmActivate", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    let payload = null;
    const adapter = new TikTokLeadAdsIntegrationAdapter({
      nowISO: NOW,
      fetchImpl: async (url, init) => {
        assert.match(String(url), /campaign\/status\/update/);
        payload = JSON.parse(init.body);
        return { ok: true, json: async () => ({ code: 0, data: {} }) };
      },
    });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN,
        parameters: { campaignId: "tt_campaign_1", ownerApproved: true, confirmActivate: true },
      },
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(payload.campaign_ids, ["tt_campaign_1"]);
    assert.equal(payload.operation_status, "ENABLE");
    assert.equal(result.metadata.campaignStatus, "ENABLE");
  });
});

test("TikTok activation surfaces not_configured when credentials aren't available even with both confirm flags", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: undefined, TIKTOK_ADVERTISER_ID: undefined }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({ nowISO: NOW, fetchImpl: async () => { throw new Error("should not call TikTok API"); } });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN,
        parameters: { campaignId: "tt_campaign_1", ownerApproved: true, confirmActivate: true },
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.error, "not_configured");
  });
});

test("TikTok ad performance reporting returns normalized campaign rows when configured", async () => {
  await withEnv({ TIKTOK_ACCESS_TOKEN: "tok", TIKTOK_ADVERTISER_ID: "adv_1" }, async () => {
    const adapter = new TikTokLeadAdsIntegrationAdapter({
      nowISO: NOW,
      fetchImpl: async (url) => {
        assert.match(String(url), /report\/integrated\/get/);
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: { list: [{ dimensions: { campaign_id: "tt_1" }, metrics: { campaign_name: "Leads", spend: "10", impressions: "100", clicks: "5", ctr: "5.0" } }] },
          }),
        };
      },
    });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_AD_PERFORMANCE,
        parameters: { since: "2026-07-01", until: "2026-07-30" },
      },
    });
    assert.equal(result.status, "completed");
    assert.equal(result.metadata.list.length, 1);
    assert.equal(result.metadata.list[0].metrics.campaign_name, "Leads");
  });
});
