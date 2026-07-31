import test from "node:test";
import assert from "node:assert/strict";
import { GoogleSearchConsoleIntegrationAdapter } from "./GoogleSearchConsoleIntegrationAdapter.js";
import { GoogleAdsIntegrationAdapter } from "./GoogleAdsIntegrationAdapter.js";
import { MetaAdsIntegrationAdapter } from "./MetaAdsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

const NOW = "2026-07-17T00:00:00.000Z";
const connection = (credentialId = "cred") => ({ credentialReference: { credentialId } });
const resolver = (value) => ({ resolve: () => value });

test("Search Console reads performance only after a verified website connection", async () => {
  const adapter = new GoogleSearchConsoleIntegrationAdapter({ nowISO: NOW, searchConsoleClient: {
    sites: { list: async () => ({ data: { siteEntry: [] } }) },
    searchanalytics: { query: async () => ({ data: { rows: [{ keys: ["dentist near me"], clicks: 3 }] } }) },
  } });
  assert.equal((await adapter.verifyConnection({ connection: connection(), credentialResolver: resolver({}) })).status, "success");
  const result = await adapter.executeAction({ actionRequest: { capability: INTEGRATION_CAPABILITIES.READ_SEARCH_PERFORMANCE, parameters: { siteUrl: "https://example.com/", startDate: "2026-07-01", endDate: "2026-07-16" } }, connection: connection(), credentialResolver: resolver({}) });
  assert.equal(result.status, "completed");
  assert.equal(result.metadata.rows[0].clicks, 3);
});

test("Google Ads refuses campaign creation unless the external action has owner approval", async () => {
  const calls = [];
  const adapter = new GoogleAdsIntegrationAdapter({ nowISO: NOW, fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ mutateOperationResponses: [{ campaignResult: { resourceName: "customers/123/campaigns/456" } }] }) }; } });
  const result = await adapter.executeAction({ actionRequest: { capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN, requiresApproval: false, outboundApproved: false, parameters: { mutateOperations: [{ campaignOperation: { create: {} } }] } }, connection: connection(), credentialResolver: resolver({ customerId: "123", developerToken: "dev", accessToken: "access" }) });
  assert.equal(result.error, "owner_approval_required");
  assert.equal(calls.length, 0);
});

test("Google Ads sends approved mutations to the configured API version", async () => {
  const calls = [];
  const adapter = new GoogleAdsIntegrationAdapter({ nowISO: NOW, apiVersion: "v24", fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ mutateOperationResponses: [{ campaignResult: { resourceName: "customers/123/campaigns/456" } }] }) }; } });
  const result = await adapter.executeAction({ actionRequest: { capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN, requiresApproval: true, outboundApproved: true, parameters: { mutateOperations: [{ campaignOperation: { create: { name: "Test" } } }] } }, connection: connection(), credentialResolver: resolver({ customerId: "123", developerToken: "dev", accessToken: "access" }) });
  assert.equal(result.status, "completed");
  assert.match(calls[0].url, /\/v24\/customers\/123:mutate$/);
});

test("Meta Ads always creates an approved campaign as PAUSED", async () => {
  let payload = null;
  const adapter = new MetaAdsIntegrationAdapter({ nowISO: NOW, graphApiVersion: "v25.0", fetchImpl: async (_url, init) => { payload = JSON.parse(init.body); return { ok: true, json: async () => ({ id: "meta_campaign_1" }) }; } });
  const result = await adapter.executeAction({ actionRequest: { capability: INTEGRATION_CAPABILITIES.CREATE_AD_CAMPAIGN, requiresApproval: true, outboundApproved: true, parameters: { campaign: { name: "Test", objective: "OUTCOME_LEADS", status: "ACTIVE" } } }, connection: connection(), credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }) });
  assert.equal(result.status, "completed");
  assert.equal(payload.status, "PAUSED");
});

test("Meta Ads refuses lead campaign scaffolding without owner approval", async () => {
  const adapter = new MetaAdsIntegrationAdapter({ nowISO: NOW, graphApiVersion: "v25.0", fetchImpl: async () => { throw new Error("should not call Graph API"); } });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
      requiresApproval: false,
      outboundApproved: false,
      parameters: { recordType: "lead_campaign_scaffold", campaign: { name: "Test" } },
    },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(result.error, "owner_approval_required");
});

test("Meta Ads scaffolds a paused campaign + ad set + creative for managed lead ads", async () => {
  const calls = [];
  const adapter = new MetaAdsIntegrationAdapter({
    nowISO: NOW,
    graphApiVersion: "v25.0",
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url: String(url), body });
      if (String(url).includes("/campaigns")) return { ok: true, json: async () => ({ id: "meta_campaign_1" }) };
      if (String(url).includes("/adsets")) return { ok: true, json: async () => ({ id: "meta_adset_1" }) };
      if (String(url).includes("/adcreatives")) return { ok: true, json: async () => ({ id: "meta_creative_1" }) };
      return { ok: false, json: async () => ({ error: { message: "unexpected_call" } }) };
    },
  });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
      requiresApproval: true,
      outboundApproved: true,
      parameters: {
        recordType: "lead_campaign_scaffold",
        campaign: { name: "Managed lead ads test" },
        adSet: { name: "Ad set", dailyBudgetCents: 2500 },
        creative: { name: "Creative", pageId: "page_1", leadFormId: "form_1" },
      },
    },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.metadata.campaignId, "meta_campaign_1");
  assert.equal(result.metadata.campaignStatus, "PAUSED");
  assert.equal(result.metadata.adSetId, "meta_adset_1");
  assert.equal(result.metadata.creativeId, "meta_creative_1");
  assert.equal(result.metadata.managedOps, true);
  const campaignCall = calls.find((c) => c.url.includes("/campaigns"));
  assert.equal(campaignCall.body.status, "PAUSED");
  const adSetCall = calls.find((c) => c.url.includes("/adsets"));
  assert.equal(adSetCall.body.status, "PAUSED");
  assert.equal(adSetCall.body.campaign_id, "meta_campaign_1");
});

test("Meta Ads reads richer campaign status via READ_EXTERNAL_RECORD", async () => {
  const adapter = new MetaAdsIntegrationAdapter({
    nowISO: NOW,
    graphApiVersion: "v25.0",
    fetchImpl: async (url) => {
      assert.match(String(url), /meta_campaign_1/);
      return { ok: true, json: async () => ({ id: "meta_campaign_1", name: "Spring promo", status: "PAUSED", effective_status: "PAUSED", objective: "OUTCOME_LEADS", daily_budget: "2000" }) };
    },
  });
  const result = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD, parameters: { recordType: "campaign_status", campaignId: "meta_campaign_1" } },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.metadata.status, "PAUSED");
  assert.equal(result.metadata.effectiveStatus, "PAUSED");
  assert.equal(result.metadata.objective, "OUTCOME_LEADS");
});

test("Meta Ads duplicates a paused ad variant under an existing campaign", async () => {
  const calls = [];
  const adapter = new MetaAdsIntegrationAdapter({
    nowISO: NOW,
    graphApiVersion: "v25.0",
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url: String(url), body });
      if (String(url).includes("/adsets")) return { ok: true, json: async () => ({ id: "meta_adset_variant" }) };
      if (String(url).includes("/adcreatives")) return { ok: true, json: async () => ({ id: "meta_creative_variant" }) };
      return { ok: false, json: async () => ({ error: { message: "unexpected_call" } }) };
    },
  });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
      requiresApproval: true,
      outboundApproved: true,
      parameters: {
        recordType: "ad_variant",
        campaignId: "meta_campaign_1",
        adSet: { name: "Variant B ad set" },
        creative: { name: "Variant B creative", pageId: "page_1" },
      },
    },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.metadata.adSetId, "meta_adset_variant");
  assert.equal(result.metadata.adSetStatus, "PAUSED");
  assert.equal(result.metadata.creativeId, "meta_creative_variant");
  assert.equal(result.metadata.variant, true);
  const adSetCall = calls.find((c) => c.url.includes("/adsets"));
  assert.equal(adSetCall.body.status, "PAUSED");
  assert.equal(adSetCall.body.campaign_id, "meta_campaign_1");
});

test("Meta Ads ad variant creation still requires owner approval", async () => {
  const adapter = new MetaAdsIntegrationAdapter({ nowISO: NOW, graphApiVersion: "v25.0", fetchImpl: async () => { throw new Error("should not call Graph API"); } });
  const result = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD, requiresApproval: false, outboundApproved: false, parameters: { recordType: "ad_variant", campaignId: "meta_campaign_1" } },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(result.error, "owner_approval_required");
});

test("Meta Ads refuses ACTIVATE_AD_CAMPAIGN without both ownerApproved and confirmActivate", async () => {
  const adapter = new MetaAdsIntegrationAdapter({ nowISO: NOW, graphApiVersion: "v25.0", fetchImpl: async () => { throw new Error("should not call Graph API"); } });

  const missingBoth = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN, parameters: { campaignId: "meta_campaign_1" } },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(missingBoth.error, "explicit_owner_activation_required");

  const missingConfirm = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN, parameters: { campaignId: "meta_campaign_1", ownerApproved: true } },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(missingConfirm.error, "explicit_owner_activation_required");

  const missingOwnerApproval = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN, parameters: { campaignId: "meta_campaign_1", confirmActivate: true } },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(missingOwnerApproval.error, "explicit_owner_activation_required");
});

test("Meta Ads activates a campaign only with explicit ownerApproved + confirmActivate", async () => {
  let payload = null;
  const adapter = new MetaAdsIntegrationAdapter({
    nowISO: NOW,
    graphApiVersion: "v25.0",
    fetchImpl: async (_url, init) => { payload = JSON.parse(init.body); return { ok: true, json: async () => ({ success: true }) }; },
  });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.ACTIVATE_AD_CAMPAIGN,
      parameters: { campaignId: "meta_campaign_1", ownerApproved: true, confirmActivate: true },
    },
    connection: connection(),
    credentialResolver: resolver({ adAccountId: "123", accessToken: "meta_token" }),
  });
  assert.equal(result.status, "completed");
  assert.equal(payload.status, "ACTIVE");
  assert.equal(result.metadata.campaignStatus, "ACTIVE");
});
