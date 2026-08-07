import test from "node:test";
import assert from "node:assert/strict";

import { executeLiveProveAction } from "./executeLiveProveAction.js";
import { CredentialVault } from "../credentials/CredentialVault.js";
import { PROVE_ACTIONS } from "./IntegrationProveService.js";

function fakePlatformStore({ installation = null, credentials = [], knowledgeDocuments = [] } = {}) {
  let current = installation;
  return {
    getBusinessOSInstallation: async () => current,
    listIntegrationCredentialsForWorkspace: async () => credentials,
    listKnowledgeDocumentsForBusiness: async () => knowledgeDocuments,
    upsertBusinessOSInstallation: async (next) => {
      current = { ...current, ...next };
      return current;
    },
  };
}

test("prove_team_availability fails when no teammate has weekly availability", async () => {
  const platformStore = fakePlatformStore({
    installation: { id: "install_1", businessId: "biz_1", configuration: {} },
  });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.prove_team_availability,
    businessId: "biz_1",
    platformStore,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_bookable_members");
});

test("prove_team_availability succeeds when a bookable member has weekly windows", async () => {
  const platformStore = fakePlatformStore({
    installation: {
      id: "install_1",
      businessId: "biz_1",
      configuration: {
        teamAvailability: {
          version: 1,
          timezone: "America/New_York",
          members: {
            member_1: {
              memberId: "member_1",
              displayName: "Jordan",
              bookable: true,
              weekly: [{ day: 1, start: "09:00", end: "17:00" }],
              overrides: [],
            },
          },
        },
      },
    },
  });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.prove_team_availability,
    businessId: "biz_1",
    platformStore,
  });
  assert.equal(result.ok, true);
  assert.equal(result.bookableMemberCount, 1);
  assert.equal(result.provider, "team_availability");
});

test("prove_team_availability fails when the business installation is missing", async () => {
  const platformStore = fakePlatformStore({ installation: null });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.prove_team_availability,
    businessId: "biz_missing",
    platformStore,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "business_missing");
});

test("prove_appointment_setter_sms fails closed when Twilio SMS is not connected", async () => {
  const vault = new CredentialVault();
  const platformStore = fakePlatformStore({ credentials: [] });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.prove_appointment_setter_sms,
    businessId: "biz_1",
    platformStore,
    vault,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "credentials_missing");
});

test("prove_appointment_setter_sms confirms Twilio config and inbound webhook when live", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_twilio_sms_biz_1",
    providerType: "twilio_sms",
    secrets: { accountSid: "ACxxxx", authToken: "token", fromNumber: "+15551234567" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    credentials: [{ credentialId: "cred_twilio_sms_biz_1", providerType: "twilio_sms", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://app.example.com";
  globalThis.fetch = async (url) => {
    if (String(url).includes("IncomingPhoneNumbers")) {
      return {
        ok: true,
        json: async () => ({
          incoming_phone_numbers: [
            { sms_url: "https://app.example.com/api/businesses/biz_1/integrations/sms/inbound" },
          ],
        }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.prove_appointment_setter_sms,
      businessId: "biz_1",
      platformStore,
      vault,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "twilio_sms");
    assert.equal(result.webhookConfigured, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousOrigin;
  }
});

test("place_test_call marks conversational evidence as owner-confirm-pending, with knowledge cite attempted", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_twilio_voice_biz_1",
    providerType: "twilio_voice",
    secrets: { accountSid: "ACxxxx", authToken: "token", fromNumber: "+15551234567" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    credentials: [{ credentialId: "cred_twilio_voice_biz_1", providerType: "twilio_voice", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://app.example.com";
  globalThis.fetch = async (url) => {
    if (String(url).includes("/Calls.json")) {
      return { ok: true, json: async () => ({ sid: "CAxxxx" }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.place_test_call,
      businessId: "biz_1",
      platformStore,
      vault,
      provePhone: "+15559990000",
      knowledgeCount: 3,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "twilio_voice");
    assert.equal(result.metadata?.conversationalProve, true);
    assert.equal(result.metadata?.requiresOwnerConfirm, true);
    assert.equal(result.metadata?.knowledgeCitedAttempted, true);
    assert.equal(result.metadata?.conversationalComplete, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousOrigin;
  }
});

test("place_test_call omits knowledgeCitedAttempted when Knowledge is empty", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_twilio_voice_biz_2",
    providerType: "twilio_voice",
    secrets: { accountSid: "ACxxxx", authToken: "token", fromNumber: "+15551234567" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    credentials: [{ credentialId: "cred_twilio_voice_biz_2", providerType: "twilio_voice", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://app.example.com";
  globalThis.fetch = async (url) => {
    if (String(url).includes("/Calls.json")) {
      return { ok: true, json: async () => ({ sid: "CAyyyy" }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.place_test_call,
      businessId: "biz_2",
      platformStore,
      vault,
      provePhone: "+15559990000",
      knowledgeCount: 0,
    });
    assert.equal(result.ok, true);
    assert.equal(result.metadata?.conversationalProve, true);
    assert.equal(result.metadata?.knowledgeCitedAttempted, false);
    assert.equal(result.metadata?.conversationalComplete, false);
    assert.equal(result.metadata?.conversationalBlocker, "knowledge_empty");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousOrigin;
  }
});

test("place_test_outbound_call is blocked without owner GRANT", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_twilio_voice_biz_3",
    providerType: "twilio_voice",
    secrets: { accountSid: "ACxxxx", authToken: "token", fromNumber: "+15551234567" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    installation: { id: "install_3", businessId: "biz_3", configuration: {} },
    credentials: [{ credentialId: "cred_twilio_voice_biz_3", providerType: "twilio_voice", metadata: {} }],
  });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.place_test_outbound_call,
    businessId: "biz_3",
    platformStore,
    vault,
    provePhone: "+15559990000",
    outboundApproved: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "outbound_not_approved");
});

test("place_test_outbound_call dials an approved campaign contact, persists the campaign, and records usage", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_twilio_voice_biz_4",
    providerType: "twilio_voice",
    secrets: { accountSid: "ACxxxx", authToken: "token", fromNumber: "+15551234567" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    installation: { id: "install_4", businessId: "biz_4", configuration: {} },
    credentials: [{ credentialId: "cred_twilio_voice_biz_4", providerType: "twilio_voice", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://app.example.com";
  globalThis.fetch = async (url) => {
    if (String(url).includes("/Calls.json")) {
      return { ok: true, json: async () => ({ sid: "CAoutbound1" }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.place_test_outbound_call,
      businessId: "biz_4",
      platformStore,
      vault,
      provePhone: "+15559990000",
      outboundApproved: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "twilio_voice");
    assert.equal(result.externalReference, "CAoutbound1");
    assert.ok(result.campaignId);
    assert.equal(result.contactId, "prove_contact");

    const persisted = await platformStore.getBusinessOSInstallation("biz_4");
    const campaigns = persisted?.configuration?.outboundVoiceCampaigns ?? [];
    assert.equal(campaigns.length, 1);
    assert.equal(campaigns[0].contacts[0].status, "dialed");
    assert.equal(campaigns[0].contacts[0].callSid, "CAoutbound1");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousOrigin;
  }
});

test("sync_pull_crm_contacts fails closed when no CRM is connected", async () => {
  const vault = new CredentialVault();
  const platformStore = fakePlatformStore({ credentials: [] });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.sync_pull_crm_contacts,
    businessId: "biz_5",
    platformStore,
    vault,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_connected");
});

test("sync_pull_crm_contacts pulls live HubSpot contacts into People", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_hubspot_biz_6",
    providerType: "hubspot",
    secrets: { accessToken: "pat-test" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    installation: { id: "install_6", businessId: "biz_6", configuration: {} },
    credentials: [{ credentialId: "cred_hubspot_biz_6", providerType: "hubspot", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("hubapi.com")) {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              id: "hs_500",
              properties: { firstname: "Ada", lastname: "Lovelace", email: "ada@example.com", phone: "+15550001111" },
            },
          ],
        }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.sync_pull_crm_contacts,
      businessId: "biz_6",
      platformStore,
      vault,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "hubspot");
    assert.equal(result.pulled, 1);
    assert.equal(result.detail.externalReference, "hs_500");

    const persisted = await platformStore.getBusinessOSInstallation("biz_6");
    const contacts = persisted?.configuration?.crm?.contacts ?? [];
    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].name, "Ada Lovelace");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("sync_pull_crm_contacts returns zero pulled contacts when the CRM has none (gated one level up)", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_hubspot_biz_7",
    providerType: "hubspot",
    secrets: { accessToken: "pat-test" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    installation: { id: "install_7", businessId: "biz_7", configuration: {} },
    credentials: [{ credentialId: "cred_hubspot_biz_7", providerType: "hubspot", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [] }) });

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.sync_pull_crm_contacts,
      businessId: "biz_7",
      platformStore,
      vault,
    });
    assert.equal(result.ok, true);
    assert.equal(result.pulled, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("submit_test_chat fails when the business installation is missing", async () => {
  const platformStore = fakePlatformStore({ installation: null });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.submit_test_chat,
    businessId: "biz_chat_missing",
    platformStore,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "business_missing");
});

test("submit_test_chat answers honestly and saves a People contact when Knowledge is empty", async () => {
  const platformStore = fakePlatformStore({
    installation: { id: "install_chat_1", businessId: "biz_chat_1", configuration: {} },
    knowledgeDocuments: [],
  });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.submit_test_chat,
    businessId: "biz_chat_1",
    platformStore,
    proveEmail: "prove-chat@example.com",
  });
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.provider, "website_chat");
  assert.equal(result.groundedInKnowledge, false);
  assert.match(result.reply, /don't have any Knowledge documents/i);
  assert.ok(result.contactId);
  assert.ok(result.detail?.externalReference);

  const installation = await platformStore.getBusinessOSInstallation("biz_chat_1");
  const contact = installation.configuration.crm.contacts.find((c) => c.id === result.contactId);
  assert.ok(contact, "prove chat contact should be persisted to CrmStore");
  assert.equal(contact.email, "prove-chat@example.com");
  assert.ok(contact.tags.includes("website_chat"));

  const threads = installation.configuration.websiteChatThreads;
  assert.equal(threads.length, 1);
  assert.equal(threads[0].id, result.threadId);
  assert.equal(threads[0].contactId, result.contactId);
  assert.equal(threads[0].turns.length, 2);
});

test("submit_test_chat cites a real Knowledge document in the reply when one is loaded", async () => {
  const platformStore = fakePlatformStore({
    installation: { id: "install_chat_2", businessId: "biz_chat_2", configuration: {} },
    knowledgeDocuments: [
      {
        id: "doc_hours_chat",
        businessId: "biz_chat_2",
        status: "ready",
        title: "Business Hours",
        contentText: "We are open Monday through Friday from 9am to 5pm.",
      },
    ],
  });
  const result = await executeLiveProveAction({
    action: PROVE_ACTIONS.submit_test_chat,
    businessId: "biz_chat_2",
    platformStore,
  });
  assert.equal(result.ok, true);
  assert.equal(result.groundedInKnowledge, true);
  assert.deepEqual(result.citedDocumentIds, ["doc_hours_chat"]);
  assert.match(result.reply, /9am to 5pm/);
});

test("send_test_email routes to Outlook (Microsoft Graph) when the connected credential is outlook", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_outlook_biz_8",
    providerType: "outlook",
    secrets: { accessToken: "at", refreshToken: "rt", senderEmail: "owner@biz8.com" },
    metadata: { senderEmail: "owner@biz8.com" },
  });
  const platformStore = fakePlatformStore({
    credentials: [{ credentialId: "cred_outlook_biz_8", providerType: "outlook", metadata: { senderEmail: "owner@biz8.com" } }],
  });

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("/me/messages") && !u.includes("/send")) {
      return { ok: true, json: async () => ({ id: "msg_prove_1" }) };
    }
    if (u.includes("/send")) {
      return { ok: true, json: async () => ({}) };
    }
    throw new Error(`unexpected fetch: ${u} ${init?.method ?? ""}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.send_test_email,
      businessId: "biz_8",
      platformStore,
      vault,
      proveEmail: "prove@example.com",
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "outlook");
    assert.equal(result.externalReference, "msg_prove_1");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("create_test_event routes to Outlook Calendar (Microsoft Graph) when the connected credential is outlook_calendar", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_outlook_cal_biz_9",
    providerType: "outlook_calendar",
    secrets: { accessToken: "at", refreshToken: "rt" },
    metadata: {},
  });
  const platformStore = fakePlatformStore({
    credentials: [{ credentialId: "cred_outlook_cal_biz_9", providerType: "outlook_calendar", metadata: {} }],
  });

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/me/events")) {
      return { ok: true, json: async () => ({ id: "evt_prove_1", webLink: "https://outlook.office.com/evt_prove_1" }) };
    }
    throw new Error(`unexpected fetch: ${u}`);
  };

  try {
    const result = await executeLiveProveAction({
      action: PROVE_ACTIONS.create_test_event,
      businessId: "biz_9",
      platformStore,
      vault,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "outlook_calendar");
    assert.equal(result.externalReference, "evt_prove_1");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
