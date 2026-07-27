import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isTwilioPlatformConfigured,
  normalizeBrandInput,
  provisionTwilioSmsForBusiness,
} from "./TwilioProvisioningService.js";

test("normalizeBrandInput requires core business address fields", () => {
  const bad = normalizeBrandInput({ legalBusinessName: "Abc Dentistry" });
  assert.equal(bad.ok, false);
  assert.ok(bad.missing.includes("city"));
  assert.ok(bad.missing.includes("ein"));
  assert.ok(bad.missing.includes("contactEmail"));

  const ok = normalizeBrandInput({
    legalBusinessName: "Abc Dentistry LLC",
    dba: "Abc Dentistry",
    ein: "12-3456789",
    website: "https://example.com",
    businessType: "LLC",
    businessIndustry: "HEALTHCARE",
    addressLine1: "1 Main St",
    city: "Nashua",
    region: "NH",
    postalCode: "03060",
    areaCode: "603",
    contactFirstName: "Leo",
    contactLastName: "Piandes",
    contactEmail: "owner@example.com",
    contactPhone: "+16035551212",
    messageSample1: "Abc Dentistry: your cleaning is tomorrow at 10am. Reply STOP to opt out.",
    messageSample2: "Abc Dentistry: thanks for visiting — reply YES to confirm your follow-up.",
    messageFlow: "Patients opt in by providing their mobile number on our website intake form and checking a box agreeing to receive appointment texts from Abc Dentistry. Reply STOP to opt out.",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.dba, "Abc Dentistry");
  assert.equal(ok.areaCode, "603");
  assert.equal(ok.messageSamples.length, 2);
});

test("simulated provision returns a from number without live Twilio", async () => {
  const result = await provisionTwilioSmsForBusiness({
    businessId: "biz_test_1",
    simulate: true,
    brand: {
      legalBusinessName: "Abc Dentistry LLC",
      ein: "12-3456789",
      website: "https://example.com",
      addressLine1: "1 Main St",
      city: "Nashua",
      region: "NH",
      postalCode: "03060",
      contactFirstName: "Leo",
      contactLastName: "Owner",
      contactEmail: "owner@example.com",
      contactPhone: "+16035551212",
      messageSample1: "Abc Dentistry: your cleaning is tomorrow at 10am. Reply STOP to opt out.",
      messageSample2: "Abc Dentistry: reply YES to confirm your follow-up appointment.",
      messageFlow: "Patients opt in by providing their mobile number on our website intake form and checking a box agreeing to receive appointment texts from Abc Dentistry.",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.equal(result.provisionedBy, "platform");
  assert.equal(result.a2pRegistrationStatus, "pending");
  assert.match(String(result.fromNumber), /^\+1/);
});

test("live provision buys first available local number", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET" });
    if (String(url).includes("AvailablePhoneNumbers")) {
      return {
        ok: true,
        json: async () => ({
          available_phone_numbers: [{ phone_number: "+16035550123" }],
        }),
      };
    }
    if (String(url).includes("IncomingPhoneNumbers")) {
      return {
        ok: true,
        json: async () => ({ sid: "PN123", phone_number: "+16035550123" }),
      };
    }
    return { ok: false, json: async () => ({ message: "unexpected" }) };
  };

  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  const prevSim = process.env.TWILIO_PROVISION_SIMULATE;
  const prevPool = process.env.TWILIO_PROVISION_POOL;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tokentest";
  delete process.env.TWILIO_PROVISION_SIMULATE;
  delete process.env.TWILIO_PROVISION_POOL;

  try {
    assert.equal(isTwilioPlatformConfigured(), true);
    const result = await provisionTwilioSmsForBusiness({
      businessId: "biz_live",
      fetchImpl,
      brand: {
        legalBusinessName: "Abc Dentistry LLC",
        ein: "12-3456789",
        website: "https://example.com",
        addressLine1: "1 Main St",
        city: "Nashua",
        region: "NH",
        postalCode: "03060",
        areaCode: "603",
        contactFirstName: "Leo",
        contactLastName: "Owner",
        contactEmail: "owner@example.com",
        contactPhone: "+16035551212",
        messageSample1: "Abc Dentistry: your cleaning is tomorrow at 10am. Reply STOP to opt out.",
        messageSample2: "Abc Dentistry: reply YES to confirm your follow-up appointment.",
        messageFlow: "Patients opt in by providing their mobile number on our website intake form and checking a box agreeing to receive appointment texts from Abc Dentistry.",
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.fromNumber, "+16035550123");
    assert.equal(result.phoneSid, "PN123");
    assert.ok(calls.some((c) => c.url.includes("AvailablePhoneNumbers")));
    assert.ok(calls.some((c) => c.method === "POST" && c.url.includes("IncomingPhoneNumbers")));
  } finally {
    process.env.TWILIO_ACCOUNT_SID = prevSid;
    process.env.TWILIO_AUTH_TOKEN = prevToken;
    if (prevSim == null) delete process.env.TWILIO_PROVISION_SIMULATE;
    else process.env.TWILIO_PROVISION_SIMULATE = prevSim;
    if (prevPool == null) delete process.env.TWILIO_PROVISION_POOL;
    else process.env.TWILIO_PROVISION_POOL = prevPool;
  }
});
