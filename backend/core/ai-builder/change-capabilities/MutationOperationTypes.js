import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Universal mutation primitives — Architect composes these; never intent-specific executors.
 */
export const MUTATION_OPERATION_TYPES = Object.freeze([
  "createEntity",
  "updateEntity",
  "archiveEntity",
  "createRelationship",
  "endRelationship",
  "addLocation",
  "updateBusinessProfile",
  "inviteMembership",
  "updateMembershipRole",
  "grantPermission",
  "revokePermission",
  "enableCapability",
  "disableCapability",
  "enableComponent",
  "disableComponent",
  "enableEmployeeDefinition",
  "disableEmployeeDefinition",
  "updateEmployeeConfiguration",
  "enableIntegration",
  "disableIntegration",
  "updateIntegrationConfiguration",
  "createWorkflow",
  "updateWorkflow",
  "archiveWorkflow",
  "updateApprovalPolicy",
  "createKnowledgeDocument",
  "updateKnowledgeDocument",
  "archiveKnowledgeDocument",
  "updateBusinessOSConfiguration",
  "renameTerminology",
  "addModule",
  "addCampaign",
  "appendUnresolvedRequirement",
]);

export const MUTATION_TARGET_TYPES = Object.freeze([
  "business_os_specification",
  "business_profile",
  "location",
  "module",
  "role",
  "permission",
  "employee_definition",
  "workflow",
  "integration",
  "knowledge_document",
  "campaign",
  "governance_policy",
  "capability",
  "blueprint_component",
  "membership",
  "terminology",
  "unresolved_requirement",
]);

export function isKnownMutationOperationType(operationType) {
  return MUTATION_OPERATION_TYPES.includes(String(operationType));
}

export function assertKnownMutationOperationType(operationType) {
  if (!isKnownMutationOperationType(operationType)) {
    throw new Error(`MutationPlan: unsupported operationType: ${operationType}`);
  }
}

deepFreeze(MUTATION_OPERATION_TYPES);
deepFreeze(MUTATION_TARGET_TYPES);
