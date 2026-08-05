import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { normalizeRftServiceStandard } from "./rftContract.js";

export const REQUIRED_RESPONSIBILITY_FIELDS = Object.freeze([
  "eligibleLeadSources",
  "operatingHours",
  "responseSla",
  "qualificationBoundaries",
  "assignmentRules",
  "approvedActions",
  "approvalRequiredActions",
  "escalationOwner",
  "successDefinition",
  "lostDisqualifiedDefinition",
  "proposalFollowUpSchedule",
  "wonWorkHandoffRequirements",
]);

export const RESPONSIBILITY_FIELD_LABELS = Object.freeze({
  eligibleLeadSources: "Eligible lead sources",
  operatingHours: "Operating hours",
  responseSla: "Response SLA",
  qualificationBoundaries: "Qualification boundaries",
  assignmentRules: "Assignment rules",
  approvedActions: "Approved actions",
  approvalRequiredActions: "Approval-required actions",
  escalationOwner: "Escalation owner",
  successDefinition: "Success definition",
  lostDisqualifiedDefinition: "Lost / disqualified definition",
  proposalFollowUpSchedule: "Proposal follow-up schedule",
  wonWorkHandoffRequirements: "Won-work handoff requirements",
});

function asString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

function findRftContract(installation = null) {
  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];
  const employee = employees.find((entry) => entry?.operatingContract?.rft) ?? null;
  return normalizeRftServiceStandard(employee?.operatingContract?.rft ?? null);
}

function defaultResponsibilityFromContract(installation = null) {
  const rft = findRftContract(installation);
  const approvalRequired = [];
  if (rft.approvalRules.customerFacingRequiresApproval) {
    approvalRequired.push("Customer-facing actions require approval.");
  }
  if (rft.approvalRules.newProspectOutboundRequiresApproval) {
    approvalRequired.push("New-prospect outbound requires approval.");
  }
  if (rft.approvalRules.pricingOutsidePolicyRequiresApproval) {
    approvalRequired.push("Pricing outside policy requires approval.");
  }
  return {
    eligibleLeadSources: "",
    operatingHours: rft.sla.operatingHoursOnly ? "Operate inside defined business hours only." : "",
    responseSla: `Acknowledge within ${rft.sla.acknowledgeWithinMinutes} minutes.`,
    qualificationBoundaries: "",
    assignmentRules: rft.sla.assignmentRequired
      ? "Every opportunity needs a clear assignment owner before close."
      : "",
    approvedActions: Array.isArray(rft.permittedActions) ? rft.permittedActions.join("\n") : "",
    approvalRequiredActions: approvalRequired.join("\n"),
    escalationOwner: asString(rft.exceptionOwner, ""),
    successDefinition: rft.successProof.requireProviderIdsBeforeVerified
      ? "Verified requires provider-backed evidence before success is claimed."
      : "",
    lostDisqualifiedDefinition: "",
    proposalFollowUpSchedule: rft.sla.proposalReviewCadenceDays
      ? `Review open proposals every ${rft.sla.proposalReviewCadenceDays} day(s).`
      : "",
    wonWorkHandoffRequirements: rft.sla.wonHandoffRequired
      ? "Won-work handoff is required before close."
      : "",
  };
}

function normalizeResponsibility(raw = {}, installation = null) {
  const defaults = defaultResponsibilityFromContract(installation);
  const input = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const field of REQUIRED_RESPONSIBILITY_FIELDS) {
    out[field] = asString(input[field], defaults[field] ?? "");
  }
  return deepFreeze(out);
}

export function readRftResponsibility(installation = null) {
  return normalizeResponsibility(installation?.configuration?.rftResponsibility ?? {}, installation);
}

export function assertRftResponsibilityComplete(responsibility = {}) {
  const normalized = normalizeResponsibility(responsibility);
  const missing = REQUIRED_RESPONSIBILITY_FIELDS
    .filter((field) => !asString(normalized[field], "").trim())
    .map((field) => ({
      field,
      label: RESPONSIBILITY_FIELD_LABELS[field] ?? field,
    }));
  return deepFreeze({
    ok: missing.length === 0,
    missing,
    responsibility: normalized,
  });
}

export async function persistRftResponsibility({
  platformStore,
  installation,
  responsibility,
  actorId = "owner",
} = {}) {
  if (!platformStore || !installation) return null;
  const normalized = normalizeResponsibility(responsibility, installation);
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "rft_responsibility",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    configuration: {
      ...(installation.configuration ?? {}),
      rftResponsibility: normalized,
    },
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return normalized;
}
