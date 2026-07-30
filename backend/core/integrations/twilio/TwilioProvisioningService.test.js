import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isTwilioPlatformConfigured,
  normalizeBrandInput,
  provisionTwilioSmsForBusiness,
  resolveInboundSmsWebhookUrl,
  configureInboundSmsWebhook,
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
  const prevOrigin = process.env.NEXTAUTH_URL;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tokentest";
  process.env.NEXTAUTH_URL = "https://app.example.com";
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
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prevOrigin;
  }
});

test("resolveInboundSmsWebhookUrl builds the hosted inbound route from origin + businessId", () => {
  const prevOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://app.example.com";
  try {
    assert.equal(
      resolveInboundSmsWebhookUrl("biz_1"),
      "https://app.example.com/api/businesses/biz_1/integrations/sms/inbound",
    );
    assert.equal(resolveInboundSmsWebhookUrl(""), "");
  } finally {
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prevOrigin;
  }
});

test("live provision auto-configures the inbound SMS webhook when purchasing a number", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? String(init.body) : null });
    if (String(url).includes("AvailablePhoneNumbers")) {
      return { ok: true, json: async () => ({ available_phone_numbers: [{ phone_number: "+16035550123" }] }) };
    }
    if (String(url).includes("IncomingPhoneNumbers")) {
      return { ok: true, json: async () => ({ sid: "PN123", phone_number: "+16035550123", sms_url: "https://app.example.com/api/businesses/biz_live/integrations/sms/inbound" }) };
    }
    return { ok: false, json: async () => ({ message: "unexpected" }) };
  };

  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  const prevOrigin = process.env.NEXTAUTH_URL;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tokentest";
  process.env.NEXTAUTH_URL = "https://app.example.com";

  try {
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
    assert.equal(result.inboundWebhookUrl, "https://app.example.com/api/businesses/biz_live/integrations/sms/inbound");
    assert.equal(result.inboundWebhookConfigured, true);
    const purchaseCall = calls.find((c) => c.method === "POST" && c.url.includes("IncomingPhoneNumbers"));
    assert.match(purchaseCall.body, /SmsUrl=/);
  } finally {
    process.env.TWILIO_ACCOUNT_SID = prevSid;
    process.env.TWILIO_AUTH_TOKEN = prevToken;
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prevOrigin;
  }
});

test("configureInboundSmsWebhook points an existing number's SmsUrl at the platform route", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? String(init.body) : null });
    if (String(url).includes("IncomingPhoneNumbers.json?PhoneNumber")) {
      return { ok: true, json: async () => ({ incoming_phone_numbers: [{ sid: "PN999" }] }) };
    }
    if (String(url).includes("IncomingPhoneNumbers/PN999.json")) {
      return { ok: true, json: async () => ({ sid: "PN999", sms_url: "https://app.example.com/api/businesses/biz_existing/integrations/sms/inbound" }) };
    }
    return { ok: false, json: async () => ({ message: "unexpected" }) };
  };
  const prevOrigin = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://app.example.com";
  try {
    const result = await configureInboundSmsWebhook({
      businessId: "biz_existing",
      accountSid: "ACtest",
      authToken: "tokentest",
      fromNumber: "+16035550999",
      fetchImpl,
    });
    assert.equal(result.ok, true);
    assert.equal(result.configured, true);
    assert.equal(result.phoneSid, "PN999");
    const updateCall = calls.find((c) => c.method === "POST");
    assert.match(updateCall.body, /SmsUrl=/);
  } finally {
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prevOrigin;
  }
});

test("provisionTwilioSmsForBusiness fails with public_origin_required when the webhook origin is unresolved", async () => {
  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  const prevOrigin = process.env.NEXTAUTH_URL;
  const prevAppOrigin = process.env.APP_ORIGIN;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tokentest";
  delete process.env.NEXTAUTH_URL;
  delete process.env.APP_ORIGIN;

  try {
    const result = await provisionTwilioSmsForBusiness({
      businessId: "biz_no_origin",
      fetchImpl: async () => { throw new Error("fetch should not be called"); },
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
    assert.equal(result.ok, false);
    assert.equal(result.reason, "public_origin_required");

    // allowSendOnlyWithoutWebhook opts out of the origin requirement.
    const bypassed = await provisionTwilioSmsForBusiness({
      businessId: "biz_no_origin",
      allowSendOnlyWithoutWebhook: true,
      fetchImpl: async (url) => {
        if (String(url).includes("AvailablePhoneNumbers")) {
          return { ok: true, json: async () => ({ available_phone_numbers: [{ phone_number: "+16035550123" }] }) };
        }
        return { ok: true, json: async () => ({ sid: "PN123", phone_number: "+16035550123" }) };
      },
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
    assert.equal(bypassed.ok, true);
    assert.equal(bypassed.inboundWebhookConfigured, false);
  } finally {
    process.env.TWILIO_ACCOUNT_SID = prevSid;
    process.env.TWILIO_AUTH_TOKEN = prevToken;
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = prevOrigin;
    if (prevAppOrigin == null) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = prevAppOrigin;
  }
});

test("provisionTwilioSmsForBusiness configures the inbound webhook on a pool number and reports success", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? String(init.body) : null });
    if (String(url).includes("IncomingPhoneNumbers.json?PhoneNumber")) {
      return { ok: true, json: async () => ({ incoming_phone_numbers: [{ sid: "PNpool1" }] }) };
    }
    if (String(url).includes("IncomingPhoneNumbers/PNpool1.json")) {
      return { ok: true, json: async () => ({ sid: "PNpool1", sms_url: "https://app.example.com/api/businesses/biz_pool/integrations/sms/inbound" }) };
    }
    return { ok: false, json: async () => ({ message: "unexpected" }) };
  };

  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  const prevOrigin = process.env.NEXTAUTH_URL;
  const prevPool = process.env.TWILIO_PROVISION_POOL;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tokentest";
  process.env.NEXTAUTH_URL = "https://app.example.com";
  process.env.TWILIO_PROVISION_POOL = "+16035559000";

  try {
    const result = await provisionTwilioSmsForBusiness({
      businessId: "biz_pool",
      fetchImpl,
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
    assert.equal(result.fromNumber, "+16035559000");
    assert.equal(result.inboundWebhookConfigured, true);
    const updateCall = calls.find((c) => c.method === "POST");
    assert.match(updateCall.body, /SmsUrl=/);
  } finally {
    process.env.TWILIO_ACCOUNT_SID = prevSid;
    process.env.TWILIO_AUTH_TOKEN = prevToken;
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = prevOrigin;
    if (prevPool == null) delete process.env.TWILIO_PROVISION_POOL; else process.env.TWILIO_PROVISION_POOL = prevPool;
  }
});

test("provisionTwilioSmsForBusiness fails when a pool number's webhook cannot be configured", async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes("IncomingPhoneNumbers.json?PhoneNumber")) {
      return { ok: true, json: async () => ({ incoming_phone_numbers: [] }) };
    }
    return { ok: false, json: async () => ({ message: "unexpected" }) };
  };

  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  const prevOrigin = process.env.NEXTAUTH_URL;
  const prevPool = process.env.TWILIO_PROVISION_POOL;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "tokentest";
  process.env.NEXTAUTH_URL = "https://app.example.com";
  process.env.TWILIO_PROVISION_POOL = "+16035559001";

  try {
    const result = await provisionTwilioSmsForBusiness({
      businessId: "biz_pool_fail",
      fetchImpl,
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
    assert.equal(result.ok, false);
    assert.equal(result.reason, "phone_sid_unresolved");
  } finally {
    process.env.TWILIO_ACCOUNT_SID = prevSid;
    process.env.TWILIO_AUTH_TOKEN = prevToken;
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = prevOrigin;
    if (prevPool == null) delete process.env.TWILIO_PROVISION_POOL; else process.env.TWILIO_PROVISION_POOL = prevPool;
  }
});

test("configureInboundSmsWebhook fails clearly when origin cannot be resolved", async () => {
  const prevOrigin = process.env.NEXTAUTH_URL;
  const prevAppOrigin = process.env.APP_ORIGIN;
  delete process.env.NEXTAUTH_URL;
  delete process.env.APP_ORIGIN;
  try {
    const result = await configureInboundSmsWebhook({ businessId: "biz_1", accountSid: "AC", authToken: "tok" });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "webhook_url_unresolved");
  } finally {
    if (prevOrigin == null) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = prevOrigin;
    if (prevAppOrigin == null) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = prevAppOrigin;
  }
});
