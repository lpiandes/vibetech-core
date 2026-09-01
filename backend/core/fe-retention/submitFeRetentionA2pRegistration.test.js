import test from "node:test";
import assert from "node:assert/strict";
import { submitFeRetentionA2pRegistration, refreshFeRetentionA2pRegistration } from "./submitFeRetentionA2pRegistration.js";
import { feSmsCredentialId } from "./FeRetentionSms.js";

function makeStore(initialCred = null) {
  let cred = initialCred;
  return {
    async getIntegrationCredential(id) {
      if (cred && cred.credentialId === id) return cred;
      return null;
    },
    async upsertIntegrationCredential(row) {
      cred = row;
      return row;
    },
  };
}

const profile = {
  legalBusinessName: "Senior Advisors insurance LLC",
  businessType: "Limited Liability Corporation",
  ein: "123456789",
  businessIndustry: "INSURANCE",
  websiteUrl: "https://senioradvisors.example.com",
  privacyPolicyUrl: "https://vtechdevelopment.com/privacy.html",
  termsUrl: "https://vtechdevelopment.com/terms.html",
  street: "1 Main St",
  city: "Nashua",
  region: "NH",
  postalCode: "03060",
  contactFirstName: "Kerry",
  contactLastName: "Piandes",
  contactEmail: "kpiandes@senioradvisorsllc.com",
  contactPhone: "6038182383",
  businessTitle: "Owner",
  jobPosition: "CEO",
  notifyEmail: "kpiandes@senioradvisorsllc.com",
  preferredAreaCode: "617",
};

test("submitFeRetentionA2pRegistration is idempotent when Trust Hub + brand already exist", async () => {
  const businessId = "biz_a2p_idempotent";
  const credentialId = feSmsCredentialId(businessId);
  const platformStore = makeStore({
    credentialId,
    secrets: {
      accountSid: "ACtest",
      authToken: "token",
      fromNumber: "+16179173739",
    },
    metadata: {
      fromNumber: "+16179173739",
      phoneSid: "PNexisting",
      customerProfileSid: "BU_existing_cp",
      a2pProfileBundleSid: "BU_existing_a2p",
      messagingServiceSid: "MG_existing",
      brandRegistrationSid: "BN_existing",
      campaignSid: "QE_existing",
      a2pRegistrationStatus: "pending",
      feA2pProduct: "vibekeep",
    },
    workspaceId: businessId,
    providerType: "twilio_sms",
  });

  process.env.TWILIO_A2P_SIMULATE = "1";
  const prevSid = process.env.TWILIO_ACCOUNT_SID;
  const prevToken = process.env.TWILIO_AUTH_TOKEN;
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "token";

  try {
    const result = await submitFeRetentionA2pRegistration({
      platformStore,
      businessId,
      profile,
      fromNumber: "+16179173739",
      vault: { put() { return {}; } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.a2pRegistrationStatus, "pending");
    assert.ok(result.brandRegistrationSid);
    assert.equal(result.customerProfileSid, "BU_existing_cp");
  } finally {
    delete process.env.TWILIO_A2P_SIMULATE;
    if (prevSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = prevSid;
    if (prevToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = prevToken;
  }
});

test("submitFeRetentionA2pRegistration simulated happy path creates SIDs", async () => {
  const businessId = "biz_a2p_new";
  const platformStore = makeStore({
    credentialId: feSmsCredentialId(businessId),
    secrets: {
      accountSid: "ACtest",
      authToken: "token",
      fromNumber: "+16175551212",
    },
    metadata: { fromNumber: "+16175551212", phoneSid: "PNnew" },
    workspaceId: businessId,
    providerType: "twilio_sms",
  });

  process.env.TWILIO_A2P_SIMULATE = "1";
  process.env.TWILIO_PROVISION_SIMULATE = "1";
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "token";

  try {
    const result = await submitFeRetentionA2pRegistration({
      platformStore,
      businessId,
      profile,
      fromNumber: "+16175551212",
      vault: { put() { return {}; } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.a2pRegistrationStatus, "pending");
    assert.ok(result.customerProfileSid);
    assert.ok(result.brandRegistrationSid);
    assert.ok(result.messagingServiceSid);
  } finally {
    delete process.env.TWILIO_A2P_SIMULATE;
    delete process.env.TWILIO_PROVISION_SIMULATE;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
  }
});

test("refreshFeRetentionA2pRegistration requires brand SID", async () => {
  const businessId = "biz_no_brand";
  const platformStore = makeStore({
    credentialId: feSmsCredentialId(businessId),
    secrets: { accountSid: "ACtest", authToken: "token", fromNumber: "+16175551212" },
    metadata: { fromNumber: "+16175551212" },
    workspaceId: businessId,
    providerType: "twilio_sms",
  });
  const result = await refreshFeRetentionA2pRegistration({ platformStore, businessId });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "brand_not_submitted");
});
