import test from "node:test";
import assert from "node:assert/strict";
import {
  sendFeRetentionSmsMessage,
  readPlatformTwilioSmsEnv,
  ensureFeRetentionPlatformSms,
  feSmsPhonesMatch,
} from "./FeRetentionSms.js";
import { writeFeRetentionBilling } from "./FeRetentionBilling.js";
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

test("feSmsPhonesMatch treats +1 and 10-digit US numbers as the same", () => {
  assert.equal(feSmsPhonesMatch("+15551234567", "5551234567"), true);
  assert.equal(feSmsPhonesMatch("+15551234567", "+15559876543"), false);
});

test("first paid book keeps TWILIO_MESSAGING_FROM; the next book buys a dedicated number", async () => {
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
    });
    assert.equal(first.ok, true);
    assert.equal(first.fromNumber, "+15551234567");
    assert.equal(first.provisionedBy, "fe_retention_platform");

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
    assert.notEqual(second.fromNumber, "+15551234567");
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
