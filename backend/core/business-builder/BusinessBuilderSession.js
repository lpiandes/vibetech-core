import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createHash, randomUUID } from "node:crypto";

export const BUILDER_SESSION_STATUSES = Object.freeze([
  "discovery",
  "proposed",
  "review",
  "dry_run",
  "approved",
  "installed",
  "abandoned",
]);

export function createBusinessBuilderSession({
  sessionId = `bbs_${randomUUID().slice(0, 12)}`,
  businessId = null,
  mode = "operator",
  status = "discovery",
  businessName = null,
  websiteUrl = null,
  answers = [],
  evidence = [],
  specificationId = null,
  createdAt = new Date().toISOString(),
  updatedAt = null,
  createdByUserId = null,
} = {}) {
  return deepFreeze({
    sessionId: String(sessionId),
    businessId: businessId == null ? null : String(businessId),
    mode: mode === "client" ? "client" : "operator",
    status: BUILDER_SESSION_STATUSES.includes(status) ? status : "discovery",
    businessName: businessName == null ? null : String(businessName),
    websiteUrl: websiteUrl == null ? null : String(websiteUrl),
    answers: deepFreeze(Array.isArray(answers) ? answers : []),
    evidence: deepFreeze(Array.isArray(evidence) ? evidence : []),
    specificationId,
    createdAt: String(createdAt),
    updatedAt: String(updatedAt ?? createdAt),
    createdByUserId,
  });
}

export function withBuilderSessionUpdate(session, patch = {}, { updatedAt = new Date().toISOString() } = {}) {
  return createBusinessBuilderSession({
    ...session,
    ...patch,
    updatedAt,
  });
}

export function createDiscoveryAnswer({
  questionId,
  answer,
  confidence = 0.7,
  evidenceSource = "conversation",
  affectedSections = [],
  followUpRequired = false,
  whyAsked = null,
  answeredAt = new Date().toISOString(),
} = {}) {
  return deepFreeze({
    questionId: String(questionId),
    answer,
    confidence: Number(confidence),
    evidenceSource: String(evidenceSource),
    affectedSections: deepFreeze(Array.isArray(affectedSections) ? affectedSections : []),
    followUpRequired: Boolean(followUpRequired),
    whyAsked,
    answeredAt: String(answeredAt),
  });
}

export function createCapabilityProposal({
  proposalId = `capprop_${createHash("sha256").update(String(Date.now()) + randomUUID()).digest("hex").slice(0, 12)}`,
  requestedOutcome,
  evidence = [],
  affectedBusinesses = [],
  proposedUniversalCapability = {},
  proposedPackageExtension = {},
  whyExistingCapabilitiesAreInsufficient,
  safetyRequirements = [],
  estimatedDependencies = [],
  status = "proposed",
} = {}) {
  return deepFreeze({
    proposalId: String(proposalId),
    requestedOutcome: String(requestedOutcome),
    evidence: deepFreeze(Array.isArray(evidence) ? evidence : []),
    affectedBusinesses: deepFreeze(Array.isArray(affectedBusinesses) ? affectedBusinesses : []),
    proposedUniversalCapability: deepFreeze(proposedUniversalCapability),
    proposedPackageExtension: deepFreeze(proposedPackageExtension),
    whyExistingCapabilitiesAreInsufficient: String(whyExistingCapabilitiesAreInsufficient ?? ""),
    safetyRequirements: deepFreeze(Array.isArray(safetyRequirements) ? safetyRequirements : []),
    estimatedDependencies: deepFreeze(Array.isArray(estimatedDependencies) ? estimatedDependencies : []),
    status: String(status),
  });
}
