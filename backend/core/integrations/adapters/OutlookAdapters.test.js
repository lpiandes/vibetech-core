import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isMicrosoftOAuthConfigured,
  buildMicrosoftAuthorizeUrl,
  exchangeMicrosoftCode,
} from "../oauth/MicrosoftOAuthClient.js";
import { OutlookMailIntegrationAdapter } from "./OutlookMailIntegrationAdapter.js";
import { OutlookCalendarIntegrationAdapter } from "./OutlookCalendarIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createLiveIntegrationProviders } from "./createLiveIntegrationProviders.js";

test("microsoft oauth helpers", async () => {
  const previousId = process.env.MICROSOFT_CLIENT_ID;
  const previousSecret = process.env.MICROSOFT_CLIENT_SECRET;
  process.env.MICROSOFT_CLIENT_ID = "client";
  process.env.MICROSOFT_CLIENT_SECRET = "secret";
  try {
    assert.equal(isMicrosoftOAuthConfigured(), true);
    const url = buildMicrosoftAuthorizeUrl({ redirectUri: "https://app.example/cb", state: "s1" });
    assert.match(url, /login\.microsoftonline\.com/);
    assert.match(url, /client_id=client/);
    const exchanged = await exchangeMicrosoftCode({
      code: "code",
      redirectUri: "https://app.example/cb",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
      }),
    });
    assert.equal(exchanged.ok, true);
    assert.equal(exchanged.accessToken, "at");
  } finally {
    if (previousId === undefined) delete process.env.MICROSOFT_CLIENT_ID;
    else process.env.MICROSOFT_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.MICROSOFT_CLIENT_SECRET;
    else process.env.MICROSOFT_CLIENT_SECRET = previousSecret;
  }
});

test("outlook mail adapter sends via Graph", async () => {
  const adapter = new OutlookMailIntegrationAdapter({
    fetchImpl: async (url, init) => {
      assert.match(String(url), /sendMail/);
      assert.equal(init.method, "POST");
      return { ok: true, text: async () => "" };
    },
  });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      parameters: {
        message: {
          subject: "Hi",
          body: "Hello",
          recipients: [{ metadata: { email: "a@b.com" } }],
        },
      },
    },
    connection: { credentialReference: { credentialId: "c1" } },
    credentialResolver: { resolve: () => ({ accessToken: "tok" }) },
  });
  assert.equal(result.status, "completed");
  assert.ok(result.externalReference);
});

test("outlook calendar adapter creates event via Graph", async () => {
  const adapter = new OutlookCalendarIntegrationAdapter({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ id: "evt_1", webLink: "https://outlook.office.com/x" }),
    }),
  });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
      parameters: {
        summary: "Meet",
        start: { dateTime: "2026-08-07T15:00:00.000Z" },
        end: { dateTime: "2026-08-07T15:30:00.000Z" },
      },
    },
    connection: { credentialReference: { credentialId: "c1" } },
    credentialResolver: { resolve: () => ({ accessToken: "tok" }) },
  });
  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "evt_1");
});

test("createLiveIntegrationProviders includes outlook when microsoft env set", () => {
  const previousId = process.env.MICROSOFT_CLIENT_ID;
  const previousSecret = process.env.MICROSOFT_CLIENT_SECRET;
  process.env.MICROSOFT_CLIENT_ID = "client";
  process.env.MICROSOFT_CLIENT_SECRET = "secret";
  try {
    const providers = createLiveIntegrationProviders({ force: false });
    assert.ok(providers.some((p) => p.id === "outlook_mail"));
    assert.ok(providers.some((p) => p.id === "outlook_calendar"));
  } finally {
    if (previousId === undefined) delete process.env.MICROSOFT_CLIENT_ID;
    else process.env.MICROSOFT_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.MICROSOFT_CLIENT_SECRET;
    else process.env.MICROSOFT_CLIENT_SECRET = previousSecret;
  }
});
