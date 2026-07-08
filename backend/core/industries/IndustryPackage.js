import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`IndustryPackage: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return String(v);
}

function freezeArray(arr) {
  return deepFreeze(Array.isArray(arr) ? arr.map((x) => (x && typeof x === "object" ? deepFreeze({ ...x }) : x)) : []);
}

/**
 * Universal industry package contract.
 * Packages declare installable vertical behavior; Core provides mechanisms only.
 */
export function createIndustryPackage({
  id,
  name,
  description,
  version = 1,
  displayName,
  terminology,
  capabilities,
  automationConfigurations,
  knowledgeCategories,
  knowledgeRequirements,
  employeeDefinitions,
  requestTypes,
  workTypes,
  interactionOutcomes,
  communicationIntents,
  onboardingSchema,
  connectedSystemRequirements,
  connectionGuidance,
  approvalPolicies,
  navigation,
  executiveExperience,
  subjectTypes,
  qualificationFieldSchemas,
  relationshipTypes,
  lifecycleTransitions,
  relationshipFollowUpRules,
  relationshipFollowUpOutcomes,
  inboundRouting,
  segmentTemplates,
  importProfiles,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requireString(description, "description");

  const pkg = {
    id: String(id),
    name: String(name),
    description: String(description),
    version: Number(version ?? 1),
    displayName: String(displayName ?? name),
    terminology: terminology && typeof terminology === "object" ? deepFreeze(terminology) : deepFreeze({}),
    capabilities: freezeArray(capabilities),
    automationConfigurations: freezeArray(automationConfigurations),
    knowledgeCategories: freezeArray(knowledgeCategories),
    knowledgeRequirements: freezeArray(knowledgeRequirements),
    employeeDefinitions: freezeArray(employeeDefinitions),
    requestTypes: freezeArray(requestTypes),
    workTypes: freezeArray(workTypes),
    interactionOutcomes: freezeArray(interactionOutcomes),
    communicationIntents: freezeArray(communicationIntents),
    onboardingSchema: onboardingSchema && typeof onboardingSchema === "object" ? deepFreeze(onboardingSchema) : deepFreeze({}),
    connectedSystemRequirements: freezeArray(connectedSystemRequirements),
    connectionGuidance: freezeArray(connectionGuidance),
    approvalPolicies: freezeArray(approvalPolicies),
    navigation: navigation && typeof navigation === "object" ? deepFreeze(navigation) : deepFreeze({}),
    executiveExperience: executiveExperience && typeof executiveExperience === "object" ? deepFreeze(executiveExperience) : deepFreeze({}),
    subjectTypes: freezeArray(subjectTypes),
    qualificationFieldSchemas: freezeArray(qualificationFieldSchemas),
    relationshipTypes: freezeArray(relationshipTypes),
    lifecycleTransitions: freezeArray(lifecycleTransitions),
    relationshipFollowUpRules: freezeArray(relationshipFollowUpRules),
    relationshipFollowUpOutcomes: freezeArray(relationshipFollowUpOutcomes),
    inboundRouting: freezeArray(inboundRouting),
    segmentTemplates: freezeArray(segmentTemplates),
    importProfiles: freezeArray(importProfiles),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(pkg);
}
