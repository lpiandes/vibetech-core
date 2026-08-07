import assert from "node:assert/strict";
import { test } from "node:test";

import { createDraftPost, approveAndQueuePublish, listDrafts } from "./SocialContentAutomation.js";
import { fromBrief, listJobs } from "./MarketingContentEngine.js";
import { extractContactFieldsFromText } from "./DocumentFieldExtract.js";
import { composeSalesAnalyticsDashboard } from "../analytics/SalesAnalyticsDashboard.js";
import {
  createOutboundCampaign,
  dialNextOutboundCampaignContact,
} from "../../integrations/voice/OutboundVoiceCampaign.js";
import { syncContactsToExternal, syncContactsFromExternal } from "../../integrations/crm/CrmExternalSync.js";
import { resolvePackageSoftCaps } from "../packages/SalesPackageCatalog.js";

function memoryStore(installation) {
  const state = { installation: JSON.parse(JSON.stringify(installation)) };
  return {
    state,
    store: {
      async upsertBusinessOSInstallation(next) {
        state.installation = {
          ...state.installation,
          ...next,
          configuration: next.configuration ?? state.installation.configuration,
        };
        return state.installation;
      },
      async getBusinessOSInstallation() {
        return state.installation;
      },
      async listIntegrationCredentialsForWorkspace() {
        return [];
      },
    },
  };
}

test("social content draft approves to manual queue without Meta", async () => {
  const mem = memoryStore({ businessId: "biz_c1", configuration: {} });
  const created = await createDraftPost({
    platformStore: mem.store,
    installation: mem.state.installation,
    channel: "linkedin",
    brief: "Launch update",
    body: "We launched a new service this week.",
  });
  assert.equal(created.ok, true);
  assert.equal(created.draft.status, "draft");
  const approved = await approveAndQueuePublish({
    platformStore: mem.store,
    installation: mem.state.installation,
    draftId: created.draft.id,
  });
  assert.equal(approved.ok, true);
  assert.ok(["queued_for_manual_publish", "approved"].includes(approved.draft.status));
  assert.ok(listDrafts(mem.state.installation).length >= 1);
});

test("marketing content engine creates email sms and social", async () => {
  const mem = memoryStore({ businessId: "biz_c2", configuration: {} });
  const result = await fromBrief({
    platformStore: mem.store,
    installation: mem.state.installation,
    brief: { headline: "Spring promotion", offer: "20% off", businessName: "Acme" },
  });
  assert.equal(result.ok, true);
  assert.ok(result.job?.id);
  assert.ok(listJobs(mem.state.installation).length >= 1);
});

test("document field extract finds email phone name", () => {
  const fields = extractContactFieldsFromText("Name: Jane Doe\nEmail: jane@acme.com\nPhone: (555) 111-2222\nCompany: Acme Inc");
  assert.equal(fields.email, "jane@acme.com");
  assert.ok(fields.phone);
  assert.equal(fields.name, "Jane Doe");
  assert.equal(fields.company, "Acme Inc");
});

test("sales analytics composes from crm", () => {
  const dash = composeSalesAnalyticsDashboard({
    installation: {
      configuration: {
        crm: {
          contacts: [{ id: "c1" }],
          pipelines: [{
            id: "p1",
            name: "Sales",
            stages: [{ id: "s1", label: "New", order: 1 }],
            cards: [{ id: "card1", stageId: "s1", value: 100 }],
          }],
        },
      },
    },
  });
  assert.equal(dash.pipeline.totalContacts, 1);
  assert.equal(dash.pipeline.totalCards, 1);
  assert.equal(dash.pipeline.openCards, 1);
});

test("outbound campaign blocks dial without GRANT", async () => {
  const created = createOutboundCampaign({
    installation: { configuration: {} },
    contacts: [{ name: "A", phone: "+15555550100" }],
  });
  assert.equal(created.ok, true);
  const blocked = await dialNextOutboundCampaignContact({
    installation: created.installation,
    campaignId: created.campaign.id,
    outboundApproved: false,
    placeCall: async () => ({ ok: true, externalReference: "CA1" }),
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "outbound_not_approved");

  const dialed = await dialNextOutboundCampaignContact({
    installation: created.installation,
    campaignId: created.campaign.id,
    outboundApproved: true,
    placeCall: async () => ({ ok: true, externalReference: "CA1" }),
  });
  assert.equal(dialed.ok, true);
  assert.equal(dialed.contact.status, "dialed");
});

test("crm external sync push and pull with mocked fetch", async () => {
  const push = await syncContactsToExternal({
    provider: "hubspot",
    accessToken: "token",
    contacts: [{ id: "c1", name: "Jane Doe", email: "jane@acme.com" }],
    fetchImpl: async () => ({ ok: true, status: 201, json: async () => ({ id: "hs_1" }) }),
  });
  assert.equal(push.ok, true);
  assert.equal(push.pushed, 1);

  const pull = await syncContactsFromExternal({
    provider: "hubspot",
    accessToken: "token",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ results: [{ id: "9", properties: { email: "a@b.com", firstname: "A", lastname: "B" } }] }),
    }),
  });
  assert.equal(pull.ok, true);
  assert.equal(pull.pulled, 1);
});

test("add-on soft caps add to managed base", () => {
  const caps = resolvePackageSoftCaps(["essential_managed", "addon_additional_ai_agent", "addon_additional_workflow"]);
  assert.equal(caps.maxWorkers, 4);
  assert.equal(caps.maxWorkflows, 6);
});
