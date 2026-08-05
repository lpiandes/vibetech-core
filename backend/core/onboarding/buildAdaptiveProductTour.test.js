/**
 * @vitest-environment node
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildAdaptiveProductTour } from "./buildAdaptiveProductTour.js";

describe("buildAdaptiveProductTour", () => {
  it("builds Meta+SMS mission steps for lead_follow_up package", () => {
    const result = buildAdaptiveProductTour({
      purchasedPackages: ["lead_follow_up"],
      businessId: "biz_1",
      businessName: "Demo Agency",
      availableNavIds: [
        "home", "needs_attention", "people", "work", "inbox",
        "automations", "knowledge", "integrations", "settings",
      ],
      missions: [
        {
          id: "meta_lead_intake",
          title: "Connect Meta Lead Forms",
          detail: "Bring Facebook leads into People.",
          actionLabel: "Set up",
          status: "needs_setup",
          complete: false,
          href: "/b/biz_1/integrations",
        },
        {
          id: "sms_send",
          title: "Prove SMS",
          detail: "Send a test text.",
          actionLabel: "Set up",
          status: "needs_setup",
          complete: false,
          href: "/b/biz_1/integrations",
        },
        {
          id: "knowledge_consult",
          title: "Add knowledge",
          detail: "Upload FAQs.",
          complete: true,
          status: "proven",
        },
      ],
    });

    assert.equal(result.skipTour, false);
    assert.ok(result.steps.some((s) => s.id === "mission:meta_lead_intake"));
    assert.ok(result.steps.some((s) => s.id === "mission:sms_send"));
    assert.ok(!result.steps.some((s) => s.id === "mission:knowledge_consult"));
    assert.ok(result.steps.some((s) => s.id === "nav:people"));
    assert.ok(result.steps.some((s) => s.id === "ask"));
  });

  it("skips full OS tour for social-only scope", () => {
    const result = buildAdaptiveProductTour({
      purchasedPackages: ["social_background_screening"],
      availableNavIds: ["home", "people", "settings"],
      missions: [],
    });
    assert.equal(result.skipTour, true);
    assert.equal(result.mode, "social_only");
    assert.ok(result.steps.length <= 2);
  });

  it("includes Properties intro when subjects nav is present", () => {
    const result = buildAdaptiveProductTour({
      purchasedPackages: ["ai_business_os"],
      availableNavIds: ["home", "subjects", "campaigns", "settings"],
      missions: [],
    });
    assert.ok(result.steps.some((s) => s.id === "nav:subjects"));
    assert.ok(result.steps.some((s) => s.id === "nav:campaigns"));
  });

  it("skips the People intro for managed revenue follow-through", () => {
    const result = buildAdaptiveProductTour({
      purchasedPackages: ["managed_revenue_follow_through"],
      availableNavIds: ["home", "people", "work", "knowledge", "settings"],
      missions: [],
    });
    assert.equal(result.steps.some((s) => s.id === "nav:people"), false);
  });
});
