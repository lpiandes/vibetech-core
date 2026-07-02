import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { ConnectedSystemBuilder } from "./ConnectedSystemBuilder.js";

import { OnboardingRuntime } from "../../onboarding/OnboardingRuntime.js";
import { createOnboardingEvent } from "../../onboarding/OnboardingEvent.js";
import { ONBOARDING_EVENT_TYPES } from "../../onboarding/OnboardingEventTypes.js";
import { BusinessCapabilityEngine } from "../../capabilities/engine/BusinessCapabilityEngine.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

test("Runtime integration: CompanyWorkspaceRuntime exposes frozen getConnectedSystems()", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const systems = runtime.getConnectedSystems();

  assert.ok(Array.isArray(systems));
  assert.ok(Object.isFrozen(systems));
  for (const s of systems) {
    assert.ok(Object.isFrozen(s));
    assert.equal(typeof s.id, "string");
    assert.ok(Array.isArray(s.features));
  }

  // Knowledge OS derived system should be READY in seeded runtime.
  const knowledgeSystem = systems.find((x) => x.id === "cs_knowledge_os");
  assert.ok(knowledgeSystem);
  assert.equal(knowledgeSystem.status, "READY");
});

test("ConnectedSystemBuilder: features are derived from category/provider (email/website/knowledge)", () => {
  const integrations = [
    { type: "email", connected: true, vendor: "Email Provider" },
    { type: "website", connected: true, vendor: "Website Intake" },
    { type: "crm", connected: false, vendor: "CRM Vendor" },
  ];

  const knowledgeRepository = {
    items: [
      {
        id: "kn_1",
        status: "ACTIVE",
      },
    ],
  };
  const knowledgeCategories = { items: [{ id: "cat_1", status: "ACTIVE" }] };

  const snapshot = ConnectedSystemBuilder.buildSnapshot({
    integrations,
    knowledgeRepository,
    knowledgeCategories,
  });

  const email = snapshot.find((x) => x.id === "cs_email");
  const website = snapshot.find((x) => x.id === "cs_website");
  const knowledge = snapshot.find((x) => x.id === "cs_knowledge_os");

  assert.ok(email);
  assert.ok(email.features.includes("Send Email"));
  assert.ok(email.features.includes("Receive Email"));

  assert.ok(website);
  assert.ok(website.features.includes("Intake"));
  assert.ok(website.features.includes("Lead Capture"));

  assert.ok(knowledge);
  assert.ok(knowledge.features.includes("Knowledge Repository"));
});

test("Capability readiness: Connections (capability id integrations) becomes READY when onboarding integrations step is completed", () => {
  const runtime = new CompanyWorkspaceRuntime();
  const onboardingRuntime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  // Complete only the onboarding `integrations` step deterministically.
  onboardingRuntime.applyEvent(
    createOnboardingEvent({
      id: "evt_complete_integrations_step",
      timestampISO: NOW0,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
      source: "test",
      payload: { stepId: "integrations" },
    }),
  );

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime: runtime, onboardingRuntime, nowISO: NOW0 });

  const connections = result.capabilities.find((c) => c.id === "integrations");
  assert.ok(connections);
  assert.equal(connections.status, "READY");
  assert.equal(connections.health, "HEALTHY");
});

