import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { MutationPlanExecutor } from "./change-capabilities/MutationPlanExecutor.js";
import { createMutationOperation, createMutationPlan } from "./change-capabilities/MutationPlan.js";
import {
  getDefaultArchitectChangeCapabilityRegistry,
} from "./change-capabilities/ArchitectChangeCapabilityRegistry.js";
import { registerDefaultArchitectChangeCapabilities } from "./change-capabilities/registerDefaultArchitectChangeCapabilities.js";
import { buildMutationPlanFromTemplate } from "./change-capabilities/buildMutationPlanFromTemplate.js";

/**
 * Compatibility façade — delegates to registry + universal MutationPlanExecutor.
 * Prefer ArchitectChangeCapabilityRunner for new call sites.
 */
export class BuilderSpecificationChangePlanner {
  constructor({
    registry = null,
    executor = new MutationPlanExecutor(),
  } = {}) {
    this.registry = registry ?? getDefaultArchitectChangeCapabilityRegistry();
    registerDefaultArchitectChangeCapabilities({ registry: this.registry });
    this.executor = executor;
  }

  apply({ specification, change } = {}) {
    if (!specification) throw new Error("BuilderSpecificationChangePlanner: specification required.");
    if (!change) throw new Error("BuilderSpecificationChangePlanner: change required.");

    const kind = change.kind ?? change.capabilityId;
    const capability = this.registry.resolveLegacyKind(kind)
      ?? this.registry.get(kind)
      ?? this.registry.get(change.capabilityId);

    if (!capability) {
      // Fallback: append unresolved via primitive
      const plan = createMutationPlan({
        capabilityId: "architect.change.unsupported_fallback",
        businessId: specification.businessId,
        operations: [createMutationOperation({
          operationType: "appendUnresolvedRequirement",
          targetType: "unresolved_requirement",
          payload: { question: change.text ?? "Unrecognized change — needs clarification." },
          requiredPermission: "business.manage",
          affectedRuntimeKinds: [],
          allowsExternalCommunication: false,
        })],
        summary: "Unsupported change clarification",
      });
      const applied = this.executor.applyToSpecification({ specification, plan });
      if (!applied.ok) throw new Error(applied.reason ?? "mutation_failed");
      return deepFreeze({
        ok: true,
        previousHash: applied.previousHash,
        nextSpecification: applied.nextSpecification,
        requiresDryRun: true,
        requiresApproval: true,
        mutationPlan: plan,
      });
    }

    const values = {
      ...(change.values ?? {}),
      from: change.from,
      to: change.to,
      label: change.label,
      match: change.match,
      text: change.text,
    };

    const plan = buildMutationPlanFromTemplate({
      capability,
      values,
      text: change.text ?? "",
      businessId: specification.businessId,
      createMutationPlan,
      createMutationOperation,
    });

    const applied = this.executor.applyToSpecification({
      specification,
      plan,
      actorBusinessId: specification.businessId,
    });
    if (!applied.ok) {
      throw new Error(`BuilderSpecificationChangePlanner: ${applied.reason}`);
    }

    return deepFreeze({
      ok: true,
      previousHash: applied.previousHash,
      nextSpecification: applied.nextSpecification,
      requiresDryRun: true,
      requiresApproval: true,
      mutationPlan: plan,
      capabilityId: capability.capabilityId,
    });
  }
}
