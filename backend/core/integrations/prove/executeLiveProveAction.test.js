import test from "node:test";
import assert from "node:assert/strict";

import { executeLiveProveAction } from "./executeLiveProveAction.js";
import { CredentialVault } from "../credentials/CredentialVault.js";
import { PROVE_ACTIONS } from "./IntegrationProveService.js";

function fakePlatformStore({ installation = null, credentials = [] } = {}) {
  return {
    getBusinessOSInstallation: async () => installation,
    listIntegrationCredentialsForWorkspace: async () => credentials,
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
    assert.equal(result.metadata?.knowledgeCitedAttempted, undefined);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previousOrigin;
  }
});
