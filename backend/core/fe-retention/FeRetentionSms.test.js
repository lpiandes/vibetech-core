import test from "node:test";
import assert from "node:assert/strict";
import {
  sendFeRetentionSmsMessage,
  sendFeRetentionOpsSms,
  readPlatformTwilioSmsEnv,
  ensureFeRetentionPlatformSms,
  buildFeRetentionTwilioFriendlyName,
  feSmsPhonesMatch,
  isFeRetentionOpsFromNumber,
} from "./FeRetentionSms.js";
import { writeFeRetentionBilling } from "./FeRetentionBilling.js";
import { writeFeRetentionOnboarding } from "./FeRetentionOnboarding.js";
import { buildFeMissedPaymentEmail } from "./FeRetentionEmail.js";

function withTwilioEnv(run) {
  const prev = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_MESSAGING_FROM,
  };
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_MESSAGING_FROM = "+15551234567";
  return Promise.resolve()
    .then(run)
    .finally(() => {
      process.env.TWILIO_ACCOUNT_SID = prev.sid;
      process.env.TWILIO_AUTH_TOKEN = prev.token;
      process.env.TWILIO_MESSAGING_FROM = prev.from;
    });
}

function makeSmsStore(businesses) {
  const creds = new Map();
  return {
    async listBusinesses() { return businesses; },
    async getBusinessById(id) { return businesses.find((b) => String(b.id) === String(id)) ?? null; },
    async getIntegrationCredential(credentialId) { return creds.get(credentialId) ?? null; },
    async upsertIntegrationCredential(row) {
      creds.set(row.credentialId, row);
      return row;
    },
    async updateBusinessPackageConfiguration({ businessId, packageConfiguration }) {
      const business = businesses.find((b) => String(b.id) === String(businessId));
      if (business) business.packageConfiguration = packageConfiguration;
    },
  };
}

async function putDurableCredential({ platformStore, credentialId, secrets, metadata, workspaceId, providerType }) {
  await platformStore.upsertIntegrationCredential({
    credentialId,
    secrets,
    metadata,
    workspaceId,
    providerType,
  });
}

test("buildFeRetentionTwilioFriendlyName prefers A2P legal name, then book name", () => {
  const withLegal = buildFeRetentionTwilioFriendlyName({
    businessName: "Senior Advisors",
    packageConfiguration: writeFeRetentionOnboarding({}, {
      profile: { legalBusinessName: "Senior Advisors insurance LLC" },
    }),
    businessId: "c9750464-0000-4000-8000-000000000000",
  });
  assert.equal(withLegal, "VibeKeep Senior Advisors insurance LLC");

  const signupOnly = buildFeRetentionTwilioFriendlyName({
    businessName: "Ada Agency",
    packageConfiguration: {},
    businessId: "biz_ada",
  });
  assert.equal(signupOnly, "VibeKeep Ada Agency");

  const fallback = buildFeRetentionTwilioFriendlyName({
    businessName: "",
    packageConfiguration: {},
    businessId: "c9750464-abcd-4000-8000-000000000000",
  });
  assert.equal(fallback, "VibeKeep c9750464");
});

test("sendFeRetentionSmsMessage normalizes 10-digit US numbers for Twilio", async () => {
  await withTwilioEnv(async () => {
    let sawForm = "";
    await sendFeRetentionSmsMessage({
      to: "6038182383",
      body: "Hello",
      fromNumber: "+15559990000",
      fetchImpl: async (_url, init) => {
        sawForm = String(init?.body ?? "");
        return { ok: true, json: async () => ({ sid: "SMnorm" }) };
      },
    });
    assert.match(sawForm, /To=%2B16038182383/);
  });
});

test("sendFeRetentionSmsMessage falls back to platform env Twilio", async () => {
  await withTwilioEnv(async () => {
    let sawForm = "";
    const result = await sendFeRetentionSmsMessage({
      to: "+15559876543",
      body: "Hello from FE",
      fetchImpl: async (_url, init) => {
        sawForm = String(init?.body ?? "");
        return {
          ok: true,
          json: async () => ({ sid: "SMtest123", status: "queued" }),
        };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.via, "platform_env");
    assert.match(sawForm, /From=%2B15551234567/);
    assert.match(sawForm, /To=%2B15559876543/);
  });
});

test("sendFeRetentionSmsMessage uses the book's From-number when provided", async () => {
  await withTwilioEnv(async () => {
    let sawForm = "";
    const result = await sendFeRetentionSmsMessage({
      to: "+15559876543",
      body: "Hello from FE",
      fromNumber: "+15559990000",
      fetchImpl: async (_url, init) => {
        sawForm = String(init?.body ?? "");
        return { ok: true, json: async () => ({ sid: "SMbook" }) };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.fromNumber, "+15559990000");
    assert.match(sawForm, /From=%2B15559990000/);
  });
});

test("every paid book buys a dedicated number; ops From is never assigned to a book", async () => {
  await withTwilioEnv(async () => {
    const dad = {
      id: "biz_dad",
      packageConfiguration: { purchasedPackages: ["fe_retention_crm"] },
    };
    const next = {
      id: "biz_two",
      packageConfiguration: writeFeRetentionBilling({}, { status: "complimentary" }),
    };
    const store = makeSmsStore([dad, next]);

    const first = await ensureFeRetentionPlatformSms({
      platformStore: store,
      businessId: dad.id,
      putDurableCredential,
      packageConfiguration: dad.packageConfiguration,
      simulate: true,
    });
    assert.equal(first.ok, true);
    assert.equal(first.provisionedBy, "fe_retention_purchased");
    assert.ok(first.fromNumber);
    assert.equal(isFeRetentionOpsFromNumber(first.fromNumber), false);

    const second = await ensureFeRetentionPlatformSms({
      platformStore: store,
      businessId: next.id,
      putDurableCredential,
      packageConfiguration: next.packageConfiguration,
      simulate: true,
    });
    assert.equal(second.ok, true);
    assert.equal(second.provisionedBy, "fe_retention_purchased");
    assert.ok(second.fromNumber);
    assert.notEqual(second.fromNumber, first.fromNumber);
    assert.equal(isFeRetentionOpsFromNumber(second.fromNumber), false);
    assert.equal(readPlatformTwilioSmsEnv().fromNumber, "+15551234567");
  });
});

test("ensureFeRetentionPlatformSms does not buy a number before the book is paid", async () => {
  await withTwilioEnv(async () => {
    const unpaid = {
      id: "biz_unpaid",
      packageConfiguration: writeFeRetentionBilling({}, { status: "incomplete" }),
    };
    const store = makeSmsStore([unpaid]);
    const result = await ensureFeRetentionPlatformSms({
      platformStore: store,
      businessId: unpaid.id,
      putDurableCredential,
      packageConfiguration: unpaid.packageConfiguration,
      simulate: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "payment_required");
  });
});

test("buildFeMissedPaymentEmail includes client facts", () => {
  const mail = buildFeMissedPaymentEmail({
    client: {
      name: "Pat Client",
      phone: "+15550001111",
      policy: { carrier: "Gerber", policyNumber: "P-1", status: "lapsed" },
    },
  });
  assert.match(mail.subject, /Pat Client/);
  assert.match(mail.text, /Gerber/);
  assert.match(mail.html, /lapsed/);
});

test("readPlatformTwilioSmsEnv returns strings", () => {
  const env = readPlatformTwilioSmsEnv();
  assert.equal(typeof env.accountSid, "string");
  assert.equal(typeof env.fromNumber, "string");
});

test("feSmsPhonesMatch treats +1 and 10-digit US numbers as the same", () => {
  assert.equal(feSmsPhonesMatch("+15551234567", "5551234567"), true);
  assert.equal(feSmsPhonesMatch("+15551234567", "+15559876543"), false);
});

test("a book that already has the ops From is migrated to a purchased number", async () => {
  await withTwilioEnv(async () => {
    const dad = {
      id: "biz_dad",
      packageConfiguration: writeFeRetentionBilling({}, {
        status: "complimentary",
        twilioFromNumber: "+15551234567",
      }),
    };
    const store = makeSmsStore([dad]);
    const result = await ensureFeRetentionPlatformSms({
      platformStore: store,
      businessId: dad.id,
      putDurableCredential,
      packageConfiguration: dad.packageConfiguration,
      simulate: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provisionedBy, "fe_retention_purchased");
    assert.notEqual(result.fromNumber, "+15551234567");
  });
});

test("sendFeRetentionOpsSms always uses TWILIO_MESSAGING_FROM", async () => {
  await withTwilioEnv(async () => {
    let sawForm = "";
    const result = await sendFeRetentionOpsSms({
      to: "+16038182383",
      body: "Set up A2P",
      businessId: "biz_should_be_ignored",
      fromNumber: "+15559990000",
      fetchImpl: async (_url, init) => {
        sawForm = String(init?.body ?? "");
        return { ok: true, json: async () => ({ sid: "SMops" }) };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.fromNumber, "+15551234567");
    assert.match(sawForm, /From=%2B15551234567/);
  });
});

test("sendFeRetentionSmsMessage does not use another book's From when this book has no number", async () => {
  await withTwilioEnv(async () => {
    const store = makeSmsStore([{
      id: "biz_new",
      packageConfiguration: writeFeRetentionBilling({}, { status: "active" }),
    }]);
    const result = await sendFeRetentionSmsMessage({
      to: "+15559876543",
      body: "Hello",
      platformStore: store,
      businessId: "biz_new",
      fetchImpl: async () => {
        throw new Error("should not call Twilio");
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "sms_not_ready");
  });
});
