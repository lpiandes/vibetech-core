import { createHash } from "node:crypto";
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { canonicalizeForHash } from "../../../business-os/BusinessOSSpecificationHasher.js";
import {
  RFT_CONTRACT_KIND,
  RFT_CONTRACT_VERSION,
  RFT_SCHEMA_ID,
  defaultRftServiceStandard,
} from "./rftCatalog.js";

/**
 * Versioned RFT service-standard document + content hash (reuses Business OS canonicalize).
 */

function asStringArray(value, fallback = []) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [...fallback];
  return [String(value)].filter(Boolean);
}

/**
 * Normalize / merge an RFT block onto an operating contract.
 */
export function normalizeRftServiceStandard(raw = null, { nowISO = null } = {}) {
  const defaults = defaultRftServiceStandard();
  const prior = raw && typeof raw === "object" ? raw : {};
  const slaIn = prior.sla && typeof prior.sla === "object" ? prior.sla : {};
  const approvalIn = prior.approvalRules && typeof prior.approvalRules === "object"
    ? prior.approvalRules
    : {};
  const successIn = prior.successProof && typeof prior.successProof === "object"
    ? prior.successProof
    : {};
  const retryIn = prior.retry && typeof prior.retry === "object" ? prior.retry : {};
  const costIn = prior.costBoundary && typeof prior.costBoundary === "object"
    ? prior.costBoundary
    : {};

  const document = {
    kind: RFT_CONTRACT_KIND,
    schemaId: RFT_SCHEMA_ID,
    contractVersion: String(prior.contractVersion ?? defaults.contractVersion ?? RFT_CONTRACT_VERSION),
    name: String(prior.name ?? defaults.name),
    sla: {
      acknowledgeWithinMinutes: Number(
        slaIn.acknowledgeWithinMinutes ?? defaults.sla.acknowledgeWithinMinutes,
      ) || 5,
      operatingHoursOnly: slaIn.operatingHoursOnly != null
        ? Boolean(slaIn.operatingHoursOnly)
        : defaults.sla.operatingHoursOnly,
      proposalReviewCadenceDays: Number(
        slaIn.proposalReviewCadenceDays ?? defaults.sla.proposalReviewCadenceDays,
      ) || 3,
      assignmentRequired: slaIn.assignmentRequired != null
        ? Boolean(slaIn.assignmentRequired)
        : defaults.sla.assignmentRequired,
      meetingNextStepRequired: slaIn.meetingNextStepRequired != null
        ? Boolean(slaIn.meetingNextStepRequired)
        : defaults.sla.meetingNextStepRequired,
      wonHandoffRequired: slaIn.wonHandoffRequired != null
        ? Boolean(slaIn.wonHandoffRequired)
        : defaults.sla.wonHandoffRequired,
    },
    permittedActions: asStringArray(prior.permittedActions, defaults.permittedActions),
    approvalRules: {
      customerFacingRequiresApproval: approvalIn.customerFacingRequiresApproval != null
        ? Boolean(approvalIn.customerFacingRequiresApproval)
        : defaults.approvalRules.customerFacingRequiresApproval,
      pricingOutsidePolicyRequiresApproval: approvalIn.pricingOutsidePolicyRequiresApproval != null
        ? Boolean(approvalIn.pricingOutsidePolicyRequiresApproval)
        : defaults.approvalRules.pricingOutsidePolicyRequiresApproval,
      newProspectOutboundRequiresApproval: approvalIn.newProspectOutboundRequiresApproval != null
        ? Boolean(approvalIn.newProspectOutboundRequiresApproval)
        : defaults.approvalRules.newProspectOutboundRequiresApproval,
      existingCustomerSchedulingMayAuto: approvalIn.existingCustomerSchedulingMayAuto != null
        ? Boolean(approvalIn.existingCustomerSchedulingMayAuto)
        : defaults.approvalRules.existingCustomerSchedulingMayAuto,
    },
    successProof: {
      requireProviderIdsBeforeVerified: successIn.requireProviderIdsBeforeVerified != null
        ? Boolean(successIn.requireProviderIdsBeforeVerified)
        : defaults.successProof.requireProviderIdsBeforeVerified,
      acceptedEvidenceKinds: asStringArray(
        successIn.acceptedEvidenceKinds,
        defaults.successProof.acceptedEvidenceKinds,
      ),
      providerProofKinds: asStringArray(
        successIn.providerProofKinds,
        defaults.successProof.providerProofKinds,
      ),
    },
    failureConditions: asStringArray(prior.failureConditions, defaults.failureConditions),
    exceptionOwner: String(prior.exceptionOwner ?? defaults.exceptionOwner),
    retry: {
      safeTechnicalRetries: Number(retryIn.safeTechnicalRetries ?? defaults.retry.safeTechnicalRetries) || 0,
      backoffSeconds: Number(retryIn.backoffSeconds ?? defaults.retry.backoffSeconds) || 60,
    },
    costBoundary: {
      maxAutoOutboundPerOpportunity: Number(
        costIn.maxAutoOutboundPerOpportunity ?? defaults.costBoundary.maxAutoOutboundPerOpportunity,
      ) || 0,
      maxShadowDaysBeforeProve: Number(
        costIn.maxShadowDaysBeforeProve ?? defaults.costBoundary.maxShadowDaysBeforeProve,
      ) || 0,
    },
    metrics: asStringArray(prior.metrics, defaults.metrics),
    eventTypes: asStringArray(prior.eventTypes, defaults.eventTypes),
    outcomeTypes: asStringArray(prior.outcomeTypes, defaults.outcomeTypes),
    states: asStringArray(prior.states, defaults.states),
    updatedAt: prior.updatedAt ?? null,
  };

  if (nowISO) document.updatedAt = nowISO;

  const contentHash = hashRftServiceStandard(document);
  return deepFreeze({
    ...document,
    contentHash,
  });
}

/**
 * Stable SHA-256 of RFT service standard (excludes contentHash / updatedAt via canonicalize).
 */
export function hashRftServiceStandard(document) {
  const payload = canonicalizeForHash({
    kind: document.kind,
    schemaId: document.schemaId,
    contractVersion: document.contractVersion,
    name: document.name,
    sla: document.sla,
    permittedActions: document.permittedActions,
    approvalRules: document.approvalRules,
    successProof: document.successProof,
    failureConditions: document.failureConditions,
    exceptionOwner: document.exceptionOwner,
    retry: document.retry,
    costBoundary: document.costBoundary,
    metrics: document.metrics,
    eventTypes: document.eventTypes,
    outcomeTypes: document.outcomeTypes,
    states: document.states,
  });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Attach / refresh `contract.rft` when building an operating contract.
 */
export function attachRftToOperatingContract(contract = {}, { priorRft = null, nowISO = null } = {}) {
  if (String(contract.schemaId) !== RFT_SCHEMA_ID) {
    return contract;
  }
  const rft = normalizeRftServiceStandard(priorRft ?? contract.rft ?? null, { nowISO });
  return {
    ...contract,
    version: Math.max(Number(contract.version) || 1, 1),
    rft,
  };
}

export function presentRftServiceStandard(rft = null) {
  const doc = normalizeRftServiceStandard(rft);
  return deepFreeze({
    kind: doc.kind,
    contractVersion: doc.contractVersion,
    contentHash: doc.contentHash,
    name: doc.name,
    slaSummary: `Acknowledge within ${doc.sla.acknowledgeWithinMinutes} minutes during operating hours`,
    approvalSummary: doc.approvalRules.customerFacingRequiresApproval
      ? "Customer-facing actions require approval until autonomy is earned"
      : "Customer-facing actions may auto-execute when eligible",
    proofSummary: doc.successProof.requireProviderIdsBeforeVerified
      ? "Verified requires provider-backed evidence ids"
      : "Verified proof optional",
    states: doc.states,
    outcomeTypes: doc.outcomeTypes,
  });
}
