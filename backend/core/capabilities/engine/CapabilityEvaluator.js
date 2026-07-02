import { createBusinessCapability } from "./BusinessCapability.js";
import { deepFreeze } from "./_utils/deepFreeze.js";
import { CompanyBrain } from "../../company/brain/CompanyBrain.js";

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
  if (status === "BLOCKED") return "DEGRADED";
  if (status === "IN_PROGRESS") return "DEGRADED";
  if (status === "NOT_STARTED") return "DEGRADED";
  if (status === "DISABLED") return "UNAVAILABLE";
  if (status === "DEGRADED") return "DEGRADED";
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

      case "company_connected_systems_any_ready": {
        const systems = companyRuntime?.getConnectedSystems?.();
        const list = Array.isArray(systems) ? systems : [];
        return list.some((s) => s && s.status === "READY");
      }

      case "company_connected_systems_feature_available": {
        const feature = String(requirement?.feature ?? "");
        if (!feature) return false;
        const systems = companyRuntime?.getConnectedSystems?.();
        const list = Array.isArray(systems) ? systems : [];
        return list.some((s) => s && s.status === "READY" && Array.isArray(s.features) && s.features.includes(feature));
      }
      case "company_metrics_available":
        return Boolean(companyRuntime?.getMetrics?.());

      case "company_communication_setup_email_ready": {
        const setup = companyRuntime?.getCommunicationSetup?.();
        return Boolean(setup?.readiness?.emailReady);
      }
      case "company_communication_setup_sms_ready": {
        const setup = companyRuntime?.getCommunicationSetup?.();
        return Boolean(setup?.readiness?.smsReady);
      }
      case "company_communication_setup_brand_ready": {
        const setup = companyRuntime?.getCommunicationSetup?.();
        return Boolean(setup?.readiness?.brandReady);
      }
      case "company_communication_setup_quiet_hours_ready": {
        const setup = companyRuntime?.getCommunicationSetup?.();
        return Boolean(setup?.readiness?.quietHoursReady);
      }
      case "company_communication_setup_approval_policy_ready": {
        const setup = companyRuntime?.getCommunicationSetup?.();
        return Boolean(setup?.readiness?.approvalPolicyReady);
      }

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
      case "company_knowledge_repository_initialized":
        return Boolean(companyRuntime?.getKnowledgeRepository?.());

      case "company_knowledge_categories_available": {
        const categories = companyRuntime?.getKnowledgeCategories?.();
        const items = Array.isArray(categories?.items) ? categories.items : [];
        return items.length > 0;
      }

      case "company_knowledge_items_published": {
        const repo = companyRuntime?.getKnowledgeRepository?.();
        const items = Array.isArray(repo?.items) ? repo.items : [];
        const published = items.filter((i) => i && i.status !== "ARCHIVED");
        return published.length > 0;
      }

      case "company_knowledge_minimum_published_count": {
        const minCount = typeof requirement?.minCount === "number" ? requirement.minCount : 1;
        const repo = companyRuntime?.getKnowledgeRepository?.();
        const items = Array.isArray(repo?.items) ? repo.items : [];
        const published = items.filter((i) => i && i.status !== "ARCHIVED");
        return published.length >= minCount;
      }

      case "company_knowledge_publishing_activity_exists": {
        const activities = companyRuntime?.getActivities?.() ?? [];
        return activities.some(
          (a) =>
            a?.action === "KNOWLEDGE_PUBLISH_STARTED" ||
            a?.action === "KNOWLEDGE_PUBLISH_FAILED" ||
            a?.action === "KNOWLEDGE_PUBLISHED" ||
            a?.action === "KNOWLEDGE_INGESTION_COMPLETED",
        );
      }

      case "company_knowledge_brain_context_available": {
        try {
          const brain = new CompanyBrain({ runtime: companyRuntime });
          const employees = Array.isArray(companyRuntime?.getEmployees?.())
            ? companyRuntime.getEmployees()
            : [];
          const employeeId = employees[0]?.employeeId ?? "";

          const ctx = brain.buildBusinessContext({
            employeeId,
            task: "knowledge_readiness_check",
            relatedEntities: {
              buyerInquiry: { message: "General inquiry" },
            },
          });

          const usable =
            ctx &&
            typeof ctx.summary === "string" &&
            ctx.summary.trim().length > 0 &&
            ((Array.isArray(ctx.relevantDocuments) && ctx.relevantDocuments.length > 0) ||
              (Array.isArray(ctx.relevantPolicies) && ctx.relevantPolicies.length > 0) ||
              (typeof ctx.brandVoice === "string" && ctx.brandVoice.trim().length > 0));

          return Boolean(usable);
        } catch {
          return false;
        }
      }

      case "company_knowledge_no_blocking_errors": {
        const activities = companyRuntime?.getActivities?.() ?? [];
        const hasFailure = activities.some(
          (a) =>
            a?.action === "KNOWLEDGE_INGESTION_FAILED" ||
            a?.action === "KNOWLEDGE_PUBLISH_FAILED" ||
            String(a?.status ?? "").startsWith("FAILED"),
        );
        return !hasFailure;
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

    // Knowledge capability has explicit readiness states (NOT_STARTED/IN_PROGRESS/READY/BLOCKED/DEGRADED)
    // based on deterministic published count + brain/context + error activities.
    if (capabilityId === "knowledge") {
      const repo = companyRuntime?.getKnowledgeRepository?.();
      const repoItems = Array.isArray(repo?.items) ? repo.items : [];
      const publishedCount = repoItems.filter((i) => i && i.status !== "ARCHIVED").length;

      const categories = companyRuntime?.getKnowledgeCategories?.();
      const categoryItems = Array.isArray(categories?.items) ? categories.items : [];
      const categoriesCount = categoryItems.length;

      const evaluatedByType = {};
      for (let i = 0; i < requirements.length; i += 1) {
        const t = requirements[i]?.type;
        evaluatedByType[String(t)] = evaluatedRequirements[i]?.met ?? false;
      }

      const noBlockingErrorsMet = Boolean(evaluatedByType.company_knowledge_no_blocking_errors);
      const categoriesAvailableMet = Boolean(evaluatedByType.company_knowledge_categories_available);
      const brainContextAvailableMet = Boolean(
        evaluatedByType.company_knowledge_brain_context_available,
      );
      const minPublishedMet = Boolean(evaluatedByType.company_knowledge_minimum_published_count);

      // If core systems are missing, block.
      if (publishedCount === 0) {
        // Repository exists but no usable published knowledge.
        completionPercent = 0;
      } else if (!categoriesAvailableMet || categoriesCount === 0 || !brainContextAvailableMet) {
        // Missing knowledge system or brain context failure.
        completionPercent = completionPercent; // keep computed
      } else if (!minPublishedMet) {
        // Some knowledge exists but not enough for full readiness.
        completionPercent = Math.max(5, completionPercent);
      } else if (!noBlockingErrorsMet) {
        // Knowledge exists but has ingestion/publish failures; treat as DEGRADED.
        completionPercent = Math.max(50, completionPercent);
      }
    }

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

    let finalStatus = status;
    if (capabilityId === "knowledge") {
      // Explicit override for knowledge.
      if (!dependencyBlocked) {
        const repo = companyRuntime?.getKnowledgeRepository?.();
        const repoItems = Array.isArray(repo?.items) ? repo.items : [];
        const publishedCount = repoItems.filter((i) => i && i.status !== "ARCHIVED").length;

        const minCountReq = requirements.find(
          (r) => r.type === "company_knowledge_minimum_published_count",
        );
        const minCount =
          minCountReq && typeof minCountReq.minCount === "number" ? minCountReq.minCount : 1;

        const evaluatedByType = {};
        for (let i = 0; i < requirements.length; i += 1) {
          const t = requirements[i]?.type;
          evaluatedByType[String(t)] = evaluatedRequirements[i]?.met ?? false;
        }
        const noBlockingErrorsMet = Boolean(evaluatedByType.company_knowledge_no_blocking_errors);
        const categoriesAvailableMet = Boolean(evaluatedByType.company_knowledge_categories_available);
        const brainContextAvailableMet = Boolean(evaluatedByType.company_knowledge_brain_context_available);

        const missingCore = !categoriesAvailableMet || !brainContextAvailableMet;

        if (missingCore) finalStatus = "BLOCKED";
        else if (publishedCount === 0) finalStatus = "NOT_STARTED";
        else if (publishedCount < minCount) finalStatus = "IN_PROGRESS";
        else if (!noBlockingErrorsMet) finalStatus = "DEGRADED";
        else if (unmetRequirements.length === 0) finalStatus = "READY";
        else finalStatus = "IN_PROGRESS";
      }
    }

    const health = determineHealth({ status: finalStatus, unmetRequirements });

    const recommendations = [];
    if (finalStatus === "NOT_STARTED") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
    } else if (finalStatus === "IN_PROGRESS") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
    } else if (finalStatus === "BLOCKED") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
      if (dependencyBlocked) {
        const deps = capDef.dependencies ?? [];
        recommendations.push(`Resolve dependencies first: ${deps.join(", ")}.`);
      }
    } else if (finalStatus === "DEGRADED") {
      recommendations.push(...(capDef.recommendationSeeds ?? []));
    }

    if (capabilityId === "knowledge" && finalStatus !== "READY") {
      const unmetTypes = evaluatedRequirements
        .map((r, i) => (!r.met ? requirements[i]?.type : null))
        .filter(Boolean);

      const add = (s) => recommendations.push(s);
      const has = (t) => unmetTypes.includes(t);

      if (has("company_knowledge_repository_initialized")) add("Upload company knowledge.");
      if (has("company_knowledge_categories_available")) add("Add knowledge categories.");
      if (has("company_knowledge_items_published") || has("company_knowledge_minimum_published_count"))
        add("Publish at least one knowledge item.");
      if (has("company_knowledge_brain_context_available")) add("Review imported knowledge drafts.");
      if (has("company_knowledge_no_blocking_errors")) add("Resolve knowledge errors.");
      if (has("company_knowledge_publishing_activity_exists")) add("Publish imported knowledge.");

      // Extra deterministic suggestions (safe general recommendations).
      if (has("company_knowledge_items_published") || has("company_knowledge_minimum_published_count")) {
        add("Add FAQs or SOPs.");
        add("Add company policies.");
      }
    }

    const result = createBusinessCapability({
      id: capDef.id,
      name: capDef.name,
      description: capDef.description,
      category: capDef.category,
      status: finalStatus,
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

