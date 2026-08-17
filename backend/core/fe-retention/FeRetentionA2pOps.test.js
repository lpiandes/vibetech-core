import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFeRetentionA2pAttachOpsAction,
  buildFeRetentionA2pOpsSmsBodies,
  notifyFeRetentionOnboardingComplete,
} from "./FeRetentionA2pOps.js";

const profile = {
  legalBusinessName: "Second Agency LLC",
  ein: "123456789",
  street: "1 Main St",
  city: "Nashua",
  region: "NH",
  postalCode: "03060",
  contactFirstName: "Pat",
  contactLastName: "Owner",
};

test("A2P ops packet tells Leo to register this agency as its own brand", () => {
  const action = buildFeRetentionA2pAttachOpsAction({
    businessId: "biz_two",
    businessName: "Second Agency",
    fromNumber: "+15559990000",
    profile,
    signedName: "Pat Owner",
  });
  assert.match(action.title, /Second Agency/);
  assert.match(action.summary, /own Brand \+ Campaign/i);
  assert.ok(action.steps.some((step) => step.includes("+15559990000")));
  assert.ok(action.steps.some((step) => /EIN: 123456789/.test(step)));
  assert.equal(action.payload.fromNumber, "+15559990000");
});

test("ops SMS includes Twilio steps and the A2P fields they filled out", () => {
  const [body] = buildFeRetentionA2pOpsSmsBodies({
    businessId: "biz_two",
    businessName: "Second Agency",
    fromNumber: "+15559990000",
    profile,
    signedName: "Pat Owner",
  });
  assert.match(body, /Regulatory Compliance/);
  assert.match(body, /\+15559990000/);
  assert.match(body, /EIN: 123456789/);
  assert.match(body, /Second Agency LLC/);
  assert.match(body, /Pat Owner/);
  assert.match(body, /Customer Care/);
});

test("onboarding complete texts ops even when number purchase was simulated", async () => {
  const smsBodies = [];
  const result = await notifyFeRetentionOnboardingComplete({
    businessId: "biz_sim",
    businessName: "Sim Agency",
    fromNumber: "+15550000000",
    profile,
    signedName: "Pat Owner",
    agreementText: "agreement",
    notifyOperators: async () => ({ ok: true }),
    sendOpsSms: async ({ body }) => {
      smsBodies.push(body);
      return { ok: true, fromNumber: "+15551234567" };
    },
    deliveryProvider: {
      async send() {
        return { ok: true };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.sms?.ok, true);
  assert.equal(result.sms?.skipped, undefined);
  assert.match(smsBodies.join("\n"), /Sim Agency/);
  assert.match(smsBodies.join("\n"), /EIN: 123456789/);
});
