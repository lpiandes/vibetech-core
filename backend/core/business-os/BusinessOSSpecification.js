import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createHash } from "node:crypto";

export const BUSINESS_OS_SCHEMA_VERSION = 1;

export const BUSINESS_OS_SPECIFICATION_STATUSES = Object.freeze([
  "discovery",
  "proposed",
  "validated",
  "dry_run_ready",
  "approved",
  "installed",
  "superseded",
  "rejected",
]);

export const BUSINESS_OS_MODULE_TYPES = Object.freeze([
  "records",
  "operations",
  "communications",
  "planning",
  "knowledge",
  "analytics",
  "workforce",
  "configuration",
]);

function fail(message) {
  throw new Error(`BusinessOSSpecification: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return String(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function freezeObject(value, fallback = {}) {
  return deepFreeze(value && typeof value === "object" && !Array.isArray(value) ? { ...value } : { ...fallback });
}

function freezeArray(value) {
  return deepFreeze(asArray(value).map((entry) => (
    entry && typeof entry === "object" ? deepFreeze({ ...entry }) : entry
  )));
}

export function computeSpecificationContentHash(specification) {
  const payload = {
    schemaVersion: specification.schemaVersion,
    businessProfile: specification.businessProfile,
    terminology: specification.terminology,
    modules: specification.modules,
    navigation: specification.navigation,
    subjectDefinitions: specification.subjectDefinitions,
    relationshipDefinitions: specification.relationshipDefinitions,
    requestDefinitions: specification.requestDefinitions,
    workflowDefinitions: specification.workflowDefinitions,
    workDefinitions: specification.workDefinitions,
    employeeDefinitions: specification.employeeDefinitions,
    dashboardDefinitions: specification.dashboardDefinitions,
    campaignDefinitions: specification.campaignDefinitions,
    knowledgeRequirements: specification.knowledgeRequirements,
    integrationRequirements: specification.integrationRequirements,
    teamAndAssignmentRules: specification.teamAndAssignmentRules,
    permissions: specification.permissions,
    governancePolicies: specification.governancePolicies,
    readinessRequirements: specification.readinessRequirements,
    capabilityRequirements: specification.capabilityRequirements,
    unresolvedRequirements: specification.unresolvedRequirements,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Universal versioned Business OS Specification.
 * Declarative only — never generates application source code.
 */
export function createBusinessOSSpecification({
  specificationId,
  specificationVersion = 1,
  schemaVersion = BUSINESS_OS_SCHEMA_VERSION,
  businessId = null,
  businessProfile = {},
  terminology = {},
  modules = [],
  navigation = {},
  subjectDefinitions = [],
  relationshipDefinitions = [],
  requestDefinitions = [],
  workflowDefinitions = [],
  workDefinitions = [],
  employeeDefinitions = [],
  dashboardDefinitions = [],
  campaignDefinitions = [],
  knowledgeRequirements = [],
  integrationRequirements = [],
  teamAndAssignmentRules = {},
  permissions = [],
  governancePolicies = [],
  readinessRequirements = [],
  capabilityRequirements = [],
  unresolvedRequirements = [],
  sourceEvidence = [],
  generatedAt = new Date().toISOString(),
  updatedAt = null,
  status = "proposed",
  contentHash = null,
  metadata = {},
} = {}) {
  requireString(specificationId, "specificationId");
  if (!BUSINESS_OS_SPECIFICATION_STATUSES.includes(String(status))) {
    fail(`unsupported status: ${status}`);
  }

  const spec = {
    specificationId: String(specificationId),
    specificationVersion: Number(specificationVersion ?? 1),
    schemaVersion: Number(schemaVersion ?? BUSINESS_OS_SCHEMA_VERSION),
    businessId: businessId == null ? null : String(businessId),
    businessProfile: freezeObject(businessProfile),
    terminology: freezeObject(terminology),
    modules: freezeArray(modules),
    navigation: freezeObject(navigation, {
      primaryItems: [],
      secondaryItemsByModule: {},
      utilityItems: [],
      roleOverrides: {},
      maximumPrimaryItems: 8,
      overflowBehavior: "more",
    }),
    subjectDefinitions: freezeArray(subjectDefinitions),
    relationshipDefinitions: freezeArray(relationshipDefinitions),
    requestDefinitions: freezeArray(requestDefinitions),
    workflowDefinitions: freezeArray(workflowDefinitions),
    workDefinitions: freezeArray(workDefinitions),
    employeeDefinitions: freezeArray(employeeDefinitions),
    dashboardDefinitions: freezeArray(dashboardDefinitions),
    campaignDefinitions: freezeArray(campaignDefinitions),
    knowledgeRequirements: freezeArray(knowledgeRequirements),
    integrationRequirements: freezeArray(integrationRequirements),
    teamAndAssignmentRules: freezeObject(teamAndAssignmentRules),
    permissions: freezeArray(permissions),
    governancePolicies: freezeArray(governancePolicies),
    readinessRequirements: freezeArray(readinessRequirements),
    capabilityRequirements: freezeArray(capabilityRequirements),
    unresolvedRequirements: freezeArray(unresolvedRequirements),
    sourceEvidence: freezeArray(sourceEvidence),
    generatedAt: String(generatedAt),
    updatedAt: updatedAt == null ? String(generatedAt) : String(updatedAt),
    status: String(status),
    contentHash: null,
    metadata: freezeObject(metadata),
  };

  spec.contentHash = contentHash ? String(contentHash) : computeSpecificationContentHash(spec);
  return deepFreeze(spec);
}

export function withSpecificationStatus(specification, status, { updatedAt = new Date().toISOString() } = {}) {
  if (!BUSINESS_OS_SPECIFICATION_STATUSES.includes(String(status))) {
    fail(`unsupported status: ${status}`);
  }
  return createBusinessOSSpecification({
    ...specification,
    status: String(status),
    updatedAt: String(updatedAt),
    contentHash: specification.contentHash,
  });
}
