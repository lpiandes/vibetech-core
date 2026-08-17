import test from "node:test";
import assert from "node:assert/strict";
import { buildFeRetentionA2pAttachOpsAction, notifyFeRetentionOnboardingComplete } from "./FeRetentionA2pOps.js";

test("A2P ops email tells Leo to register this agency as its own brand", () => {
  const action = buildFeRetentionA2pAttachOpsAction({
    businessId: "biz_two",
    businessName: "Second Agency",
    fromNumber: "+15559990000",
    profile: { ein: "123456789", legalBusinessName: "Second Agency LLC" },
    signedName: "Pat Owner",
  });
  assert.match(action.title, /Second Agency/);
  assert.match(action.summary, /not dad/i);
  assert.ok(action.steps.some((step) => step.includes("+15559990000")));
  assert.ok(action.steps.some((step) => /EIN: 123456789/.test(step)));
  assert.equal(action.payload.fromNumber, "+15559990000");
});

test("onboarding complete still emails ops when number purchase was simulated", async () => {
  let opsEmailed = false;
  let packetEmailed = false;
  const result = await notifyFeRetentionOnboardingComplete({
    businessId: "biz_sim",
    businessName: "Sim Agency",
    fromNumber: "+15550000000",
    profile: { ein: "123456789" },
    signedName: "Pat Owner",
    simulated: true,
    agreementText: "agreement",
    notifyOperators: async () => {
      opsEmailed = true;
      return { ok: true };
    },
    deliveryProvider: {
      async send() {
        packetEmailed = true;
        return { ok: true };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, undefined);
  assert.equal(result.sms?.skipped, true);
  assert.equal(opsEmailed, true);
  assert.equal(packetEmailed, true);
});
