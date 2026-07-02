import { CapabilityRegistry } from "./CapabilityRegistry.js";
import { CapabilityDependencyResolver } from "./CapabilityDependencyResolver.js";
import { CapabilityEvaluator } from "./CapabilityEvaluator.js";
import { computeCapabilityMetrics } from "./CapabilityMetrics.js";
import { deepFreeze } from "./_utils/deepFreeze.js";

export class BusinessCapabilityEngine {
  constructor({ registry } = {}) {
    this.registry = registry ?? new CapabilityRegistry();
    this.dependencyResolver = new CapabilityDependencyResolver({ registry: this.registry });
    this.evaluator = new CapabilityEvaluator({ registry: this.registry });
  }

  evaluate({ companyRuntime, onboardingRuntime, nowISO } = {}) {
    if (!companyRuntime) throw new Error("BusinessCapabilityEngine requires companyRuntime.");

    const runtimeContext = {
      companyRuntime,
      onboardingRuntime,
      lastEvaluatedAt: nowISO ?? "2026-07-01T00:00:00.000Z",
    };

    const topoOrder = this.dependencyResolver.getTopologicalOrder();
    const statusById = {};
    const evaluatedById = {};

    for (const capabilityId of topoOrder) {
      const capDef = this.registry.getById(capabilityId);
      const blockedBy = [];
      for (const depId of capDef?.dependencies ?? []) {
        const depStatus = statusById[String(depId)];
        if (!depStatus) continue;
        if (depStatus !== "READY") blockedBy.push(String(depId));
      }

      const evaluated = this.evaluator.evaluateCapability({
        capabilityId,
        runtimeContext,
        evaluatedDependencies: {
          blockedBy: {
            [String(capabilityId)]: { blockedBy },
          },
        },
      });

      evaluatedById[String(capabilityId)] = evaluated;
      statusById[String(capabilityId)] = evaluated.status;
    }

    const evaluatedCapabilities = this.registry.list().map((cap) => evaluatedById[String(cap.id)]);

    const metrics = computeCapabilityMetrics({ capabilities: evaluatedCapabilities });

    const overallReadiness = metrics.overallReadiness;
    const overallHealth = metrics.overallHealth;

    return deepFreeze({
      overallReadiness,
      overallHealth,
      completionPercentage: metrics.completionPercentage,
      completedCapabilities: metrics.completedCapabilities,
      blockedCapabilities: metrics.blockedCapabilities,
      readyCapabilities: evaluatedCapabilities.filter((c) => c.status === "READY").length,
      degradedCapabilities: metrics.degradedCapabilities,
      disabledCapabilities: metrics.disabledCapabilities,
      capabilities: evaluatedCapabilities,
      lastEvaluatedAt: runtimeContext.lastEvaluatedAt,
    });
  }
}

