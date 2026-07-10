import { deepFreeze } from "../../../backend/core/workspace/_utils/deepFreeze.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "./mcbrideClientTemplate.js";
import { PROPERTY_MANAGEMENT_PACKAGE_MANIFEST } from "./propertyManagementPackageManifest.js";

const SETUP_LABELS = Object.freeze({
  crm_csv: "CRM CSV uploaded and reviewed",
  property_listing_csv: "Property/listing CSV uploaded and reviewed",
  approved_knowledge_docs: "Approved leasing and follow-up knowledge docs",
  team_assignment_config: "Team ownership and assignment configuration",
  consent_review: "Consent, opt-out, and suppression review",
  users_and_permissions: "Users and permissions configured",
  manual_walkthrough: "Manual McBride acceptance walkthrough completed",
});

function asSet(values = []) {
  return new Set((Array.isArray(values) ? values : []).map(String));
}

function checkReferences({ manifest, template }) {
  const packageRelationshipTypes = asSet(manifest.relationshipTypes.map((entry) => entry.type));
  const packageQualificationFields = asSet(manifest.qualificationSchemas.flatMap((schema) => schema.fields.map((field) => field.key)));
  const packageImportProfiles = asSet(manifest.importProfiles.map((profile) => profile.profileId));
  const packageFollowUpRules = asSet(manifest.followUpRules.map((rule) => rule.id));
  const packageOutcomes = asSet(manifest.outcomes.map((outcome) => outcome.id));
  const packageDraftTemplates = asSet(manifest.draftAssistance.map((draft) => draft.id));
  const packageRecurringOperations = asSet(manifest.recurringOperationDefinitions.map((operation) => operation.id));
  const packageCampaignTemplates = asSet(manifest.campaignTemplates.map((template) => template.id));
  const packageKnowledgeCategories = asSet(manifest.knowledgeCategories.map((category) => category.id));
  const packageIntelligenceSections = asSet(manifest.intelligenceSections.map((section) => section.id));
  const packageCapabilities = asSet([...manifest.capabilities.implemented, ...manifest.capabilities.setupRequired, ...manifest.capabilities.deferred]);

  const checks = [
    {
      id: "template_package_match",
      status: template.packageId === manifest.packageId ? "ready" : "blocked",
      detail: "Template uses the property-management package.",
    },
    {
      id: "enabled_capabilities_registered",
      status: template.enabledCapabilities.every((id) => packageCapabilities.has(id)) ? "ready" : "blocked",
      detail: "Every enabled template capability is declared by the package manifest.",
    },
    {
      id: "relationship_types_registered",
      status: template.relationshipConfig.relationshipTypes.every((type) => packageRelationshipTypes.has(type)) ? "ready" : "blocked",
      detail: "Every McBride relationship type exists in the package registry.",
    },
    {
      id: "qualification_questions_registered",
      status: template.qualificationQuestions.every((key) => packageQualificationFields.has(key)) ? "ready" : "blocked",
      detail: "Every McBride qualification question exists in the qualification schema.",
    },
    {
      id: "import_profiles_registered",
      status: [...template.importProfileRefs.crm, ...template.importProfileRefs.subjects].every((profileId) => packageImportProfiles.has(profileId))
        ? "ready"
        : "blocked",
      detail: "CRM and property import profile references resolve to package import profiles.",
    },
    {
      id: "follow_up_rules_registered",
      status: template.followUpRuleSettings.enabledRuleIds.every((id) => packageFollowUpRules.has(id)) ? "ready" : "blocked",
      detail: "Follow-up rule settings resolve to package-owned rules.",
    },
    {
      id: "outcomes_registered",
      status: template.outcomeSettings.enabledOutcomeIds.every((id) => packageOutcomes.has(id)) ? "ready" : "blocked",
      detail: "Outcome settings resolve to package-owned relationship follow-up outcomes.",
    },
    {
      id: "draft_templates_registered",
      status: template.draftWordingRules.enabledTemplateIds.every((id) => packageDraftTemplates.has(id)) ? "ready" : "blocked",
      detail: "Draft wording rules resolve to package-owned draft templates.",
    },
    {
      id: "recurring_operations_registered",
      status: template.recurringOperationRefs.every((id) => packageRecurringOperations.has(id)) ? "ready" : "blocked",
      detail: "Recurring operation references resolve to package-owned operation definitions.",
    },
    {
      id: "campaign_templates_registered",
      status: template.campaignTemplateRefs.every((id) => packageCampaignTemplates.has(id)) ? "ready" : "blocked",
      detail: "Campaign template references resolve to package-owned draft preparation templates.",
    },
    {
      id: "knowledge_categories_registered",
      status: [...template.knowledgeExpectations.requiredCategoryIds, ...template.knowledgeExpectations.recommendedCategoryIds].every((id) =>
        packageKnowledgeCategories.has(id),
      )
        ? "ready"
        : "blocked",
      detail: "Knowledge expectations resolve to package-owned categories.",
    },
    {
      id: "intelligence_sections_registered",
      status: template.intelligenceDashboardPriorities.every((id) => packageIntelligenceSections.has(id)) ? "ready" : "blocked",
      detail: "Dashboard priorities resolve to relationship operations intelligence sections.",
    },
    {
      id: "communication_execution_deferred",
      status: template.draftWordingRules.reviewOnly === true && template.draftWordingRules.sendAutomatically === false ? "ready" : "blocked",
      detail: "Draft assistance is review-only and does not activate sending.",
    },
    {
      id: "canonical_subject_boundary",
      status:
        manifest.canonicalModel.subjectSourceOfTruth === "BusinessSubject" &&
        manifest.canonicalModel.relationshipSourceOfTruth === "BusinessGraph" &&
        manifest.propertyInterestReconciliation.unmatchedValuesCreateSubjects === false
          ? "ready"
          : "blocked",
      detail: "Property/listing truth stays on BusinessSubject and INTERESTED_IN graph linkage.",
    },
  ];

  return deepFreeze(checks);
}

export function evaluatePropertyManagementTemplateReadiness({
  manifest = PROPERTY_MANAGEMENT_PACKAGE_MANIFEST,
  template = MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE,
  setupState = {},
} = {}) {
  const configurationChecks = checkReferences({ manifest, template });
  const missingSetupItems = manifest.capabilities.setupRequired
    .filter((id) => setupState[id] !== true)
    .map((id) => ({
      id,
      label: SETUP_LABELS[id] ?? id,
      status: "needs_setup",
    }));

  const setupCompleteItems = manifest.capabilities.setupRequired
    .filter((id) => setupState[id] === true)
    .map((id) => ({
      id,
      label: SETUP_LABELS[id] ?? id,
      status: "ready",
    }));

  const readyCapabilities = manifest.capabilities.implemented.map((id) => ({
    id,
    status: "ready",
  }));

  const deferredCapabilities = manifest.deferredCapabilities.map((capability) => ({
    id: capability.id,
    status: "deferred",
    active: false,
  }));

  const hasBlockedConfiguration = configurationChecks.some((check) => check.status === "blocked");
  const readinessStatus = hasBlockedConfiguration ? "blocked" : missingSetupItems.length > 0 ? "needs_setup" : "ready";

  return deepFreeze({
    packageId: manifest.packageId,
    templateId: template.id,
    readinessStatus,
    readyCapabilities,
    setupCompleteItems,
    missingSetupItems,
    deferredCapabilities,
    configurationChecks,
    manualSteps: template.onboardingChecklist,
    acceptanceChecklist: manifest.acceptanceChecklist,
  });
}
