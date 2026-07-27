import assert from "node:assert/strict";
import { test } from "node:test";

import { buildOperatorActions } from "./buildOperatorActions.js";

test("carrier-pending A2P with Trust Hub + brand fields is not a platform exception", async () => {
  const actions = await buildOperatorActions({
    trustHubConfigured: true,
    businesses: [{ id: "biz_1", name: "Abc Dentistry" }],
    listCredentials: async () => ([
      {
        providerType: "twilio_sms",
        updatedAt: "2026-07-22T12:00:00.000Z",
        metadata: {
          provisionedBy: "platform",
          a2pRegistrationStatus: "pending",
          brandRegistrationSid: "BN123",
          fromNumber: "+16035550123",
          brand: {
            legalBusinessName: "Abc Dentistry LLC",
            ein: "12-3456789",
            website: "https://abcdental.example",
            contactEmail: "owner@abcdental.example",
            contactPhone: "+16035551212",
            messageSample1: "Sample one",
            messageSample2: "Sample two",
            messageFlow: "Patients opt in on the website intake form and agree to appointment texts.",
          },
        },
      },
    ]),
  });

  assert.equal(actions.length, 0);
});

test("missing Trust Hub creates a critical platform exception", async () => {
  const actions = await buildOperatorActions({
    trustHubConfigured: false,
    businesses: [{ id: "biz_1", name: "Abc Dentistry" }],
    listCredentials: async () => ([
      {
        providerType: "twilio_sms",
        updatedAt: "2026-07-22T12:00:00.000Z",
        metadata: {
          provisionedBy: "platform",
          a2pRegistrationStatus: "pending",
          fromNumber: "+16035550123",
          brand: {
            legalBusinessName: "Abc Dentistry LLC",
            ein: "12-3456789",
            website: "https://abcdental.example",
            contactEmail: "owner@abcdental.example",
            contactPhone: "+16035551212",
            messageSample1: "Sample one",
            messageSample2: "Sample two",
            messageFlow: "Patients opt in on the website intake form and agree to appointment texts.",
          },
        },
      },
    ]),
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "a2p_registration");
  assert.equal(actions[0].urgency, "critical");
  assert.equal(actions[0].payload.reason, "trust_hub_missing");
  assert.match(actions[0].steps[0], /TWILIO_A2P_CUSTOMER_PROFILE_SID/);
  assert.equal(actions[0].payload.fromNumber, "+16035550123");
  assert.equal(actions[0].payload.ein, "12-3456789");
});

test("failed A2P creates a platform exception", async () => {
  const actions = await buildOperatorActions({
    trustHubConfigured: true,
    businesses: [{ id: "biz_1", name: "Abc Dentistry" }],
    listCredentials: async () => ([
      {
        providerType: "twilio_sms",
        metadata: {
          provisionedBy: "platform",
          a2pRegistrationStatus: "failed",
          brandRegistrationSid: "BN123",
          brand: {
            legalBusinessName: "Abc Dentistry LLC",
            ein: "12-3456789",
          },
        },
      },
    ]),
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].payload.reason, "failed");
});

test("complete A2P does not create an operator action", async () => {
  const actions = await buildOperatorActions({
    trustHubConfigured: true,
    businesses: [{ id: "biz_1", name: "Done Co" }],
    listCredentials: async () => ([
      {
        providerType: "twilio_sms",
        metadata: {
          provisionedBy: "platform",
          a2pRegistrationStatus: "complete",
          brand: { legalBusinessName: "Done Co LLC", ein: "98-7654321" },
        },
      },
    ]),
  });
  assert.equal(actions.length, 0);
});
