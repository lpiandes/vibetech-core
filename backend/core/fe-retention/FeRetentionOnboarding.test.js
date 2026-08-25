import test from "node:test";
import assert from "node:assert/strict";
import {
  feA2pProfileIsComplete,
  normalizeFeA2pProfile,
  readFeRetentionOnboarding,
  writeFeRetentionOnboarding,
  resolveFeRetentionContinuePath,
  feRetentionMayProvisionSms,
} from "./FeRetentionOnboarding.js";
import { writeFeRetentionBilling } from "./FeRetentionBilling.js";
import { buildFeRetentionEngagementAgreement } from "./FeRetentionEngagementAgreement.js";

const completeProfile = {
  legalBusinessName: "Second Agency LLC",
  businessType: "Limited Liability Corporation",
  ein: "12-3456789",
  businessIndustry: "INSURANCE",
  websiteUrl: "https://secondagency.example",
  privacyPolicyUrl: "https://vtechdevelopment.com/privacy.html",
  termsUrl: "https://vtechdevelopment.com/terms.html",
  optInKeywords: "",
  optInMessage: "",
  street: "1 Main St",
  city: "Nashua",
  region: "NH",
  postalCode: "03060",
  notifyEmail: "owner@example.com",
  contactFirstName: "Pat",
  contactLastName: "Owner",
  contactEmail: "owner@example.com",
  businessTitle: "Owner",
  contactPhone: "6035551212",
  jobPosition: "CEO",
  preferredAreaCode: "978",
};

test("A2P profile is incomplete until required fields are present", () => {
  assert.equal(feA2pProfileIsComplete({}), false);
  assert.equal(feA2pProfileIsComplete(completeProfile), true);
  assert.equal(normalizeFeA2pProfile(completeProfile).ein, "123456789");
  assert.equal(normalizeFeA2pProfile({ ...completeProfile, websiteUrl: "agency.com" }).websiteUrl, "https://agency.com");
  assert.equal(feA2pProfileIsComplete({ ...completeProfile, websiteUrl: "agency.com" }), true);
  assert.equal(feA2pProfileIsComplete({ ...completeProfile, privacyPolicyUrl: "" }), false);
  assert.equal(feA2pProfileIsComplete({ ...completeProfile, termsUrl: "" }), false);
  assert.equal(feA2pProfileIsComplete({
    ...completeProfile,
    optInKeywords: "START",
    optInMessage: "short",
  }), false);
  assert.equal(feA2pProfileIsComplete({
    ...completeProfile,
    optInKeywords: "START",
    optInMessage: "You are opted in to policy reminders. Reply HELP for help, STOP to cancel.",
  }), true);
});

test("pre-Stripe books still must complete A2P and the agreement before SMS", () => {
  const pkg = { purchasedPackages: ["fe_retention_crm"] };
  const onboarding = readFeRetentionOnboarding(pkg);
  assert.equal(onboarding.skipsGate, false);
  assert.equal(onboarding.onboardingComplete, false);
  assert.equal(feRetentionMayProvisionSms(pkg), false);
  assert.match(resolveFeRetentionContinuePath({ businessId: "biz_dad", packageConfiguration: pkg }), /setup/);
});

test("paid books cannot use the dashboard or buy a number until A2P + signature", () => {
  const paid = writeFeRetentionBilling({}, { status: "complimentary" });
  assert.equal(readFeRetentionOnboarding(paid).onboardingComplete, false);
  assert.equal(feRetentionMayProvisionSms(paid), false);
  assert.equal(resolveFeRetentionContinuePath({ businessId: "biz_2", packageConfiguration: paid }), "/insurance/setup/biz_2");

  const withProfile = writeFeRetentionOnboarding(paid, { profile: completeProfile });
  assert.equal(readFeRetentionOnboarding(withProfile).profileComplete, true);
  assert.equal(readFeRetentionOnboarding(withProfile).onboardingComplete, false);
  assert.match(resolveFeRetentionContinuePath({ businessId: "biz_2", packageConfiguration: withProfile }), /agreement/);

  const signed = writeFeRetentionOnboarding(withProfile, {
    agreement: { signedName: "Pat Owner", signedAt: "2026-08-14T18:00:00.000Z", documentVersion: "2026-08-14" },
  });
  assert.equal(readFeRetentionOnboarding(signed).onboardingComplete, true);
  assert.equal(feRetentionMayProvisionSms(signed), true);
  assert.equal(resolveFeRetentionContinuePath({ businessId: "biz_2", packageConfiguration: signed }), "/insurance/biz_2");
});

test("engagement agreement includes the legal name and address", () => {
  const doc = buildFeRetentionEngagementAgreement({
    profile: completeProfile,
    signedName: "Pat Owner",
    signedAt: "2026-08-14T18:00:00.000Z",
  });
  assert.match(doc.text, /Second Agency LLC/);
  assert.match(doc.text, /1 Main St/);
  assert.match(doc.text, /Pat Owner/);
  assert.match(doc.html, /Limitation of liability/);
  assert.match(doc.html, /VibeTech Development/);
  assert.match(doc.html, /vibetech-wordmark/);
});
