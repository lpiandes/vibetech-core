import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { buildOperatingContract } from "../operating-contract/buildOperatingContract.js";

/**
 * Compile one confirmed responsibility into a dedicated Operating Contract
 * (not one mega-contract for the whole business).
 */
export function compileResponsibilityOperatingContract({
  request,
  industry = "other",
  employeeOverrides = {},
} = {}) {
  if (!request?.responsibilityId) {
    throw new Error("compileResponsibilityOperatingContract: request required");
  }

  const employee = {
    employeeId: `emp_resp_${String(request.responsibilityId).replace(/^resp_/, "")}`,
    roleId: "responsibility_operator",
    label: request.title || "Responsibility operator",
    name: request.title || "Responsibility operator",
    description: request.requestedOutcome || request.rawRequest,
    operatingContract: {
      scope: {
        audience: request.affectedSubjects || "Eligible subjects as confirmed",
        when: request.triggerDescription || request.frequency || "When the confirmed trigger fires",
        where: (request.systemsMentioned ?? []).join(", ") || "Connected systems as confirmed",
        howMany: request.volume || "As volume allows",
        constraints: [
          request.approvalExpectations,
          ...(Array.isArray(request.constraints)
            ? request.constraints.map((c) => c?.description).filter(Boolean)
            : []),
        ].filter(Boolean).join("\n") || "Follow confirmed approval boundaries",
      },
      trigger: {
        mode: /week|schedule|every|wednesday|daily/i.test(String(request.triggerDescription || request.frequency))
          ? "schedule"
          : "events",
        summary: request.triggerDescription || "When the confirmed trigger fires",
      },
      executes: {
        summary: request.actionDescription || request.requestedOutcome || request.rawRequest,
      },
      automationPath: buildOperatorAwarePath(request),
      responsibilityId: request.responsibilityId,
      implementationMode: request.implementationMode,
      successProof: request.successDescription,
      failureBehavior: request.failureBehavior,
      ...employeeOverrides.operatingContract,
    },
    ...employeeOverrides,
  };

  const built = buildOperatingContract({ employee, industry });
  return deepFreeze({
    responsibilityId: request.responsibilityId,
    employee,
    contract: built.contract,
    schema: built.schema,
    contentHash: built.contentHash ?? built.contract?.contentHash ?? null,
  });
}

function buildOperatorAwarePath(request) {
  const mode = String(request?.implementationMode ?? "");
  const steps = [
    { id: "detect", label: "Detect trigger", actor: "automated" },
    { id: "prepare", label: "Prepare action", actor: "automated" },
  ];
  if (mode === "operator_assisted") {
    steps.push({ id: "operator_review", label: "VIBETech operator review", actor: "vibetech_operator" });
  }
  if (/approv|first\s+external|everything until shadow/i.test(String(request?.approvalExpectations ?? ""))
    || mode !== "ready_existing_capabilities") {
    steps.push({ id: "customer_approve", label: "Customer approval when required", actor: "customer" });
  }
  steps.push({ id: "execute", label: "Execute approved actions", actor: "automated" });
  steps.push({ id: "prove", label: "Record success proof", actor: "automated" });
  return {
    version: 1,
    steps,
    summary: `Path for ${request?.title ?? "responsibility"}`,
  };
}
