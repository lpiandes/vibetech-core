import test from "node:test";
import assert from "node:assert/strict";
import { sendFeRetentionSmsMessage, readPlatformTwilioSmsEnv } from "./FeRetentionSms.js";
import { buildFeMissedPaymentEmail } from "./FeRetentionEmail.js";

test("sendFeRetentionSmsMessage falls back to platform env Twilio", async () => {
  const prev = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_MESSAGING_FROM,
  };
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_MESSAGING_FROM = "+15551234567";

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

  process.env.TWILIO_ACCOUNT_SID = prev.sid;
  process.env.TWILIO_AUTH_TOKEN = prev.token;
  process.env.TWILIO_MESSAGING_FROM = prev.from;
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
