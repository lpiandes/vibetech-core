import assert from "node:assert/strict";
import test from "node:test";

import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "./mcbrideClientTemplate.js";
import { PROPERTY_MANAGEMENT_PACKAGE_MANIFEST } from "./propertyManagementPackageManifest.js";
import { evaluatePropertyManagementTemplateReadiness } from "./propertyManagementTemplateReadiness.js";

function ids(rows) {
  return new Set(rows.map((row) => row.id));
}

test("property-management package manifest exposes the completed operating template surface", () => {
  const manifest = PROPERTY_MANAGEMENT_PACKAGE_MANIFEST;

  assert.equal(manifest.packageId, "pkg_property_management");
  assert.equal(manifest.canonicalModel.subjectSourceOfTruth, "BusinessSubject");
  assert.equal(manifest.canonicalModel.relationshipSourceOfTruth, "BusinessGraph");
  assert.equal(manifest.canonicalModel.partyToSubjectRelationshipType, "INTERESTED_IN");
  assert.equal(manifest.propertyInterestReconciliation.weakOnlyValuesRemainUnresolved, true);
  assert.equal(manifest.propertyInterestReconciliation.unmatchedValuesCreateSubjects, false);
  assert.equal(manifest.propertyInterestReconciliation.requestSubjectRefsPatchedByDefault, false);

  const implemented = new Set(manifest.capabilities.implemented);
  for (const capabilityId of [
    "crm_import_dry_run",
    "crm_import_commit",
    "relationship_classification",
    "property_listing_import",
    "person_property_linkage",
    "relationship_follow_up_queue",
    "relationship_follow_up_work_assignment",
    "relationship_follow_up_outcome_resolution",
    "knowledge_guided_draft_assistance",
    "relationship_operations_intelligence",
  ]) {
    assert.equal(implemented.has(capabilityId), true, `${capabilityId} should be package-ready`);
  }

  assert.deepEqual(
    manifest.importProfiles.filter((profile) => profile.importKind === "subject").map((profile) => profile.profileId).sort(),
    ["magna_mare_property_listing_csv", "mcbride_property_listing_csv"],
  );
  assert.equal(manifest.outcomes.length, 6);
  assert.equal(manifest.draftAssistance.every((template) => template.channel === "email"), true);
  assert.ok(manifest.intelligenceSections.some((section) => section.id === "property_demand"));
  assert.deepEqual(manifest.dashboardDefinitions.portfolioSemantics.followUpWorkTypes, ["prospect_follow_up"]);
  assert.ok(manifest.dashboardDefinitions.pulseMetricIds.includes("new_inquiries"));
  assert.ok(manifest.dashboardDefinitions.peopleFilterIds.includes("with_property_interest"));
});

test("McBride/Magna Mare template references valid package capabilities, schemas, rules, outcomes, drafts, and intelligence sections", () => {
  const manifest = PROPERTY_MANAGEMENT_PACKAGE_MANIFEST;
  const template = MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE;

  const packageCapabilities = new Set([
    ...manifest.capabilities.implemented,
    ...manifest.capabilities.setupRequired,
    ...manifest.capabilities.deferred,
  ]);
  const relationshipTypes = new Set(manifest.relationshipTypes.map((relationship) => relationship.type));
  const qualificationFields = new Set(manifest.qualificationSchemas.flatMap((schema) => schema.fields.map((field) => field.key)));
  const importProfiles = new Set(manifest.importProfiles.map((profile) => profile.profileId));
  const followUpRules = new Set(manifest.followUpRules.map((rule) => rule.id));
  const outcomes = new Set(manifest.outcomes.map((outcome) => outcome.id));
  const draftTemplates = new Set(manifest.draftAssistance.map((draft) => draft.id));
  const knowledgeCategories = new Set(manifest.knowledgeCategories.map((category) => category.id));
  const intelligenceSections = new Set(manifest.intelligenceSections.map((section) => section.id));

  assert.equal(template.enabledCapabilities.every((id) => packageCapabilities.has(id)), true);
  assert.equal(template.relationshipConfig.relationshipTypes.every((type) => relationshipTypes.has(type)), true);
  assert.equal(template.qualificationQuestions.every((field) => qualificationFields.has(field)), true);
  assert.equal([...template.importProfileRefs.crm, ...template.importProfileRefs.subjects].every((profileId) => importProfiles.has(profileId)), true);
  assert.equal(template.followUpRuleSettings.enabledRuleIds.every((ruleId) => followUpRules.has(ruleId)), true);
  assert.equal(template.outcomeSettings.enabledOutcomeIds.every((outcomeId) => outcomes.has(outcomeId)), true);
  assert.equal(template.draftWordingRules.enabledTemplateIds.every((draftId) => draftTemplates.has(draftId)), true);
  assert.equal(
    [...template.knowledgeExpectations.requiredCategoryIds, ...template.knowledgeExpectations.recommendedCategoryIds].every((categoryId) =>
      knowledgeCategories.has(categoryId),
    ),
    true,
  );
  assert.equal(template.intelligenceDashboardPriorities.every((sectionId) => intelligenceSections.has(sectionId)), true);
  assert.equal(template.draftWordingRules.reviewOnly, true);
  assert.equal(template.draftWordingRules.sendAutomatically, false);
});

test("template readiness separates implemented capabilities, missing setup, and deferred execution", () => {
  const readiness = evaluatePropertyManagementTemplateReadiness();

  assert.equal(readiness.readinessStatus, "needs_setup");
  assert.deepEqual(ids(readiness.readyCapabilities), new Set(PROPERTY_MANAGEMENT_PACKAGE_MANIFEST.capabilities.implemented));
  assert.deepEqual(ids(readiness.missingSetupItems), new Set(PROPERTY_MANAGEMENT_PACKAGE_MANIFEST.capabilities.setupRequired));
  assert.equal(readiness.deferredCapabilities.every((capability) => capability.status === "deferred" && capability.active === false), true);
  assert.equal(readiness.configurationChecks.every((check) => check.status === "ready"), true);
  assert.ok(readiness.deferredCapabilities.some((capability) => capability.id === "sms_sending"));
  assert.ok(readiness.deferredCapabilities.some((capability) => capability.id === "email_sending"));
  assert.ok(readiness.manualSteps.some((step) => step.includes("manual McBride walkthrough")));
});

test("template readiness becomes ready only after all required setup is complete", () => {
  const setupState = Object.fromEntries(PROPERTY_MANAGEMENT_PACKAGE_MANIFEST.capabilities.setupRequired.map((id) => [id, true]));
  const readiness = evaluatePropertyManagementTemplateReadiness({ setupState });

  assert.equal(readiness.readinessStatus, "ready");
  assert.equal(readiness.missingSetupItems.length, 0);
  assert.deepEqual(ids(readiness.setupCompleteItems), new Set(PROPERTY_MANAGEMENT_PACKAGE_MANIFEST.capabilities.setupRequired));
});

test("readiness blocks stale or false template references instead of reporting available", () => {
  const badTemplate = {
    ...MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE,
    enabledCapabilities: [...MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE.enabledCapabilities, "provider_sms_autopilot"],
    draftWordingRules: {
      ...MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE.draftWordingRules,
      sendAutomatically: true,
    },
  };

  const readiness = evaluatePropertyManagementTemplateReadiness({ template: badTemplate });

  assert.equal(readiness.readinessStatus, "blocked");
  assert.equal(readiness.configurationChecks.find((check) => check.id === "enabled_capabilities_registered").status, "blocked");
  assert.equal(readiness.configurationChecks.find((check) => check.id === "communication_execution_deferred").status, "blocked");
});
