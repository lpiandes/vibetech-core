import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { OnboardingRuntime } from "../../onboarding/OnboardingRuntime.js";
import { createOnboardingEvent } from "../../onboarding/OnboardingEvent.js";
import { ONBOARDING_EVENT_TYPES } from "../../onboarding/OnboardingEventTypes.js";

import { BusinessCapabilityEngine } from "./BusinessCapabilityEngine.js";
import { CapabilityRegistry } from "./CapabilityRegistry.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:00:10.000Z";
const NOW2 = "2026-07-01T00:00:20.000Z";

function completeStep({ onboardingRuntime, stepId, nowISO }) {
  onboardingRuntime.applyEvent(
    createOnboardingEvent({
      id: `evt_complete_${stepId}_${nowISO}`,
      timestampISO: nowISO,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
      source: "test",
      payload: { stepId },
    }),
  );
}

test("Requirement evaluation: initial onboarding yields NOT_STARTED and seeded recommendations", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime, onboardingRuntime, nowISO: NOW0 });

  const identity = result.capabilities.find((c) => c.id === "company_identity");
  assert.equal(identity.status, "READY");
  assert.equal(identity.health, "HEALTHY");
  assert.equal(identity.recommendations.length, 0);
  assert.ok(Object.isFrozen(identity));
  assert.ok(Object.isFrozen(result));
});

test("Dependency resolution: brand setup makes brand READY (BusinessProfile drives dependency)", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  // Complete identity + brand setup, but do not complete business_setup onboarding step.
  completeStep({ onboardingRuntime, stepId: "company_profile", nowISO: NOW1 });
  completeStep({ onboardingRuntime, stepId: "brand_setup", nowISO: NOW2 });

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime, onboardingRuntime, nowISO: NOW2 });

  const brand = result.capabilities.find((c) => c.id === "brand");
  // Brand depends on the BusinessProfile capability (not the onboarding business_setup step).
  assert.notEqual(brand.status, "BLOCKED");
  assert.equal(brand.status, "READY");
  assert.equal(brand.health, "HEALTHY");
});

test("Metrics: once one capability is READY and others are not, overall readiness becomes IN_PROGRESS", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  completeStep({ onboardingRuntime, stepId: "company_profile", nowISO: NOW1 });

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime, onboardingRuntime, nowISO: NOW1 });

  assert.equal(result.overallReadiness, "IN_PROGRESS");
  assert.ok(result.completionPercentage > 0);
  assert.ok(result.completedCapabilities >= 1);
});

test("Circular dependency detection: additional capabilities forming a cycle causes engine throw", () => {
  const companyRuntime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const capA = {
    id: "capA",
    name: "Cap A",
    description: "test",
    category: "platform",
    dependencies: ["capB"],
    requirements: [],
    providedFeatures: [],
    industrySupport: ["any"],
    recommendationSeeds: [],
  };
  const capB = {
    id: "capB",
    name: "Cap B",
    description: "test",
    category: "platform",
    dependencies: ["capA"],
    requirements: [],
    providedFeatures: [],
    industrySupport: ["any"],
    recommendationSeeds: [],
  };

  const registry = new CapabilityRegistry({ additionalCapabilities: [capA, capB] });
  const engine = new BusinessCapabilityEngine({ registry });

  assert.throws(() => {
    engine.evaluate({ companyRuntime, onboardingRuntime, nowISO: NOW0 });
  });
});

