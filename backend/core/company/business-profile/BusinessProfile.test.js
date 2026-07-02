import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { CompanyProfileBuilder } from "../profile/CompanyProfileBuilder.js";
import { createCompanyProfile } from "../profile/CompanyProfile.js";

import { BusinessProfileBuilder } from "./BusinessProfileBuilder.js";
import { BusinessProfileValidator } from "./BusinessProfileValidator.js";

import { BusinessCapabilityEngine } from "../../capabilities/engine/BusinessCapabilityEngine.js";
import { OnboardingRuntime } from "../../onboarding/OnboardingRuntime.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("BusinessProfile: builder creates immutable profile with completion and derived metadata", () => {
  const companyProfile = createCompanyProfile(
    CompanyProfileBuilder.build({
      identity: { companyName: "ABC Property Group", industry: "Property Management" },
      profileOverrides: {
        metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 },
        general: {
          // Intentionally omit optional website/contact/address; BusinessProfile validity does not require them.
        },
      },
    }),
  );

  const businessProfile = BusinessProfileBuilder.build({
    companyProfile,
    overrides: { metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 } },
    nowISO: NOW0,
  });

  assert.ok(Object.isFrozen(businessProfile));
  assert.ok(Object.isFrozen(businessProfile.metadata));
  assert.equal(businessProfile.metadata.completionStatus, "COMPLETE");
  assert.equal(businessProfile.metadata.completionPercent, 100);
  assert.equal(businessProfile.metadata.validation.ok, true);

  // Derived recommendation metadata comes from the selected industry template.
  assert.ok(businessProfile.metadata.derived.templateId);
  assert.ok(Array.isArray(businessProfile.metadata.derived.recommendations.recommendedCapabilities));
});

test("BusinessProfile: validation reports non-ok when required fields are missing", () => {
  const badProfile = {
    industry: { primaryIndustry: "", industryTemplate: { id: "" } },
    operatingModel: "",
    businessSegments: [],
    servicesOffered: [],
    customerTypes: [],
    serviceAreas: [],
    companySize: "",
    languagesSupported: [],
    emergencyServices: false,
    appointmentBased: false,
    remoteOrOnsite: "HYBRID",
    businessGoals: [],
    industryTemplate: {},
    metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 },
  };

  const validation = BusinessProfileValidator.validate({ profile: badProfile });
  assert.equal(validation.validation.ok, false);
  assert.ok(validation.validation.issues.length > 0);
  assert.ok(validation.completionPercent < 100);
});

test("Runtime integration: CompanyWorkspaceRuntime exposes getBusinessProfile()", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const businessProfile = runtime.getBusinessProfile();
  assert.ok(businessProfile);
  assert.equal(businessProfile.industry.primaryIndustry, "Property Management");
  assert.equal(businessProfile.metadata.completionPercent, 100);
  assert.ok(Object.isFrozen(businessProfile));
});

test("Capability evaluation: Business Profile uses BusinessProfile validation + completion", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime, onboardingRuntime, nowISO: NOW0 });
  const bp = result.capabilities.find((c) => c.id === "business_profile");

  assert.ok(bp);
  assert.equal(bp.status, "READY");
  assert.equal(bp.health, "HEALTHY");
  assert.equal(bp.completionPercent, 100);
});

