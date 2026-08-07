import test from "node:test";
import assert from "node:assert/strict";

import { OutlookMailIntegrationAdapter } from "./OutlookMailIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

const NOW = "2026-08-01T00:00:00.000Z";

function connectionWith() {
  return { credentialReference: { credentialId: "cred_outlook_1" } };
}

function resolverWith(creds) {
  return { resolve: () => creds };
}

test("Outlook mail adapter supports only SEND_EMAIL", () => {
  const adapter = new OutlookMailIntegrationAdapter({ nowISO: NOW });
  assert.deepEqual(adapter.supportedCapabilities, [INTEGRATION_CAPABILITIES.SEND_EMAIL]);
  assert.equal(adapter.id, "outlook");
  assert.deepEqual(adapter.supportedConnectionTypes, ["business_email"]);
});

test("Outlook mail send fails closed without message.body", async () => {
  const adapter = new OutlookMailIntegrationAdapter({ nowISO: NOW });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      parameters: { message: { subject: "Hi", recipients: [{ metadata: { email: "to@example.com" } }] } },
    },
    connection: connectionWith({}),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });
  assert.equal(result.status, "failed");
  assert.match(result.error, /message.body required/);
});

test("Outlook mail send creates a draft then sends it via Microsoft Graph", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/me/messages")) {
      const body = JSON.parse(init.body);
      assert.equal(body.subject, "VIBETech prove test");
      assert.equal(body.toRecipients[0].emailAddress.address, "prove@example.com");
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: "AAMk_graph_message_1" }),
      };
    }
    if (String(url).includes("/me/messages/AAMk_graph_message_1/send")) {
      return { ok: true, status: 202, json: async () => ({}) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const adapter = new OutlookMailIntegrationAdapter({ nowISO: NOW, fetchImpl });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      parameters: {
        message: {
          subject: "VIBETech prove test",
          body: "This is a VIBETech prove test. Safe to ignore.",
          recipients: [{ id: "prove", type: "external", metadata: { email: "prove@example.com" } }],
          sender: { id: "business", type: "system", metadata: { email: "owner@business.com" } },
        },
      },
    },
    connection: connectionWith({}),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "AAMk_graph_message_1");
  assert.equal(result.metadata.senderEmail, "owner@business.com");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers.Authorization, "Bearer at_1");
});

test("Outlook mail send refreshes the access token once on a 401 and retries", async () => {
  const calls = [];
  let tokenRefreshed = false;
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("/oauth2/v2.0/token")) {
      tokenRefreshed = true;
      return { ok: true, json: async () => ({ access_token: "at_2", refresh_token: "rt_1", expires_in: 3600 }) };
    }
    if (String(url).endsWith("/me/messages")) {
      if (init.headers.Authorization === "Bearer at_1") {
        return { ok: false, status: 401, json: async () => ({ error: { message: "expired" } }) };
      }
      return { ok: true, status: 201, json: async () => ({ id: "msg_after_refresh" }) };
    }
    if (String(url).includes("/send")) {
      return { ok: true, status: 202, json: async () => ({}) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const previousEnv = {
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  };
  process.env.MICROSOFT_CLIENT_ID = "client_1";
  process.env.MICROSOFT_CLIENT_SECRET = "secret_1";

  try {
    const adapter = new OutlookMailIntegrationAdapter({ nowISO: NOW, fetchImpl });
    const result = await adapter.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
        parameters: {
          message: {
            subject: "Retry test",
            body: "Body",
            recipients: [{ metadata: { email: "to@example.com" } }],
          },
        },
      },
      connection: connectionWith({}),
      credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
    });
    assert.equal(result.status, "completed");
    assert.equal(result.externalReference, "msg_after_refresh");
    assert.equal(tokenRefreshed, true);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Outlook mail verifyConnection reports failed without credentials", async () => {
  const adapter = new OutlookMailIntegrationAdapter({ nowISO: NOW });
  const result = await adapter.verifyConnection({ connection: null, credentialResolver: null });
  assert.equal(result.status, "failed");
  assert.equal(result.code, "missing_credentials");
});
