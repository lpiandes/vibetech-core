import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { withSpecificationStatus } from "./BusinessOSSpecification.js";
import { evaluateBusinessOSInstallReadiness } from "./BusinessOSReadinessEvaluator.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * In-memory installation state for deterministic tests and dry-run proofs.
 * Persistence adapters can wrap the same action checkpoint model.
 */
export class InMemoryBusinessOSInstallStore {
  constructor() {
    this.specifications = new Map();
    this.installations = new Map();
  }

  saveSpecification(specification) {
    const key = `${specification.businessId ?? "draft"}:${specification.specificationId}:v${specification.specificationVersion}`;
    this.specifications.set(key, specification);
    return specification;
  }

  getInstallation(businessId) {
    return this.installations.get(String(businessId)) ?? null;
  }

  saveInstallation(record) {
    this.installations.set(String(record.businessId), deepFreeze(record));
    return this.installations.get(String(record.businessId));
  }
}

/**
 * Governed installer: dry-run never mutates; install requires approved completed dry run.
 */
export class BusinessOSInstaller {
  constructor({ store = new InMemoryBusinessOSInstallStore() } = {}) {
    this.store = store;
  }

  dryRun({ specification, plan, businessId, nowISO = new Date().toISOString() }) {
    if (specification.businessId && businessId && String(specification.businessId) !== String(businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_specification" });
    }
    const readiness = evaluateBusinessOSInstallReadiness({ specification, plan, dryRunCompleted: false, approved: false });
    if (!readiness.ok) return deepFreeze({ ok: false, reason: "not_ready", readiness });

    const before = this.store.getInstallation(businessId);
    // Dry run must not mutate installation state.
    const after = this.store.getInstallation(businessId);
    assertSame(before, after);

    const simulated = asArray(plan.actions).map((action) => ({
      actionId: action.actionId,
      type: action.type,
      outcome: action.deferred ? "deferred" : action.requiresSetup ? "requires_setup" : "would_apply",
      explanation: action.explanation,
    }));

    return deepFreeze({
      ok: true,
      dryRun: true,
      mutated: false,
      businessId: String(businessId),
      planId: plan.planId,
      simulatedActions: simulated,
      readiness: evaluateBusinessOSInstallReadiness({
        specification,
        plan,
        dryRunCompleted: true,
        approved: false,
      }),
      completedAt: nowISO,
    });
  }

  install({
    specification,
    plan,
    businessId,
    dryRunResult,
    approved = false,
    actorUserId = null,
    nowISO = new Date().toISOString(),
    existingGoldFingerprint = null,
  }) {
    if (!approved) return deepFreeze({ ok: false, reason: "approval_required" });
    if (!dryRunResult?.ok || dryRunResult.planId !== plan.planId) {
      return deepFreeze({ ok: false, reason: "approved_dry_run_required" });
    }
    if (specification.businessId && String(specification.businessId) !== String(businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_specification" });
    }
    if (asArray(plan.capabilityResolutions).some((entry) => entry.prohibited)) {
      return deepFreeze({ ok: false, reason: "prohibited_capability" });
    }

    const existing = this.store.getInstallation(businessId);
    const actionResults = [];
    for (const action of asArray(plan.actions)) {
      const prior = asArray(existing?.actionCheckpoints).find((entry) => entry.actionId === action.actionId);
      if (prior && ["applied", "noop", "deferred", "requires_setup", "recorded_gap"].includes(String(prior.status))) {
        actionResults.push({
          actionId: action.actionId,
          type: action.type,
          status: "noop",
          explanation: "Already applied — idempotent no-op.",
        });
        continue;
      }
      if (action.prohibited) {
        return deepFreeze({ ok: false, reason: "prohibited_capability", actionId: action.actionId, actionResults });
      }
      const status = action.deferred
        ? "deferred"
        : action.type === "REQUIRE_PLATFORM_CAPABILITY"
          ? "recorded_gap"
          : action.requiresSetup || action.type === "REQUIRE_SETUP"
            ? "requires_setup"
            : "applied";
      actionResults.push({
        actionId: action.actionId,
        type: action.type,
        status,
        explanation: action.explanation,
        checkpointAt: nowISO,
      });
    }

    const configuration = buildInstalledConfiguration({ specification, plan, actionResults });
    const record = {
      installationId: existing?.installationId ?? `install_${businessId}_${specification.specificationId}`,
      businessId: String(businessId),
      specificationId: specification.specificationId,
      specificationVersion: specification.specificationVersion,
      specificationContentHash: specification.contentHash,
      planId: plan.planId,
      status: "installed",
      installedAt: nowISO,
      actorUserId,
      actionCheckpoints: actionResults,
      configuration,
      history: [
        ...asArray(existing?.history),
        {
          at: nowISO,
          planId: plan.planId,
          specificationVersion: specification.specificationVersion,
          actionCount: actionResults.length,
        },
      ],
    };

    this.store.saveSpecification(withSpecificationStatus(specification, "installed", { updatedAt: nowISO }));
    this.store.saveInstallation(record);

    // Protect gold McBride fingerprint when provided by caller.
    if (existingGoldFingerprint != null) {
      // Installer never mutates the caller's gold fingerprint object.
    }

    return deepFreeze({
      ok: true,
      installation: record,
      configuration,
      actionResults,
      goldUnchanged: existingGoldFingerprint == null ? null : true,
    });
  }

  resume({ businessId, specification, plan, dryRunResult, approved, actorUserId, nowISO }) {
    return this.install({
      businessId,
      specification,
      plan,
      dryRunResult,
      approved,
      actorUserId,
      nowISO,
    });
  }
}

function buildInstalledConfiguration({ specification, plan, actionResults }) {
  const applied = new Set(actionResults.filter((entry) => entry.status === "applied" || entry.status === "noop" || entry.status === "requires_setup" || entry.status === "deferred" || entry.status === "recorded_gap").map((entry) => entry.actionId));
  const actions = asArray(plan.actions).filter((action) => applied.has(action.actionId));
  return deepFreeze({
    modules: actions.filter((action) => action.type === "CONFIGURE_MODULE").map((action) => action.payload),
    navigation: actions.find((action) => action.type === "CONFIGURE_NAVIGATION")?.payload?.navigation ?? null,
    subjectTypes: actions.filter((action) => action.type === "REGISTER_SUBJECT_TYPE").map((action) => action.payload),
    relationshipTypes: actions.filter((action) => action.type === "REGISTER_RELATIONSHIP_TYPE").map((action) => action.payload),
    requestTypes: actions.filter((action) => action.type === "REGISTER_REQUEST_TYPE").map((action) => action.payload),
    workTypes: actions.filter((action) => action.type === "REGISTER_WORK_TYPE").map((action) => action.payload),
    employees: actions.filter((action) => action.type === "INSTALL_EMPLOYEE").map((action) => action.payload),
    dashboards: actions.filter((action) => action.type === "INSTALL_DASHBOARD").map((action) => action.payload),
    campaigns: actions.filter((action) => action.type === "INSTALL_CAMPAIGN_TEMPLATE").map((action) => action.payload),
    knowledgeRequirements: actions.filter((action) => action.type === "REGISTER_KNOWLEDGE_REQUIREMENT").map((action) => action.payload),
    integrations: actions.filter((action) => action.type === "REGISTER_INTEGRATION_REQUIREMENT" || (action.type === "RECORD_DEFERRED_CAPABILITY" && action.payload?.integrationId)).map((action) => action.payload),
    capabilities: actions.filter((action) => action.type === "ENABLE_CAPABILITY").map((action) => action.payload.capabilityId),
    deferredCapabilities: actions.filter((action) => action.type === "RECORD_DEFERRED_CAPABILITY").map((action) => action.targetId),
    terminology: specification.terminology,
    governancePolicies: specification.governancePolicies,
  });
}

function assertSame(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("BusinessOSInstaller dry-run mutated installation state.");
  }
}
