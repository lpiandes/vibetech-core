import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { evaluateBusinessOSInstallReadiness } from "./BusinessOSReadinessEvaluator.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Dry-run service: simulates installation without mutating business state.
 */
export class BusinessOSDryRunService {
  constructor({ repository } = {}) {
    this.repository = repository;
  }

  run({ specification, plan, businessId, nowISO = new Date().toISOString() }) {
    if (specification.businessId && businessId && String(specification.businessId) !== String(businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_specification" });
    }

    const readiness = evaluateBusinessOSInstallReadiness({
      specification,
      plan,
      dryRunCompleted: false,
      approved: false,
    });
    if (!readiness.ok) {
      return deepFreeze({ ok: false, reason: "not_ready", readiness });
    }

    const before = this.repository?.getInstallation?.(businessId) ?? null;
    const simulated = asArray(plan.operations ?? plan.actions).map((operation) => ({
      operationId: operation.operationId ?? operation.actionId,
      actionId: operation.actionId ?? operation.operationId,
      operationType: operation.operationType ?? operation.type,
      type: operation.type ?? operation.operationType,
      outcome: operation.deferred
        ? "deferred"
        : operation.requiresSetup
          ? "requires_setup"
          : "would_apply",
      explanation: operation.explanation ?? operation.reason,
      risk: operation.risk ?? "low",
      reversible: operation.reversible !== false,
    }));

    const after = this.repository?.getInstallation?.(businessId) ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error("BusinessOSDryRunService: dry-run mutated installation state.");
    }

    const result = deepFreeze({
      ok: true,
      dryRun: true,
      mutated: false,
      businessId: String(businessId),
      planId: plan.planId,
      planHash: plan.planHash,
      specificationContentHash: specification.contentHash,
      specificationVersion: specification.version ?? specification.specificationVersion,
      simulatedActions: simulated,
      simulatedOperations: simulated,
      readiness: evaluateBusinessOSInstallReadiness({
        specification,
        plan,
        dryRunCompleted: true,
        approved: false,
      }),
      completedAt: nowISO,
    });

    this.repository?.saveDryRun?.(result);
    return result;
  }
}
