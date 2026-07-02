import { createBusinessCapability } from "./BusinessCapability.js";
import { deepFreeze } from "./_utils/deepFreeze.js";

function normalizeStatusFromProgress({
  unmetRequirements,
  completionPercent,
  dependencyBlocked,
  requirementsLength,
} = {}) {
  if (dependencyBlocked) return "BLOCKED";
  if (requirementsLength > 0 && unmetRequirements.length === 0) return "READY";
  if (completionPercent > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function determineHealth({ status, unmetRequirements } = {}) {
  if (status === "READY") return "HEALTHY";
  if (status === "BLOCKED") return unmetRequirements.length ? "DEGRADED" : "DEGRADED";
  if (status === "IN_PROGRESS") return "DEGRADED";
  if (status === "NOT_STARTED") return "DEGRADED";
  if (status === "DISABLED") return "UNAVAILABLE";
  return "DEGRADED";
}

function getStepStatus(onboardingRuntime, stepId) {
  if (!onboardingRuntime?.getSteps) return null;
  const step = (onboardingRuntime.getSteps() ?? []).find((s) => s.id === stepId);
  return step?.status ?? null;
}

function isStepCompleted(onboardingRuntime, stepId) {
  const status = getStepStatus(onboardingRuntime, stepId);
  return status === "COMPLETED" || status === "SKIPPED";
}

function evaluateRequirement({ requirement, runtimeContext } = {}) {
  const { companyRuntime, onboardingRuntime } = runtimeContext ?? {};

  const met = (() => {
    switch (requirement?.type) {
      case "onboarding_step_completed":
        return isStepCompleted(onboardingRuntime, requirement.stepId);
      case "knowledge_repository_initialized":
        return Boolean(companyRuntime?.getKnowledgeRepository?.());
      case "company_brain_available":
        return typeof companyRuntime?.getKnowledge === "function";
      case "company_communication_engine_ready":
        return Array.isArray(companyRuntime?.getCommunications?.())
          ? companyRuntime.getCommunications().length >= 0
          : false;
      case "company_integration_connected_any":
        return Array.isArray(companyRuntime?.getIntegrations?.())
          ? companyRuntime.getIntegrations().some((i) => i && i.connected === true)
          : false;
      case "company_metrics_available":
        return Boolean(companyRuntime?.getMetrics?.());

      case "company_business_profile_validation_passed": {
        const profile = companyRuntime?.getBusinessProfile?.();
        return Boolean(profile?.metadata?.validation?.ok);
      }
      case "company_business_profile_completion_percent_threshold": {
        const threshold = typeof requirement?.threshold === "number" ? requirement.threshold : 80;
        const profile = companyRuntime?.getBusinessProfile?.();
        const completion = typeof profile?.metadata?.completionPercent === "number"
          ? profile.metadata.completionPercent
          : 0;
        return completion >= threshold;
      }
      case "company_profile_validation_passed": {
        const profile = companyRuntime?.getCompanyProfile?.();
        return Boolean(profile?.metadata?.validation?.ok);
      }
      case "company_profile_completion_percent_threshold": {
        const threshold = typeof requirement?.threshold === "number" ? requirement.threshold : 80;
        const profile = companyRuntime?.getCompanyProfile?.();
        const completion = typeof profile?.metadata?.completionPercent === "number"
          ? profile.metadata.completionPercent
          : 0;
        return completion >= threshold;
      }
      default:
        return false;
    }
  })();

  const unmetReason = met ? "" : String(requirement?.type ?? "unknown_requirement");
  return { met, unmetReason };
}

export class CapabilityEvaluator {
  constructor({ registry } = {}) {
    if (!registry) throw new Error("CapabilityEvaluator requires registry.");
    this.registry = registry;
  }

  evaluateCapability({ capabilityId, runtimeContext, evaluatedDependencies = {} } = {}) {
    const capDef = this.registry.getById(capabilityId);
    if (!capDef) throw new Error(`CapabilityEvaluator: unknown capability: ${capabilityId}`);

    const requirements = capDef.requirements ?? [];
    const { companyRuntime, onboardingRuntime } = runtimeContext ?? {};

    // Industry support gating (read-only)
    const industry = companyRuntime?.getCompany?.()?.industry ?? "any";
    const industryOk = (capDef.industrySupport ?? ["any"]).includes("any") ||
      (capDef.industrySupport ?? ["any"]).includes(industry);

    if (!industryOk) {
      return createBusinessCapability({
        id: capDef.id,
        name: capDef.name,
        description: capDef.description,
        category: capDef.category,
        status: "DISABLED",
        health: "UNAVAILABLE",
        requirements: requirements.map((r) => ({ requirement: r, met: false })),
        dependencies: capDef.dependencies ?? [],
        providedFeatures: capDef.providedFeatures ?? [],
        blockedBy: [],
        recommendations: [],
        completionPercent: 0,
        industrySupport: { requestedIndustry: industry, supported: false },
        metadata: { industry },
        lastEvaluatedAt: runtimeContext?.lastEvaluatedAt ?? "",
      });
    }

    const evaluatedRequirements = requirements.map((r) =>
      evaluateRequirement({ requirement: r, runtimeContext }),
    );
    const unmetRequirements = evaluatedRequirements.filter((x) => !x.met);
    const metCount = requirements.length - unmetRequirements.length;
    let completionPercent = requirements.length ? (metCount / requirements.length) * 100 : 0;

    // Company Identity completion should reflect the actual profile completion percentage.
    if (capabilityId === "company_identity") {
      const profile = companyRuntime?.getCompanyProfile?.();
      const profileCompletion = typeof profile?.metadata?.completionPercent === "number"
        ? profile.metadata.completionPercent
        : null;
      if (profileCompletion !== null) {
        completionPercent = Math.max(0, Math.min(100, profileCompletion));
      }
    }

    if (capabilityId === "business_profile") {
      const profile = companyRuntime?.getBusinessProfile?.();
      const profileCompletion = typeof profile?.metadata?.completionPercent === "number"
        ? profile.metadata.completionPercent
        : null;
      if (profileCompletion !== null) {
        completionPercent = Math.max(0, Math.min(100, profileCompletion));
      }
    }

    // dependency blockers (derived)
    const depsBlockedObj = (evaluatedDependencies?.blockedBy ?? {})[capDef.id];
    const depsBlocked = depsBlockedObj?.blockedBy ?? [];
    const dependencyBlocked = Array.isArray(depsBlocked) ? depsBlocked.length > 0 : false;

    const status = normalizeStatusFromProgress({
      unmetRequirements,
      completionPercent,
      dependencyBlocked,
      requirementsLength: requirements.length,
    });

    const health = determineHealth({ status, unmetRequirements });

    const recommendations = [];
    if (status === "NOT_STARTED") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
    } else if (status === "IN_PROGRESS") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
    } else if (status === "BLOCKED") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
      if (dependencyBlocked) {
        const deps = capDef.dependencies ?? [];
        recommendations.push(`Resolve dependencies first: ${deps.join(", ")}.`);
      }
    }

    const result = createBusinessCapability({
      id: capDef.id,
      name: capDef.name,
      description: capDef.description,
      category: capDef.category,
      status,
      health,
      requirements: evaluatedRequirements.map((r, idx) => ({
        requirement: requirements[idx],
        met: r.met,
      })),
      dependencies: capDef.dependencies ?? [],
      providedFeatures: capDef.providedFeatures ?? [],
      blockedBy: Array.isArray(depsBlocked) ? depsBlocked : [],
      recommendations: uniquePreserveOrder(recommendations.map(String)),
      completionPercent,
      industrySupport: { requestedIndustry: industry, supported: true },
      metadata: {
        unmetRequirements: unmetRequirements.map((u) => u.unmetReason),
        onboardingRuntimePresent: Boolean(onboardingRuntime),
        companyRuntimePresent: Boolean(companyRuntime),
      },
      lastEvaluatedAt: runtimeContext?.lastEvaluatedAt ?? "",
    });

    return deepFreeze(result);
  }
}

function uniquePreserveOrder(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const key = String(x);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }
  return out;
}

