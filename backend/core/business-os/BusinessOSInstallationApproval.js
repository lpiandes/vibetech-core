import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { hashInstallationPlan } from "./BusinessOSSpecificationHasher.js";

/**
 * Approval bound to exact specification version/hash + plan hash.
 * Any content change invalidates the approval.
 */
export function createBusinessOSInstallationApproval({
  approvalId,
  businessId,
  specificationId,
  specificationVersion,
  specificationContentHash,
  planId,
  planHash,
  approvedByUserId,
  approvedAt = new Date().toISOString(),
  status = "approved",
  notes = null,
} = {}) {
  if (!approvalId) throw new Error("BusinessOSInstallationApproval: approvalId required.");
  if (!businessId) throw new Error("BusinessOSInstallationApproval: businessId required.");
  if (!specificationContentHash) throw new Error("BusinessOSInstallationApproval: specificationContentHash required.");
  if (!planHash) throw new Error("BusinessOSInstallationApproval: planHash required.");
  if (!approvedByUserId) throw new Error("BusinessOSInstallationApproval: approvedByUserId required.");

  return deepFreeze({
    approvalId: String(approvalId),
    businessId: String(businessId),
    specificationId: String(specificationId),
    specificationVersion: Number(specificationVersion),
    specificationContentHash: String(specificationContentHash),
    planId: String(planId),
    planHash: String(planHash),
    approvedByUserId: String(approvedByUserId),
    approvedAt: String(approvedAt),
    status: String(status),
    notes: notes == null ? null : String(notes),
  });
}

export function validateInstallationApproval({ approval, specification, plan } = {}) {
  if (!approval || approval.status !== "approved") {
    return deepFreeze({ ok: false, reason: "approval_required" });
  }
  if (String(approval.businessId) !== String(specification.businessId ?? approval.businessId)) {
    if (specification.businessId && String(approval.businessId) !== String(specification.businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_approval" });
    }
  }
  if (String(approval.specificationId) !== String(specification.specificationId)) {
    return deepFreeze({ ok: false, reason: "stale_approval_specification_id" });
  }
  if (Number(approval.specificationVersion) !== Number(specification.version ?? specification.specificationVersion)) {
    return deepFreeze({ ok: false, reason: "stale_approval_specification_version" });
  }
  if (String(approval.specificationContentHash) !== String(specification.contentHash)) {
    return deepFreeze({ ok: false, reason: "stale_approval_specification_hash" });
  }
  if (String(approval.planId) !== String(plan.planId)) {
    return deepFreeze({ ok: false, reason: "stale_approval_plan_id" });
  }
  const currentPlanHash = plan.planHash ?? hashInstallationPlan(plan);
  if (String(approval.planHash) !== String(currentPlanHash)) {
    return deepFreeze({ ok: false, reason: "stale_approval_plan_hash" });
  }
  return deepFreeze({ ok: true });
}
