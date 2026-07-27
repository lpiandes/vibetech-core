import assert from "node:assert/strict";
import { test } from "node:test";

import { CredentialVault, resetSharedCredentialVaultForTests } from "./CredentialVault.js";
import { createVaultCredentialResolver } from "./createVaultCredentialResolver.js";
import { OAuthStateStore, resetSharedOAuthStateStoreForTests } from "./OAuthStateStore.js";
import { createIntegrationPlatform } from "../createIntegrationPlatform.js";
import { GmailIntegrationAdapter } from "../adapters/GmailIntegrationAdapter.js";
import { GmailCommunicationProvider } from "../../communications/providers/gmail/GmailCommunicationProvider.js";
import { connectBusinessEmailGmail } from "../use-cases/connectBusinessEmailGmail.js";
import { connectProviderConnection } from "../use-cases/connectProviderConnection.js";
import { TwilioSmsIntegrationAdapter } from "../adapters/TwilioSmsIntegrationAdapter.js";
import { GoogleCalendarIntegrationAdapter } from "../adapters/GoogleCalendarIntegrationAdapter.js";
import { MetaLeadAdsIntegrationAdapter } from "../adapters/MetaLeadAdsIntegrationAdapter.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";

test("CredentialVault stores secrets and never returns them from summarize", () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_1",
    providerType: "gmail",
    secrets: { refreshToken: "secret-token", senderEmail: "owner@example.com" },
    metadata: { senderEmail: "owner@example.com" },
  });
  const summary = vault.summarize("cred_1");
  assert.equal(summary.credentialId, "cred_1");
  assert.ok(!JSON.stringify(summary).includes("secret-token"));
  const resolved = vault.get("cred_1");
  assert.equal(resolved.secrets.refreshToken, "secret-token");
});

test("OAuthStateStore create/consume enforces one-time use", () => {
  resetSharedOAuthStateStoreForTests();
  const store = new OAuthStateStore();
  const created = store.create({
    businessId: "biz_1",
    connectionType: "business_email",
    providerType: "gmail",
  });
  const consumed = store.consume(created.state);
  assert.equal(consumed.businessId, "biz_1");
  assert.equal(store.consume(created.state), null);
});

test("Gmail OAuth connect → vault resolve → approve-shaped send", async () => {
  resetSharedCredentialVaultForTests();
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_gmail_test",
    providerType: "gmail",
    secrets: {
      refreshToken: "rt_test",
      senderEmail: "sender@example.com",
    },
    metadata: { senderEmail: "sender@example.com" },
  });

  const sent = [];
  const gmailClient = {
    users: {
      messages: {
        send: async ({ requestBody }) => {
          sent.push(requestBody);
          return { data: { id: "msg_1", threadId: "th_1" } };
        },
      },
    },
  };

  const communicationProvider = new GmailCommunicationProvider({
    gmailClient,
    nowISO: "2026-07-01T00:00:00.000Z",
    refreshToken: "rt_test",
    senderEmail: "sender@example.com",
  });

  const platform = createIntegrationPlatform({
    workspaceId: "biz_test",
    installationResult: {
      connectedSystemRequirements: [{ id: "business_email", displayName: "Business Email" }],
    },
    nowISO: "2026-07-01T00:00:00.000Z",
    credentialVault: vault,
    extraProviders: [new GmailIntegrationAdapter({ gmailCommunicationProvider: communicationProvider })],
  });

  const connection = await connectBusinessEmailGmail({
    integrationPlatform: platform,
    workspaceId: "biz_test",
    credentialId: "cred_gmail_test",
    senderEmail: "sender@example.com",
  });

  assert.equal(connection.status, CONNECTION_STATUSES.CONNECTED);
  assert.equal(connection.providerType, "gmail");

  const provider = platform.providerRegistry.getProvider("gmail");
  const result = await provider.executeAction({
    actionRequest: {
      id: "act_1",
      capability: "SEND_EMAIL",
      parameters: {
        message: {
          id: "cm_1",
          channel: "email",
          subject: "Hello",
          body: "Approved body",
          sender: { id: "biz", type: "system" },
          recipients: [{ id: "p1", type: "party", metadata: { email: "prospect@example.com" } }],
        },
      },
    },
    connection,
    credentialResolver: platform.credentialResolver,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "msg_1");
  assert.equal(sent.length, 1);
});

test("Twilio SMS connect with vault credentials verifies via mocked fetch", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_sms",
    providerType: "twilio_sms",
    secrets: {
      accountSid: "ACxxx",
      authToken: "token",
      fromNumber: "+15551212",
    },
  });

  const fetchImpl = async (url, init) => {
    if (String(url).includes("Accounts/ACxxx.json") && !init?.method) {
      return { ok: true, status: 200, json: async () => ({ sid: "ACxxx" }) };
    }
    if (String(url).includes("Messages.json")) {
      return { ok: true, status: 201, json: async () => ({ sid: "SMxxx" }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const platform = createIntegrationPlatform({
    workspaceId: "biz_sms",
    installationResult: {
      connectedSystemRequirements: [{ id: "sms_channel", displayName: "SMS" }],
    },
    credentialVault: vault,
    extraProviders: [new TwilioSmsIntegrationAdapter({ fetchImpl })],
  });

  const connection = await connectProviderConnection({
    integrationPlatform: platform,
    workspaceId: "biz_sms",
    connectionType: "sms_channel",
    displayName: "SMS",
    providerType: "twilio_sms",
    credentialId: "cred_sms",
    credentialType: "api_key",
  });
  assert.equal(connection.status, CONNECTION_STATUSES.CONNECTED);

  const result = await platform.providerRegistry.getProvider("twilio_sms").executeAction({
    actionRequest: {
      id: "sms_1",
      capability: "SEND_SMS",
      parameters: { to: "+15550001111", body: "Approved text" },
    },
    connection,
    credentialResolver: platform.credentialResolver,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "SMxxx");
});

test("Google Calendar create event with injected client", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_cal",
    providerType: "google_calendar",
    secrets: { refreshToken: "rt" },
  });

  const calendarClient = {
    calendarList: { list: async () => ({ data: { items: [] } }) },
    events: {
      insert: async ({ requestBody, conferenceDataVersion }) => ({
        data: {
          id: "evt_1",
          htmlLink: "https://calendar.google.com/event",
          summary: requestBody.summary,
          hangoutLink: conferenceDataVersion === 1 ? "https://meet.google.com/abc-defg-hij" : null,
          conferenceData: conferenceDataVersion === 1
            ? { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] }
            : undefined,
        },
      }),
    },
  };

  const platform = createIntegrationPlatform({
    workspaceId: "biz_cal",
    installationResult: {
      connectedSystemRequirements: [{ id: "calendar", displayName: "Calendar" }],
    },
    credentialVault: vault,
    extraProviders: [new GoogleCalendarIntegrationAdapter({ calendarClient })],
  });

  const connection = await connectProviderConnection({
    integrationPlatform: platform,
    workspaceId: "biz_cal",
    connectionType: "calendar",
    displayName: "Calendar",
    providerType: "google_calendar",
    credentialId: "cred_cal",
  });
  assert.equal(connection.status, CONNECTION_STATUSES.CONNECTED);

  const result = await platform.providerRegistry.getProvider("google_calendar").executeAction({
    actionRequest: {
      id: "cal_1",
      capability: "CREATE_CALENDAR_EVENT",
      parameters: {
        summary: "Showing",
        start: { dateTime: "2026-07-02T15:00:00Z" },
        end: { dateTime: "2026-07-02T15:30:00Z" },
      },
    },
    connection,
    credentialResolver: platform.credentialResolver,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "evt_1");

  const withMeet = await platform.providerRegistry.getProvider("google_calendar").executeAction({
    actionRequest: {
      id: "cal_meet",
      capability: "CREATE_CALENDAR_EVENT",
      parameters: {
        summary: "Parent call",
        description: "Agenda: tryout details",
        createGoogleMeet: true,
        start: { dateTime: "2026-07-02T16:00:00Z" },
        end: { dateTime: "2026-07-02T16:30:00Z" },
      },
    },
    connection,
    credentialResolver: platform.credentialResolver,
  });
  assert.equal(withMeet.status, "completed");
  assert.equal(withMeet.metadata.conferenceType, "google_meet");
  assert.match(String(withMeet.metadata.conferenceUrl), /meet\.google\.com/);
});

test("Meta lead webhook normalize + ingest", async () => {
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_meta",
    providerType: "meta_lead_ads",
    secrets: { pageId: "page_1", pageAccessToken: "token" },
  });

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "page_1", name: "Test Page" }),
  });

  const platform = createIntegrationPlatform({
    workspaceId: "biz_meta",
    installationResult: {
      connectedSystemRequirements: [{ id: "meta_lead_ads", displayName: "Facebook Leads" }],
    },
    credentialVault: vault,
    extraProviders: [new MetaLeadAdsIntegrationAdapter({ fetchImpl })],
  });

  const connection = await connectProviderConnection({
    integrationPlatform: platform,
    workspaceId: "biz_meta",
    connectionType: "meta_lead_ads",
    displayName: "Facebook Lead Ads",
    providerType: "meta_lead_ads",
    credentialId: "cred_meta",
  });
  assert.equal(connection.status, CONNECTION_STATUSES.CONNECTED);

  const result = await platform.providerRegistry.getProvider("meta_lead_ads").executeAction({
    actionRequest: {
      id: "lead_1",
      capability: "INGEST_FORM_SUBMISSION",
      parameters: {
        webhookBody: {
          entry: [{
            changes: [{
              value: { leadgen_id: "lead_99", form_id: "form_1", page_id: "page_1" },
            }],
          }],
        },
      },
    },
    connection,
    credentialResolver: platform.credentialResolver,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "lead_99");
});

test("vault credential resolver falls back to mock email", () => {
  const vault = new CredentialVault();
  const resolver = createVaultCredentialResolver({ vault });
  const resolved = resolver.resolve({
    credentialId: "cred_mock",
    credentialType: "mock",
    providerType: "provider_mock_email",
  });
  assert.equal(resolved.mockAccount, "mock-email-account");
});
