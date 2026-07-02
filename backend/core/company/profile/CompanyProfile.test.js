import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { OnboardingRuntime } from "../../onboarding/OnboardingRuntime.js";

import { CompanyProfileBuilder } from "./CompanyProfileBuilder.js";
import { createCompanyProfile } from "./CompanyProfile.js";
import { CompanyProfileValidator } from "./CompanyProfileValidator.js";

import { BusinessCapabilityEngine } from "../../capabilities/engine/BusinessCapabilityEngine.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("CompanyProfile: builder creates immutable profile + derived values", () => {
  const profile = createCompanyProfile(
    CompanyProfileBuilder.build({
      identity: { companyName: "ABC Property Group", industry: "Property Management" },
      profileOverrides: {
        metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 },
        general: {
          website: "https://example.com",
          primaryContact: {
            name: "Jane Doe",
            email: "jane@example.com",
            phone: "+1 5551234567",
          },
          address: {
            line1: "1 Main St",
            city: "Hartford",
            state: "CT",
            postalCode: "06101",
            country: "US",
          },
        },
        communications: {
          replyEmail: "reply@example.com",
        },
      },
    }),
  );

  assert.ok(Object.isFrozen(profile));
  assert.ok(Object.isFrozen(profile.general));
  assert.ok(Object.isFrozen(profile.metadata));

  assert.equal(profile.derived.companyInitials, "AP");
  assert.equal(profile.communications.senderName, "Jane Doe");
  assert.ok(profile.communications.emailSignature.includes("Jane Doe"));
  assert.ok(profile.communications.emailFooter.includes("©"));
  assert.ok(profile.metadata.completionStatus === "COMPLETE");
  assert.equal(profile.metadata.completionPercent, 100);

  const validation = CompanyProfileValidator.validate({ profile });
  assert.equal(validation.validation.ok, true);
  assert.equal(validation.completionPercent, 100);
});

test("CompanyProfile: validation + completion are low when required fields are missing", () => {
  const profile = createCompanyProfile(
    CompanyProfileBuilder.build({
      identity: { companyName: "ABC Property Group", industry: "Property Management" },
      profileOverrides: {
        metadata: { createdAtISO: NOW0, updatedAtISO: NOW0, version: 1 },
      },
    }),
  );

  assert.ok(Object.isFrozen(profile));
  assert.equal(profile.metadata.completionStatus, "IN_PROGRESS");
  assert.equal(profile.metadata.completionPercent, 60);
  assert.equal(profile.metadata.validation.ok, true);
  assert.equal(profile.metadata.validation.issues.length, 0);
});

test("Runtime integration: CompanyWorkspaceRuntime owns getCompanyProfile()", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const profile = runtime.getCompanyProfile();

  assert.ok(profile);
  assert.equal(profile.general.companyName, "ABC Property Group");
  assert.ok(Object.isFrozen(profile));
  assert.equal(profile.metadata.completionPercent, 60);
});

test("Capability evaluation: Company Identity depends on CompanyProfile validation/completion", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime, onboardingRuntime, nowISO: NOW0 });
  const identity = result.capabilities.find((c) => c.id === "company_identity");

  assert.ok(identity);
  assert.equal(identity.status, "READY");
  assert.equal(identity.completionPercent, 60);
});

