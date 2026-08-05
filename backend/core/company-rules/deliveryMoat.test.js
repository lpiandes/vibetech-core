import assert from "node:assert/strict";
import { test } from "node:test";

import { createBlueprintRegistry, resetDefaultBlueprintRegistryForTests } from "../blueprints/BlueprintRegistry.js";
import {
  assertScrubbed,
  extractMoatCandidates,
  upsertCandidates,
  promoteCandidateToBlueprint,
  refuseRawPromotion,
  resetDeliveryMoatCatalogForTests,
  readDeliveryMoatCatalog,
  DELIVERY_MOAT_SOURCE,
} from "./deliveryMoat.js";

test.beforeEach(() => {
  resetDeliveryMoatCatalogForTests();
  resetDefaultBlueprintRegistryForTests();
});

test("assertScrubbed fails closed on email and forbidden keys", () => {
  const email = assertScrubbed({ titleTemplate: "Ping alice@example.com" });
  assert.equal(email.ok, false);
  assert.equal(email.code, "scrub_failed");

  const forbidden = assertScrubbed({ customerEmail: "x", rootCauseCodes: ["customer_delay"] });
  assert.equal(forbidden.ok, false);
  assert.ok(forbidden.violations.some((v) => v.code === "forbidden_key"));
});

test("assertScrubbed passes structural company rule shapes", () => {
  const ok = assertScrubbed({
    rootCauseCodes: ["customer_delay"],
    companyRuleShape: {
      titleTemplate: "Tighten follow-up cadence",
      bodyTemplate: "When proposals stall, require a next step within cadence days.",
      reasonCode: "customer_delay",
    },
    rftPatchShape: {
      sla: { proposalReviewCadenceDays: 2 },
    },
  });
  assert.equal(ok.ok, true);
});

test("refuseRawPromotion never accepts customer payloads", () => {
  const refused = refuseRawPromotion({
    messages: [{ from: "bob@acme.com", body: "Can we discount?" }],
    businessId: "biz_secret",
  });
  assert.equal(refused.ok, false);
});

test("extractMoatCandidates strips tenant ids and builds scrubbed provenance", () => {
  const extracted = extractMoatCandidates({
    interventionsByBusiness: [
      {
        businessId: "biz_alpha_real_name",
        closed: [
          {
            caseId: "rft_exception:biz_alpha_real_name:card1",
            rootCause: "customer_delay",
            note: "Acme stalled — email ceo@acme.com",
            closedAt: "2026-08-01T00:00:00.000Z",
          },
          {
            caseId: "rft_exception:biz_alpha_real_name:card2",
            rootCause: "customer_delay",
            closedAt: "2026-08-02T00:00:00.000Z",
          },
        ],
      },
      {
        businessId: "biz_beta_other",
        closed: [
          {
            caseId: "rft_exception:biz_beta_other:card9",
            rootCause: "missing_integration",
            closedAt: "2026-08-03T00:00:00.000Z",
          },
        ],
      },
    ],
    rulesByBusiness: [
      {
        businessId: "biz_alpha_real_name",
        rules: [
          {
            status: "active",
            reasonCode: "customer_delay",
            title: "Cadence rule",
            body: "Follow up in 2 days",
            suggestedPatch: {
              kind: "rft_patch",
              patch: { rft: { sla: { proposalReviewCadenceDays: 2 } } },
            },
            approvedAt: "2026-08-04T00:00:00.000Z",
          },
        ],
      },
    ],
  });

  const stall = extracted.candidates.find((c) => c.patternKind === "proposal_stall_follow_up");
  assert.ok(stall);
  assert.equal(stall.provenance.anonymizedTenantCount >= 1, true);
  const blob = JSON.stringify(extracted.candidates);
  assert.equal(/biz_alpha_real_name/.test(blob), false);
  assert.equal(/ceo@acme\.com/.test(blob), false);
  assert.equal(/Acme stalled/.test(blob), false);
});

test("promote registers delivery_moat blueprint with provenance; no cross-tenant raw leak", () => {
  const extracted = extractMoatCandidates({
    interventionsByBusiness: [
      {
        businessId: "biz_1",
        closed: [
          { rootCause: "provider_failure", closedAt: "2026-08-01T00:00:00.000Z" },
          { rootCause: "provider_failure", closedAt: "2026-08-02T00:00:00.000Z" },
        ],
      },
    ],
  });
  upsertCandidates(extracted.candidates);
  const candidate = readDeliveryMoatCatalog().candidates.find(
    (c) => c.patternKind === "integration_recovery",
  );
  assert.ok(candidate);

  const registry = createBlueprintRegistry({ includeDefaults: true });
  const promoted = promoteCandidateToBlueprint({
    candidateId: candidate.candidateId,
    actorId: "admin_1",
    blueprintRegistry: registry,
  });
  assert.equal(promoted.ok, true);
  assert.equal(promoted.blueprint.source, DELIVERY_MOAT_SOURCE);
  assert.equal(promoted.blueprint.maturity, "experimental");
  assert.ok(promoted.blueprint.metadata.provenance.anonymizedTenantCount >= 1);
  assert.equal(promoted.blueprint.metadata.provenance.businessIds, undefined);

  const listed = registry.list({ source: DELIVERY_MOAT_SOURCE });
  assert.equal(listed.length >= 1, true);
  assert.equal(JSON.stringify(listed).includes("biz_1"), false);
});

test("promoting unsanitized structure fails closed", () => {
  upsertCandidates([
    {
      candidateId: "moat_bad_raw",
      status: "candidate",
      patternKind: "assignment_rule",
      title: "Bad",
      structure: {
        rootCauseCodes: ["missing_business_rule"],
        note: "Call Jane at jane@corp.com",
      },
      provenance: {
        anonymizedTenantCount: 1,
        dateRange: { from: null, to: null },
        rootCauseDistribution: {},
        sourceTypes: ["operator_intervention"],
        extractedAt: "2026-08-05T00:00:00.000Z",
        sampleCount: 1,
      },
      publishedBlueprintId: null,
    },
  ]);
  const registry = createBlueprintRegistry({ includeDefaults: false });
  const result = promoteCandidateToBlueprint({
    candidateId: "moat_bad_raw",
    blueprintRegistry: registry,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "scrub_failed");
});
