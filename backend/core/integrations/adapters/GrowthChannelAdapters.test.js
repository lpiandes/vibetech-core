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
