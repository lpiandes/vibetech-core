import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyProfileBuilder } from "../profile/CompanyProfileBuilder.js";
import { createCompanyProfile } from "../profile/CompanyProfile.js";
import { BusinessProfileBuilder } from "../business-profile/BusinessProfileBuilder.js";
import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { CommunicationSetupBuilder } from "./CommunicationSetupBuilder.js";

import { BusinessCapabilityEngine } from "../../capabilities/engine/BusinessCapabilityEngine.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeCompanyProfileWithIdentity({ replyEmail } = {}) {
  return createCompanyProfile(
    CompanyProfileBuilder.build({
      identity: { companyName: "ABC Property Group", industry: "Property Management" },
      profileOverrides: {
        communications: { replyEmail: replyEmail ?? "reply@abc.com" },
        general: {
          primaryContact: {
            name: "Jane Doe",
            email: "jane@abc.com",
            phone: "+1 5551234567",
          },
          website: "https://example.com",
          address: {
            line1: "1 Main St",
            city: "Hartford",
            state: "CT",
            postalCode: "06101",
            country: "US",
          },
        },
        metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 },
      },
    }),
  );
}

function makeBusinessProfile({ companyProfile } = {}) {
  return BusinessProfileBuilder.build({
    companyProfile,
    overrides: { metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 } },
    nowISO: NOW0,
  });
}

test("CommunicationSetup: derived readiness is COMPLETE when identity + business hours + approval are present", () => {
  const companyProfile = makeCompanyProfileWithIdentity({ replyEmail: "reply@abc.com" });
  const businessProfile = makeBusinessProfile({ companyProfile });
  const approvalRules = [
    {
      ruleType: "outbound_buyer_communication_requires_approval",
      enabled: true,
      description: "approval required",
    },
  ];

  const setup = CommunicationSetupBuilder.build({
    companyProfile,
    businessProfile,
    approvalRules,
    nowISO: NOW0,
  });

  assert.ok(Object.isFrozen(setup));
  assert.ok(Object.isFrozen(setup.readiness));
  assert.equal(setup.metadata.validation.ok, true);
  assert.equal(setup.metadata.completionPercent, 100);
  assert.equal(setup.readiness.emailReady, true);
  assert.equal(setup.readiness.smsReady, true);
  assert.equal(setup.readiness.brandReady, true);
  assert.equal(setup.readiness.quietHoursReady, true);
  assert.equal(setup.readiness.approvalPolicyReady, true);
});

test("CommunicationSetup: sender identity + email signature/footer match CompanyProfile", () => {
  const companyProfile = makeCompanyProfileWithIdentity({ replyEmail: "reply@abc.com" });
  const businessProfile = makeBusinessProfile({ companyProfile });
  const setup = CommunicationSetupBuilder.build({
    companyProfile,
    businessProfile,
    approvalRules: [],
    nowISO: NOW0,
  });

  assert.equal(setup.sender.senderName, companyProfile.communications.senderName);
  assert.equal(setup.sender.replyEmail, companyProfile.communications.replyEmail);
  assert.equal(setup.sender.senderEmail, companyProfile.communications.replyEmail);
  assert.equal(setup.sender.displayName, companyProfile.communications.senderName);

  assert.equal(setup.emailBranding.emailSignature, companyProfile.communications.emailSignature);
  assert.equal(setup.emailBranding.emailFooter, companyProfile.communications.emailFooter);
});

test("Runtime integration: CompanyWorkspaceRuntime exposes getCommunicationSetup (and returns frozen data)", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const setup = runtime.getCommunicationSetup();

  assert.ok(setup);
  assert.ok(Object.isFrozen(setup));
  assert.ok(Object.isFrozen(setup.readiness));

  // Seeded CompanyProfile does not include replyEmail, so email readiness is expected to be false,
  // while quiet hours should still be derived from deterministic business hours.
  assert.equal(setup.readiness.quietHoursReady, true);
  assert.equal(setup.readiness.emailReady, false);
});

test("Capability evaluation: Communications capability becomes READY when CommunicationSetup readiness is READY", () => {
  const companyProfile = makeCompanyProfileWithIdentity({ replyEmail: "reply@abc.com" });
  const businessProfile = makeBusinessProfile({ companyProfile });

  const setup = CommunicationSetupBuilder.build({
    companyProfile,
    businessProfile,
    approvalRules: [
      {
        ruleType: "outbound_buyer_communication_requires_approval",
        enabled: true,
        description: "approval required",
      },
    ],
    nowISO: NOW0,
  });

  const companyRuntimeStub = {
    getCompany: () => ({ industry: "Property Management" }),
    getCompanyProfile: () => ({
      metadata: { validation: { ok: true }, completionPercent: 100 },
    }),
    getBusinessProfile: () => ({
      metadata: { validation: { ok: true }, completionPercent: 100 },
    }),
    getIntegrations: () => [{ connected: true }],
    getCommunicationSetup: () => setup,
    getMetrics: () => ({ pendingReviews: 0 }),
    getKnowledgeRepository: () => ({ items: [] }),
  };

  const onboardingRuntimeStub = {
    getSteps: () => [
      { id: "brand_setup", status: "COMPLETED" },
      { id: "integrations", status: "COMPLETED" },
      { id: "company_profile", status: "COMPLETED" },
      { id: "business_setup", status: "COMPLETED" },
    ],
  };

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({
    companyRuntime: companyRuntimeStub,
    onboardingRuntime: onboardingRuntimeStub,
    nowISO: NOW0,
  });

  const communications = result.capabilities.find((c) => c.id === "communications");
  assert.ok(communications);
  assert.equal(communications.status, "READY");
  assert.equal(communications.health, "HEALTHY");
  assert.equal(communications.completionPercent, 100);
});

