import test from "node:test";
import assert from "node:assert/strict";
import { mapFeA2pProfileToTwilioBrand } from "./mapFeA2pProfileToTwilioBrand.js";

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

test("mapFeA2pProfileToTwilioBrand maps insurance customer care campaign", () => {
  const brand = mapFeA2pProfileToTwilioBrand(profile);
  assert.equal(brand.legalBusinessName, "Senior Advisors insurance LLC");
  assert.equal(brand.ein, "123456789");
  assert.equal(brand.campaignUseCase, "CUSTOMER_CARE");
  assert.match(brand.campaignDescription, /policy-related customer care/i);
  assert.match(brand.messageFlow, /agent adds their mobile number/i);
  assert.equal(brand.messageSamples.length, 3);
  assert.match(brand.messageSamples[0], /welcome/i);
  assert.match(brand.messageSamples[1], /missed a payment|reinstated/i);
  assert.match(brand.privacyPolicyUrl, /privacy\.html/);
});

test("mapFeA2pProfileToTwilioBrand uses keyword opt-in flow when keywords set", () => {
  const brand = mapFeA2pProfileToTwilioBrand({
    ...profile,
    optInKeywords: "START",
  });
  assert.match(brand.messageFlow, /texting START/i);
});
