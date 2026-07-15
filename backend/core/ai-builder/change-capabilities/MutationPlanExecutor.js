import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../../business-os/BusinessOSSpecification.js";
import { validateMutationPlan } from "./MutationPlan.js";
import {
  compileCustomAiEmployee,
  ensureCustomAiCapabilityRequirement,
} from "../custom-ai/CustomAiWorkerCompiler.js";
import { compileSpecialtySurfacesOnSpecification } from "../specialty/SpecialtySurfaceCompiler.js";

/**
 * Deterministic dispatcher by operationType — never by business intent.
 * Applies a mutation plan onto a Business OS specification (immutable).
 * Side-effect ops (invite/knowledge) are collected for post-approval execution.
 */
export class MutationPlanExecutor {
  applyToSpecification({
    specification,
    plan,
    actorPermissions = ["business.manage"],
    actorBusinessId = null,
    nowISO = new Date().toISOString(),
  } = {}) {
    if (!specification) {
      return deepFreeze({ ok: false, reason: "specification_required" });
    }
    try {
      validateMutationPlan(plan);
    } catch (err) {
      return deepFreeze({
        ok: false,
        reason: "invalid_plan",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (plan.businessId && actorBusinessId && String(plan.businessId) !== String(actorBusinessId)) {
      return deepFreeze({ ok: false, reason: "tenant_scope_mismatch" });
    }
    if (
      specification.businessId
      && actorBusinessId
      && String(specification.businessId) !== String(actorBusinessId)
      && !String(specification.businessId).startsWith("draft_")
    ) {
      return deepFreeze({ ok: false, reason: "tenant_scope_mismatch" });
    }

    const permissionSet = new Set((actorPermissions ?? []).map(String));
    const elevated = permissionSet.has("*") || permissionSet.has("business.manage");

    let working = { ...specification };
    const sideEffects = [];
    const applied = [];

    for (const op of plan.operations) {
      if (!elevated && !permissionSet.has(op.requiredPermission)) {
        return deepFreeze({
          ok: false,
          reason: "permission_denied",
          operationId: op.operationId,
          requiredPermission: op.requiredPermission,
        });
      }

      if (op.expectedCurrentState) {
        const stale = detectStale(working, op);
        if (stale) {
          return deepFreeze({
            ok: false,
            reason: "stale_state",
            operationId: op.operationId,
            detail: stale,
          });
        }
      }

      if (SIDE_EFFECT_TYPES.has(op.operationType)) {
        if (op.allowsExternalCommunication !== true && op.operationType === "inviteMembership") {
          return deepFreeze({
            ok: false,
            reason: "external_communication_prohibited",
            operationId: op.operationId,
          });
        }
        sideEffects.push(op);
        applied.push(op.operationId);
        // Invite/knowledge may also patch readiness hints on the spec.
        working = applySideEffectHint(working, op);
        continue;
      }

      const next = applyOperation(working, op, {
        businessId: actorBusinessId ?? plan.businessId ?? specification.businessId ?? null,
      });
      if (!next.ok) return deepFreeze({ ...next, operationId: op.operationId });
      working = next.specification;
      applied.push(op.operationId);
    }

    const nextVersion = Number(working.version ?? working.specificationVersion ?? 1) + 1;
    const nextSpecification = createBusinessOSSpecification({
      ...working,
      specificationVersion: nextVersion,
      version: nextVersion,
      status: "proposed",
      updatedAt: nowISO,
      contentHash: null,
      provenance: {
        ...(working.provenance ?? {}),
        lastMutationPlanId: plan.planId,
        lastCapabilityId: plan.capabilityId,
      },
    });

    return deepFreeze({
      ok: true,
      previousHash: specification.contentHash ?? null,
      nextSpecification,
      appliedOperationIds: applied,
      sideEffects,
      requiresDryRun: true,
      requiresApproval: true,
      plan,
    });
  }
}

const SIDE_EFFECT_TYPES = new Set([
  "inviteMembership",
  "createKnowledgeDocument",
  "updateKnowledgeDocument",
  "archiveKnowledgeDocument",
]);

function detectStale(specification, op) {
  const expected = op.expectedCurrentState;
  if (expected?.contentHash && specification.contentHash && expected.contentHash !== specification.contentHash) {
    return "content_hash_mismatch";
  }
  if (expected?.version != null) {
    const current = Number(specification.version ?? specification.specificationVersion ?? 1);
    if (Number(expected.version) !== current) return "version_mismatch";
  }
  return null;
}

function applySideEffectHint(specification, op) {
  if (op.operationType === "inviteMembership") {
    return {
      ...specification,
      readinessRequirements: [
        ...(specification.readinessRequirements ?? []),
        {
          requirementId: `invite_${op.idempotencyKey}`,
          label: `Invite ${op.payload?.email ?? "team member"}`,
          requiredForLaunch: false,
          pendingInvitation: {
            email: op.payload?.email ?? null,
            role: op.payload?.role ?? "EMPLOYEE",
          },
        },
      ],
    };
  }
  if (op.operationType.startsWith("createKnowledge") || op.operationType === "createKnowledgeDocument") {
    return {
      ...specification,
      knowledgeRequirements: [
        ...(specification.knowledgeRequirements ?? []),
        {
          categoryId: op.payload?.categoryId ?? "OPERATING_POLICIES",
          required: true,
          pendingDocument: {
            title: op.payload?.title ?? "New knowledge",
            allowsExternalCommunication: false,
          },
        },
      ],
    };
  }
  return specification;
}

function applyOperation(specification, op, { businessId = null } = {}) {
  switch (op.operationType) {
    case "updateBusinessProfile":
      return ok({
        ...specification,
        businessProfile: {
          ...specification.businessProfile,
          ...op.payload,
        },
      });
    case "addLocation": {
      const locations = [...(specification.businessProfile?.locations ?? [])];
      const label = op.payload?.label ?? op.payload?.name ?? "New location";
      if (locations.some((entry) => String(entry.label ?? entry).toLowerCase() === String(label).toLowerCase())) {
        return ok(specification); // idempotent
      }
      locations.push({
        label,
        source: op.payload?.source ?? "architect_change",
        ...(op.payload?.address ? { address: op.payload.address } : {}),
      });
      return ok({
        ...specification,
        businessProfile: { ...specification.businessProfile, locations },
      });
    }
    case "renameTerminology": {
      const from = op.payload?.from;
      const to = op.payload?.to;
      if (!from || !to) return fail("rename_requires_from_to");
      return ok({
        ...specification,
        terminology: {
          ...specification.terminology,
          presentation: {
            ...(specification.terminology?.presentation ?? {}),
            [from]: to,
          },
        },
        modules: (specification.modules ?? []).map((module) => (
          module.label === from ? { ...module, label: to } : module
        )),
      });
    }
    case "addModule": {
      const moduleId = slug(op.payload?.moduleId ?? op.payload?.label ?? "new_module");
      if ((specification.modules ?? []).some((m) => m.moduleId === moduleId)) {
        return ok(specification);
      }
      return ok({
        ...specification,
        modules: [
          ...(specification.modules ?? []),
          {
            moduleId,
            label: op.payload?.label ?? "New workspace",
            moduleType: op.payload?.moduleType ?? "operations",
            primaryNavigationEligible: true,
            navigationPriority: op.payload?.navigationPriority ?? 40,
            capabilityIds: op.payload?.capabilityIds ?? [],
          },
        ],
      });
    }
    case "enableEmployeeDefinition": {
      const label = op.payload?.label ?? "New team member";
      const employeeId = op.targetId
        ?? op.payload?.employeeId
        ?? `emp_${slug(label).slice(0, 24)}`;
      const existing = specification.employeeDefinitions ?? [];
      if (existing.some((e) => e.employeeId === employeeId || String(e.label).toLowerCase() === String(label).toLowerCase())) {
        return ok(specification);
      }
      const hired = compileCustomAiEmployee({
        employeeId,
        label,
        archetypeId: op.payload?.archetypeId ?? "coordinator",
        purpose: op.payload?.purpose ?? op.reason ?? `Hired: ${label}`,
        applicableModules: op.payload?.applicableModules ?? ["work", "digital_workforce", "people"],
        readinessState: op.payload?.readinessState ?? "custom_ai_ready",
        enabled: true,
        ownerAdded: Boolean(op.payload?.ownerAdded ?? op.payload?.customAi ?? true),
      }, { ownerAdded: true });
      return ok(compileSpecialtySurfacesOnSpecification(
        ensureCustomAiCapabilityRequirement({
          ...specification,
          employeeDefinitions: [...existing, hired],
        }),
        { businessId: businessId ?? specification.businessId ?? null },
      ));
    }
    case "disableEmployeeDefinition": {
      const needle = String(op.targetId ?? op.payload?.employeeId ?? op.payload?.match ?? "").toLowerCase();
      return ok({
        ...specification,
        employeeDefinitions: (specification.employeeDefinitions ?? []).map((employee) => {
          const hit = employee.employeeId === op.targetId
            || String(employee.label).toLowerCase().includes(needle);
          return hit ? { ...employee, enabled: false, readinessState: "disabled" } : employee;
        }).filter((employee) => {
          if (op.payload?.archive) {
            return !(employee.employeeId === op.targetId
              || String(employee.label).toLowerCase().includes(needle));
          }
          return true;
        }),
      });
    }
    case "updateEmployeeConfiguration": {
      return ok({
        ...specification,
        employeeDefinitions: (specification.employeeDefinitions ?? []).map((employee) => {
          if (employee.employeeId !== op.targetId && employee.label !== op.payload?.label) {
            return employee;
          }
          return { ...employee, ...op.payload, employeeId: employee.employeeId };
        }),
      });
    }
    case "grantPermission":
    case "revokePermission":
    case "updateMembershipRole": {
      const roleId = op.targetId ?? op.payload?.roleId;
      const moduleId = op.payload?.moduleId;
      return ok({
        ...specification,
        roleDefinitions: (specification.roleDefinitions ?? []).map((role) => {
          if (roleId && role.roleId !== roleId && role.membershipRole !== roleId) return role;
          if (op.operationType === "grantPermission" && moduleId) {
            return {
              ...role,
              moduleVisibility: [...new Set([...(role.moduleVisibility ?? []), moduleId])],
              deniedModules: (role.deniedModules ?? []).filter((id) => id !== moduleId),
            };
          }
          if (op.operationType === "revokePermission" && moduleId) {
            return {
              ...role,
              deniedModules: [...new Set([...(role.deniedModules ?? []), moduleId])],
              moduleVisibility: (role.moduleVisibility ?? []).filter((id) => id !== moduleId),
            };
          }
          if (op.payload?.permissions) {
            return { ...role, permissions: op.payload.permissions };
          }
          return role;
        }),
      });
    }
    case "enableIntegration":
    case "disableIntegration":
    case "updateIntegrationConfiguration": {
      const needle = String(op.targetId ?? op.payload?.integrationId ?? "").toLowerCase();
      const status = op.operationType === "enableIntegration"
        ? "required"
        : op.operationType === "disableIntegration"
          ? "disconnected"
          : (op.payload?.status ?? "required");
      let list = [...(specification.integrationRequirements ?? [])];
      const idx = list.findIndex((entry) => {
        const hay = `${entry.integrationId ?? ""} ${entry.label ?? ""}`.toLowerCase();
        return entry.integrationId === op.targetId || hay.includes(needle) || needle.includes(String(entry.integrationId ?? ""));
      });
      if (idx < 0 && op.operationType === "enableIntegration") {
        list.push({
          integrationId: op.payload?.integrationId ?? slug(op.payload?.label ?? "integration"),
          label: op.payload?.label ?? op.targetId ?? "Integration",
          status,
        });
      } else if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...op.payload,
          status: op.operationType === "updateIntegrationConfiguration" ? (op.payload?.status ?? list[idx].status) : status,
        };
      }
      return ok({ ...specification, integrationRequirements: list });
    }
    case "createWorkflow": {
      const workflowId = op.targetId ?? op.payload?.workflowId ?? `workflow_${slug(op.payload?.label ?? "new")}`;
      if ((specification.workflowDefinitions ?? []).some((w) => w.workflowId === workflowId)) {
        return ok(specification);
      }
      return ok({
        ...specification,
        workflowDefinitions: [
          ...(specification.workflowDefinitions ?? []),
          {
            workflowId,
            label: op.payload?.label ?? "New workflow",
            ...(op.payload?.configuration ? { configuration: op.payload.configuration } : {}),
          },
        ],
      });
    }
    case "updateWorkflow": {
      return ok({
        ...specification,
        workflowDefinitions: (specification.workflowDefinitions ?? []).map((workflow) => (
          workflow.workflowId === op.targetId
            ? { ...workflow, ...op.payload, workflowId: workflow.workflowId }
            : workflow
        )),
      });
    }
    case "archiveWorkflow": {
      return ok({
        ...specification,
        workflowDefinitions: (specification.workflowDefinitions ?? []).filter(
          (workflow) => workflow.workflowId !== op.targetId,
        ),
      });
    }
    case "updateApprovalPolicy": {
      const policyId = op.targetId ?? op.payload?.policyId ?? `approval_${slug(op.payload?.label ?? "policy")}`;
      const existing = specification.governancePolicies ?? [];
      const idx = existing.findIndex((p) => p.policyId === policyId);
      if (idx >= 0) {
        const next = [...existing];
        next[idx] = { ...next[idx], ...op.payload, policyId, enforced: op.payload?.enforced ?? true };
        return ok({ ...specification, governancePolicies: next });
      }
      return ok({
        ...specification,
        governancePolicies: [
          ...existing,
          {
            policyId,
            label: op.payload?.label ?? "Approval policy",
            enforced: op.payload?.enforced ?? true,
          },
        ],
      });
    }
    case "enableCapability":
    case "disableCapability":
    case "enableComponent":
    case "disableComponent": {
      const capabilityId = op.targetId ?? op.payload?.capabilityId ?? op.payload?.componentId;
      const listKey = op.operationType.includes("Component") ? "capabilityRequirements" : "capabilityRequirements";
      let list = [...(specification[listKey] ?? [])];
      const idx = list.findIndex((entry) => entry.capabilityId === capabilityId);
      if (op.operationType.startsWith("enable")) {
        if (idx < 0) list.push({ capabilityId, status: "enabled", ...(op.payload ?? {}) });
        else list[idx] = { ...list[idx], status: "enabled", ...op.payload };
      } else if (idx >= 0) {
        list[idx] = { ...list[idx], status: "disabled" };
      }
      return ok({ ...specification, [listKey]: list });
    }
    case "addCampaign": {
      const campaignTemplateId = op.targetId
        ?? op.payload?.campaignTemplateId
        ?? `campaign_${slug(op.payload?.label ?? "campaign")}`;
      if ((specification.campaignDefinitions ?? []).some((c) => c.campaignTemplateId === campaignTemplateId)) {
        return ok(specification);
      }
      return ok({
        ...specification,
        campaignDefinitions: [
          ...(specification.campaignDefinitions ?? []),
          {
            campaignTemplateId,
            label: op.payload?.label ?? "New campaign",
            channel: op.payload?.channel ?? "email",
            approvalRequired: true,
          },
        ],
      });
    }
    case "appendUnresolvedRequirement": {
      return ok({
        ...specification,
        unresolvedRequirements: [
          ...(specification.unresolvedRequirements ?? []),
          {
            id: op.targetId ?? op.payload?.id ?? `change_${op.idempotencyKey}`,
            question: op.payload?.question ?? op.reason ?? "Unrecognized change — needs clarification.",
          },
        ],
      });
    }
    case "updateBusinessOSConfiguration": {
      return ok({
        ...specification,
        ...op.payload,
        businessProfile: op.payload?.businessProfile
          ? { ...specification.businessProfile, ...op.payload.businessProfile }
          : specification.businessProfile,
      });
    }
    case "createEntity":
    case "updateEntity":
    case "archiveEntity":
    case "createRelationship":
    case "endRelationship":
      return fail(`operation_requires_runtime_adapter:${op.operationType}`);
    default:
      return fail(`unsupported_operation:${op.operationType}`);
  }
}

function ok(specification) {
  return { ok: true, specification };
}

function fail(reason) {
  return { ok: false, reason };
}

function slug(value) {
  return String(value ?? "item")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40) || "item";
}

export const mutationPlanExecutor = new MutationPlanExecutor();
