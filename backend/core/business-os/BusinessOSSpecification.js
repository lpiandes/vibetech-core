import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { hashBusinessOSSpecification } from "./BusinessOSSpecificationHasher.js";

export const BUSINESS_OS_SCHEMA_VERSION = 1;

export const BUSINESS_OS_SPECIFICATION_STATUSES = Object.freeze([
  "draft",
  "discovery", // backward-compatible alias used by builder sessions
  "proposed",
  "validated",
  "dry_run_ready",
  "approved",
  "installing",
  "installed",
  "superseded",
  "failed",
  "rejected",
]);

export const BUSINESS_OS_MODULE_TYPES = Object.freeze([
  "records",
  "operations",
  "planning",
  "communications",
  "workforce",
  "knowledge",
  "analytics",
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

/** @deprecated Prefer hashBusinessOSSpecification from BusinessOSSpecificationHasher.js */
export function computeSpecificationContentHash(specification) {
  return hashBusinessOSSpecification(specification);
}

/**
 * Universal versioned Business OS Specification.
 * Declarative only — never generates application source code.
 */
export function createBusinessOSSpecification({
  specificationId,
  specificationVersion = 1,
  version = null,
  schemaVersion = BUSINESS_OS_SCHEMA_VERSION,
  businessId = null,
  status = "proposed",
  source = null,
  businessProfile = {},
  terminology = {},
  modules = [],
  navigation = {},
  subjectDefinitions = [],
  relationshipDefinitions = [],
  requestDefinitions = [],
  workDefinitions = [],
  pipelineDefinitions = [],
  workflowDefinitions = [],
  employeeDefinitions = [],
  dashboardDefinitions = [],
  campaignDefinitions = [],
  knowledgeRequirements = [],
  integrationRequirements = [],
  teamDefinitions = [],
  teamAndAssignmentRules = {},
  roleDefinitions = [],
  permissionPolicies = [],
  permissions = [],
  accessRequestPolicies = [],
  governancePolicies = [],
  readinessRequirements = [],
  capabilityRequirements = [],
  unresolvedRequirements = [],
  assumptions = [],
  capabilityGaps = [],
  provenance = {},
  sourceEvidence = [],
  createdAt = null,
  generatedAt = new Date().toISOString(),
  updatedAt = null,
  contentHash = null,
  metadata = {},
} = {}) {
  requireString(specificationId, "specificationId");
  if (!BUSINESS_OS_SPECIFICATION_STATUSES.includes(String(status))) {
    fail(`unsupported status: ${status}`);
  }

  const resolvedVersion = Number(version ?? specificationVersion ?? 1);
  const created = String(createdAt ?? generatedAt);

  const spec = {
    specificationId: String(specificationId),
    specificationVersion: resolvedVersion,
    version: resolvedVersion,
    schemaVersion: Number(schemaVersion ?? BUSINESS_OS_SCHEMA_VERSION),
    businessId: businessId == null ? null : String(businessId),
    status: String(status),
    source: source == null
      ? null
      : (typeof source === "object" ? freezeObject(source) : String(source)),
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
    workDefinitions: freezeArray(workDefinitions),
    pipelineDefinitions: freezeArray(pipelineDefinitions),
    workflowDefinitions: freezeArray(workflowDefinitions),
    employeeDefinitions: freezeArray(employeeDefinitions),
    dashboardDefinitions: freezeArray(dashboardDefinitions),
    campaignDefinitions: freezeArray(campaignDefinitions),
    knowledgeRequirements: freezeArray(knowledgeRequirements),
    integrationRequirements: freezeArray(integrationRequirements),
    teamDefinitions: freezeArray(teamDefinitions),
    teamAndAssignmentRules: freezeObject(teamAndAssignmentRules),
    roleDefinitions: freezeArray(roleDefinitions),
    permissionPolicies: freezeArray(permissionPolicies),
    permissions: freezeArray(permissions),
    accessRequestPolicies: freezeArray(accessRequestPolicies),
    governancePolicies: freezeArray(governancePolicies),
    readinessRequirements: freezeArray(readinessRequirements),
    capabilityRequirements: freezeArray(capabilityRequirements),
    unresolvedRequirements: freezeArray(unresolvedRequirements),
    assumptions: freezeArray(assumptions),
    capabilityGaps: freezeArray(capabilityGaps),
    provenance: freezeObject(provenance),
    sourceEvidence: freezeArray(sourceEvidence),
    createdAt: created,
    generatedAt: String(generatedAt),
    updatedAt: updatedAt == null ? String(generatedAt) : String(updatedAt),
    contentHash: null,
    metadata: freezeObject(metadata),
  };

  spec.contentHash = contentHash ? String(contentHash) : hashBusinessOSSpecification(spec);
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
