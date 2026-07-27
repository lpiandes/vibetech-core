import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { validateOperatingContractCompleteness } from "../operating-contract/buildOperatingContract.js";
import { resolveOperatingContractSchema } from "../operating-contract/OperatingContractSchemas.js";

/**
 * Ready checklist before a custom / owner-added AI teammate is marked Live.
 * Pack-default roles also require a complete operating contract when present.
 */
export function buildCustomAiReadyChecklist(employee = {}, {
  hasRunProve = false,
  knowledgeCount = 0,
  requireOperatingContract = true,
} = {}) {
  const purpose = String(employee.purpose ?? employee.role ?? "").trim();
  const label = String(employee.label ?? employee.name ?? "").trim();
  const approvals = Array.isArray(employee.approvalRequirements)
    ? employee.approvalRequirements
    : [];
  const hasApprovalGate = approvals.map(String).some((entry) => /human_approval|approval/i.test(entry))
    || employee.communicationPermissions?.customerFacingRequiresApproval === true;
  const hasJob = Boolean(purpose) && purpose.length >= 12;
  const hasIdentity = Boolean(label);
  const hasKnowledge = Number(knowledgeCount) > 0;

  const items = [
    {
      id: "identity",
      label: "Teammate name",
      complete: hasIdentity,
      detail: hasIdentity ? label : "Add a clear teammate name.",
    },
    {
      id: "job",
      label: "Job defined",
      complete: hasJob,
      detail: hasJob ? "Purpose is defined." : "Describe what this teammate prepares for review.",
    },
    {
      id: "approvals",
      label: "Approval rules",
      complete: hasApprovalGate,
      detail: hasApprovalGate
        ? "Customer-facing sends require your approval."
        : "Require human approval before any customer send.",
    },
    {
      id: "knowledge",
      label: "Business knowledge",
      complete: hasKnowledge,
      detail: hasKnowledge
        ? "Knowledge is available for drafts."
        : "Upload at least one playbook or FAQ.",
    },
    {
      id: "prove",
      label: "Dry-run / prove",
      complete: Boolean(hasRunProve),
      detail: hasRunProve
        ? "A test job has completed."
        : "Run one specialty job and review the draft.",
    },
  ];

  if (requireOperatingContract) {
    const schema = resolveOperatingContractSchema({ employee });
    const contract = employee.operatingContract ?? null;
    const completeness = contract
      ? validateOperatingContractCompleteness(contract, schema)
      : {
        complete: false,
        missingKeys: (schema.scopeFields ?? [])
          .filter((f) => f.required !== false)
          .map((f) => f.key),
      };
    items.push({
      id: "operating_contract",
      label: "Operating contract",
      complete: Boolean(completeness.complete),
      detail: completeness.complete
        ? "Trigger, what runs, rules, and scope answers are set."
        : `Answer required: ${(completeness.missingKeys ?? []).join(", ") || "scope"}.`,
    });
  }

  const completeCount = items.filter((item) => item.complete).length;
  const ready = items.every((item) => item.complete);

  return deepFreeze({
    ready,
    completeCount,
    total: items.length,
    statusLabel: ready ? "Live" : `Ready ${completeCount}/${items.length}`,
    items,
  });
}

/**
 * Downgrade marketing "Live" until the ready checklist passes.
 */
export function resolveCustomAiPublicStatus(employee = {}, options = {}) {
  const checklist = buildCustomAiReadyChecklist(employee, options);
  if (checklist.ready) {
    return deepFreeze({
      statusKey: "READY",
      statusLabel: "Live",
      isReady: true,
      checklist,
    });
  }
  return deepFreeze({
    statusKey: "SETUP",
    statusLabel: checklist.statusLabel,
    isReady: false,
    checklist,
  });
}

/**
 * Pack-default teammates: Live only when operating contract scope is complete.
 */
export function resolvePackTeammatePublicStatus(employee = {}, {
  knowledgeCount = 0,
} = {}) {
  const schema = resolveOperatingContractSchema({ employee });
  const contract = employee.operatingContract ?? null;
  const completeness = contract
    ? validateOperatingContractCompleteness(contract, schema)
    : {
      complete: false,
      missingKeys: (schema.scopeFields ?? [])
        .filter((f) => f.required !== false)
        .map((f) => f.key),
    };

  if (!completeness.complete) {
    return deepFreeze({
      statusKey: "SETUP",
      statusLabel: `Needs setup: ${(completeness.missingKeys ?? []).slice(0, 3).join(", ")}`,
      isReady: false,
      completeness,
    });
  }

  if (Number(knowledgeCount) <= 0 && String(employee.readinessState ?? "") === "needs_knowledge") {
    return deepFreeze({
      statusKey: "SETUP",
      statusLabel: "Pack teammate — add Knowledge to operate",
      isReady: false,
      completeness,
    });
  }

  return deepFreeze({
    statusKey: "READY",
    statusLabel: "Live",
    isReady: true,
    completeness,
  });
}
