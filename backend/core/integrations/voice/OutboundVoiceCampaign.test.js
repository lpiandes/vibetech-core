import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createOutboundCampaign,
  dialNextOutboundCampaignContact,
  readOutboundCampaigns,
} from "./OutboundVoiceCampaign.js";

test("createOutboundCampaign rejects a contact list with no phone numbers", () => {
  const result = createOutboundCampaign({
    installation: { configuration: {} },
    name: "Spring outreach",
    contacts: [{ id: "c1", name: "No Phone" }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_phones");
});

test("createOutboundCampaign persists a draft campaign onto installation.configuration.outboundVoiceCampaigns", () => {
  const result = createOutboundCampaign({
    installation: { businessId: "biz_1", configuration: {} },
    name: "Spring outreach",
    contacts: [
      { contactId: "c1", name: "Jordan Lee", phone: "+15551230000" },
      { name: "No Phone" },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.campaign.status, "draft");
  assert.equal(result.campaign.contacts.length, 1);
  assert.equal(result.campaign.contacts[0].phone, "+15551230000");
  const persisted = readOutboundCampaigns(result.installation);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].id, result.campaign.id);
});

test("dialNextOutboundCampaignContact is blocked without outbound GRANT", async () => {
  const created = createOutboundCampaign({
    installation: { businessId: "biz_1", configuration: {} },
    name: "Spring outreach",
    contacts: [{ contactId: "c1", name: "Jordan Lee", phone: "+15551230000" }],
  });
  let placeCallCalled = false;
  const result = await dialNextOutboundCampaignContact({
    installation: created.installation,
    campaignId: created.campaign.id,
    outboundApproved: false,
    placeCall: async () => {
      placeCallCalled = true;
      return { ok: true, externalReference: "CAxxxx" };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "outbound_not_approved");
  assert.equal(placeCallCalled, false);
});

test("dialNextOutboundCampaignContact dials the next pending contact once approved", async () => {
  const created = createOutboundCampaign({
    installation: { businessId: "biz_1", configuration: {} },
    name: "Spring outreach",
    contacts: [{ contactId: "c1", name: "Jordan Lee", phone: "+15551230000" }],
  });
  const calls = [];
  const result = await dialNextOutboundCampaignContact({
    installation: created.installation,
    campaignId: created.campaign.id,
    outboundApproved: true,
    placeCall: async (params) => {
      calls.push(params);
      return { ok: true, externalReference: "CAxxxx" };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.contact.status, "dialed");
  assert.equal(result.contact.callSid, "CAxxxx");
  assert.equal(result.campaign.dialed, 1);
  assert.equal(result.campaign.status, "running");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "+15551230000");
  assert.equal(calls[0].campaignId, created.campaign.id);
  const persisted = readOutboundCampaigns(result.installation);
  assert.equal(persisted[0].contacts[0].status, "dialed");
});

test("dialNextOutboundCampaignContact marks a contact failed when the dial fails", async () => {
  const created = createOutboundCampaign({
    installation: { businessId: "biz_1", configuration: {} },
    name: "Spring outreach",
    contacts: [{ contactId: "c1", name: "Jordan Lee", phone: "+15551230000" }],
  });
  const result = await dialNextOutboundCampaignContact({
    installation: created.installation,
    campaignId: created.campaign.id,
    outboundApproved: true,
    placeCall: async () => ({ ok: false, reason: "twilio_http_400", message: "Twilio rejected the call" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.contact.status, "failed");
  assert.equal(result.contact.error, "Twilio rejected the call");
  assert.equal(result.campaign.failed, 1);
});

test("dialNextOutboundCampaignContact reports completed once all contacts are dialed", async () => {
  const created = createOutboundCampaign({
    installation: { businessId: "biz_1", configuration: {} },
    name: "Spring outreach",
    contacts: [{ contactId: "c1", name: "Jordan Lee", phone: "+15551230000" }],
  });
  const dialed = await dialNextOutboundCampaignContact({
    installation: created.installation,
    campaignId: created.campaign.id,
    outboundApproved: true,
    placeCall: async () => ({ ok: true, externalReference: "CAxxxx" }),
  });
  const next = await dialNextOutboundCampaignContact({
    installation: dialed.installation,
    campaignId: created.campaign.id,
    outboundApproved: true,
    placeCall: async () => ({ ok: true, externalReference: "CAyyyy" }),
  });
  assert.equal(next.ok, true);
  assert.equal(next.done, true);
  assert.equal(next.campaign.status, "completed");
});

test("dialNextOutboundCampaignContact fails when the campaign does not exist", async () => {
  const result = await dialNextOutboundCampaignContact({
    installation: { businessId: "biz_1", configuration: {} },
    campaignId: "does_not_exist",
    outboundApproved: true,
    placeCall: async () => ({ ok: true, externalReference: "CAxxxx" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "campaign_not_found");
});
