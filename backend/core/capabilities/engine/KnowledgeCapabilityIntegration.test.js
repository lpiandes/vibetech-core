import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessCapabilityEngine } from "./BusinessCapabilityEngine.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeCompanyRuntimeStub({
  industry = "Property Management",
  companyProfileOk = true,
  companyProfileCompletion = 100,
  businessProfileOk = true,
  businessProfileCompletion = 100,
  categoriesCount = 1,
  publishedCount = 0,
  knowledgeBrandVoice = "",
  faqsCount = 0,
  activities = [],
} = {}) {
  const knowledgeRepoItems = Array.from({ length: publishedCount }).map((_, i) => ({
    id: `kn_${i}`,
    status: "ACTIVE",
  }));

  const knowledgeCategoriesItems = Array.from({ length: categoriesCount }).map((_, i) => ({
    id: `cat_${i}`,
    status: "ACTIVE",
  }));

  const knowledgeCompact = {
    faqs: Array.from({ length: faqsCount }).map((_, i) => ({
      question: `FAQ ${i}`,
      answer: `Answer ${i}`,
    })),
    listingPolicies: [],
    responsePreferences: [],
    brandVoice: knowledgeBrandVoice,
    propertyShowingRules: [],
  };

  return Object.freeze({
    getCompany: () => ({ industry }),
    getCompanyProfile: () => ({
      metadata: {
        validation: { ok: companyProfileOk },
        completionPercent: companyProfileCompletion,
      },
    }),
    getBusinessProfile: () => ({
      metadata: {
        validation: { ok: businessProfileOk },
        completionPercent: businessProfileCompletion,
      },
    }),
    getEmployees: () => [{ employeeId: "emp_1", employeeName: "Employee 1" }],
    getCompanyData: () => ({ properties: [], buyers: [], inquiries: [] }),
    getApprovalRules: () => [{ description: "approval rule" }],
    getKnowledgeRepository: () => ({ items: knowledgeRepoItems }),
    getKnowledgeCategories: () => ({ items: knowledgeCategoriesItems }),
    getActivities: () => activities,
    getIntegrations: () => [{ type: "email", connected: true }],
    getCommunications: () => [],
    getMetrics: () => ({}),
    getCompanyProfileValidation: () => ({}),
    getCommunicationSetup: () => ({
      readiness: {
        emailReady: true,
        smsReady: true,
        brandReady: true,
        quietHoursReady: true,
        approvalPolicyReady: true,
      },
    }),
    getKnowledge: () => knowledgeCompact,
  });
}

function makeOnboardingRuntimeStub() {
  return Object.freeze({
    getSteps: () => [
      { id: "company_profile", status: "COMPLETED" },
      { id: "business_setup", status: "COMPLETED" },
      { id: "brand_setup", status: "COMPLETED" },
      { id: "integrations", status: "COMPLETED" },
      { id: "knowledge_import", status: "COMPLETED" },
      { id: "employee_provisioning", status: "COMPLETED" },
      { id: "workspace_generation", status: "COMPLETED" },
    ],
  });
}

test("Knowledge readiness: no published knowledge => NOT_STARTED", () => {
  const runtime = makeCompanyRuntimeStub({
    categoriesCount: 1,
    publishedCount: 0,
    faqsCount: 0,
    knowledgeBrandVoice: "",
    activities: [],
  });
  const onboardingRuntime = makeOnboardingRuntimeStub();

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime: runtime, onboardingRuntime, nowISO: NOW0 });

  const knowledge = result.capabilities.find((c) => c.id === "knowledge");
  assert.equal(knowledge.status, "NOT_STARTED");
  assert.ok(knowledge.recommendations.includes("Upload company knowledge."));
});

test("Knowledge readiness: categories missing => BLOCKED", () => {
  const runtime = makeCompanyRuntimeStub({
    categoriesCount: 0,
    publishedCount: 1,
    faqsCount: 1,
    knowledgeBrandVoice: "",
    activities: [{ action: "KNOWLEDGE_PUBLISH_STARTED", status: "Recorded", timestampISO: NOW0 }],
  });
  const onboardingRuntime = makeOnboardingRuntimeStub();

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime: runtime, onboardingRuntime, nowISO: NOW0 });

  const knowledge = result.capabilities.find((c) => c.id === "knowledge");
  assert.equal(knowledge.status, "BLOCKED");
});

test("Knowledge readiness: published knowledge + brain context + activity => READY", () => {
  const runtime = makeCompanyRuntimeStub({
    categoriesCount: 1,
    publishedCount: 2,
    faqsCount: 1,
    knowledgeBrandVoice: "",
    activities: [{ action: "KNOWLEDGE_PUBLISH_STARTED", status: "Recorded", timestampISO: NOW0 }],
  });
  const onboardingRuntime = makeOnboardingRuntimeStub();

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime: runtime, onboardingRuntime, nowISO: NOW0 });

  const knowledge = result.capabilities.find((c) => c.id === "knowledge");
  assert.equal(knowledge.status, "READY");
  assert.equal(knowledge.health, "HEALTHY");
  assert.ok(knowledge.recommendations.length === 0);
});

test("Knowledge readiness: published knowledge but publish failure => DEGRADED", () => {
  const runtime = makeCompanyRuntimeStub({
    categoriesCount: 1,
    publishedCount: 2,
    faqsCount: 1,
    knowledgeBrandVoice: "",
    activities: [
      { action: "KNOWLEDGE_PUBLISH_STARTED", status: "Recorded", timestampISO: NOW0 },
      { action: "KNOWLEDGE_PUBLISH_FAILED", status: "FAILED: error", timestampISO: NOW0 },
    ],
  });
  const onboardingRuntime = makeOnboardingRuntimeStub();

  const engine = new BusinessCapabilityEngine();
  const result = engine.evaluate({ companyRuntime: runtime, onboardingRuntime, nowISO: NOW0 });

  const knowledge = result.capabilities.find((c) => c.id === "knowledge");
  assert.equal(knowledge.status, "DEGRADED");
  assert.equal(knowledge.health, "DEGRADED");
  assert.ok(knowledge.recommendations.includes("Resolve knowledge errors."));
});

