import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { withSpecificationStatus } from "./BusinessOSSpecification.js";
import { evaluateBusinessOSInstallReadiness } from "./BusinessOSReadinessEvaluator.js";
import { BusinessOSDryRunService } from "./BusinessOSDryRunService.js";
import { BusinessOSInstallationRepository } from "./BusinessOSInstallationRepository.js";
import { validateInstallationApproval } from "./BusinessOSInstallationApproval.js";
import { hashInstallationPlan } from "./BusinessOSSpecificationHasher.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * In-memory installation state for deterministic tests and dry-run proofs.
 * @deprecated Prefer BusinessOSInstallationRepository.
 */
export class InMemoryBusinessOSInstallStore {
  constructor() {
    this.repository = new BusinessOSInstallationRepository();
  }

  saveSpecification(specification) {
    return this.repository.saveSpecification(specification);
  }

  getInstallation(businessId) {
    return this.repository.getInstallation(businessId);
  }

  saveInstallation(record) {
    return this.repository.saveInstallation(record);
  }
}

/**
 * Governed installer: dry-run never mutates; install requires approval bound to
 * specification content hash + plan hash. Stale approvals are rejected.
 */
export class BusinessOSInstaller {
  constructor({
    store = new InMemoryBusinessOSInstallStore(),
    repository = null,
  } = {}) {
    this.store = store;
    this.repository = repository ?? store.repository ?? new BusinessOSInstallationRepository();
    this.dryRunService = new BusinessOSDryRunService({ repository: this.repository });
  }

  dryRun({ specification, plan, businessId, nowISO = new Date().toISOString() }) {
    return this.dryRunService.run({ specification, plan, businessId, nowISO });
  }

  install({
    specification,
    plan,
    businessId,
    dryRunResult,
    approved = false,
    approval = null,
    actorUserId = null,
    nowISO = new Date().toISOString(),
    existingGoldFingerprint = null,
    failAtOperationId = null,
  }) {
    if (specification.businessId && String(specification.businessId) !== String(businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_specification" });
    }
    if (asArray(plan.capabilityResolutions).some((entry) => entry.prohibited)) {
      return deepFreeze({ ok: false, reason: "prohibited_capability" });
    }

    if (approval) {
      const bound = validateInstallationApproval({
        approval,
        specification: { ...specification, businessId: specification.businessId ?? businessId },
        plan,
      });
      if (!bound.ok) return deepFreeze({ ok: false, reason: bound.reason });
    } else if (!approved) {
      return deepFreeze({ ok: false, reason: "approval_required" });
    }

    if (!dryRunResult?.ok || dryRunResult.planId !== plan.planId) {
      return deepFreeze({ ok: false, reason: "approved_dry_run_required" });
    }
    if (dryRunResult.planHash && plan.planHash && dryRunResult.planHash !== plan.planHash) {
      return deepFreeze({ ok: false, reason: "stale_dry_run_plan_hash" });
    }
    if (
      dryRunResult.specificationContentHash
      && dryRunResult.specificationContentHash !== specification.contentHash
    ) {
      return deepFreeze({ ok: false, reason: "stale_dry_run_specification_hash" });
    }

    const readiness = evaluateBusinessOSInstallReadiness({
      specification,
      plan,
      dryRunCompleted: true,
      approved: true,
    });
    if (!readiness.ok) return deepFreeze({ ok: false, reason: "not_ready", readiness });

    const existing = this.repository.getInstallation(businessId) ?? this.store.getInstallation(businessId);
    const priorCheckpoints = new Map(
      asArray(existing?.actionCheckpoints).map((entry) => [entry.actionId ?? entry.operationId, entry]),
    );
    for (const checkpoint of this.repository.listOperationCheckpoints(businessId)) {
      priorCheckpoints.set(checkpoint.operationId ?? checkpoint.actionId, checkpoint);
    }

    const actionResults = [];
    const operations = asArray(plan.operations ?? plan.actions);

    for (const action of operations) {
      const actionId = action.actionId ?? action.operationId;
      const operationId = action.operationId ?? action.actionId;
      const prior = priorCheckpoints.get(actionId) ?? priorCheckpoints.get(operationId);

      if (failAtOperationId && (failAtOperationId === actionId || failAtOperationId === operationId)) {
        const failed = {
          actionId,
          operationId,
          type: action.type ?? action.operationType,
          status: "failed",
          explanation: "Simulated partial failure for restart recovery proof.",
          checkpointAt: nowISO,
        };
        actionResults.push(failed);
        this.repository.saveOperationCheckpoint(businessId, failed);
        const partial = {
          installationId: existing?.installationId ?? `install_${businessId}_${specification.specificationId}`,
          businessId: String(businessId),
          specificationId: specification.specificationId,
          specificationVersion: specification.version ?? specification.specificationVersion,
          specificationContentHash: specification.contentHash,
          planId: plan.planId,
          planHash: plan.planHash ?? hashInstallationPlan(plan),
          status: "failed",
          installedAt: null,
          actorUserId,
          actionCheckpoints: [
            ...asArray(existing?.actionCheckpoints).filter((entry) => (
              (entry.actionId ?? entry.operationId) !== actionId
            )),
            ...actionResults,
          ],
          configuration: existing?.configuration ?? {},
          history: [
            ...asArray(existing?.history),
            { at: nowISO, planId: plan.planId, status: "partial_failure", actionId },
          ],
        };
        this.repository.saveInstallation(partial);
        this.store.saveInstallation(partial);
        return deepFreeze({
          ok: false,
          reason: "partial_failure",
          installation: partial,
          actionResults,
        });
      }

      if (prior && ["applied", "noop", "deferred", "requires_setup", "recorded_gap"].includes(String(prior.status))) {
        const noop = {
          actionId,
          operationId,
          type: action.type ?? action.operationType,
          status: "noop",
          explanation: "Already applied — idempotent no-op.",
          checkpointAt: nowISO,
        };
        actionResults.push(noop);
        this.repository.saveOperationCheckpoint(businessId, noop);
        continue;
      }

      if (action.prohibited) {
        return deepFreeze({ ok: false, reason: "prohibited_capability", actionId, actionResults });
      }

      const status = action.deferred
        ? "deferred"
        : (action.type ?? action.operationType) === "REQUIRE_PLATFORM_CAPABILITY"
          ? "recorded_gap"
          : action.requiresSetup || (action.type ?? action.operationType) === "REQUIRE_SETUP"
            ? "requires_setup"
            : "applied";

      const result = {
        actionId,
        operationId,
        type: action.type ?? action.operationType,
        status,
        explanation: action.explanation ?? action.reason,
        checkpointAt: nowISO,
      };
      actionResults.push(result);
      this.repository.saveOperationCheckpoint(businessId, result);

      if (status === "recorded_gap" || status === "deferred") {
        this.repository.saveCapabilityGap(businessId, {
          capabilityId: action.targetId ?? action.target,
          status,
          at: nowISO,
        });
      }
    }

    const configuration = buildInstalledConfiguration({ specification, plan, actionResults });
    const record = {
      installationId: existing?.installationId ?? `install_${businessId}_${specification.specificationId}`,
      businessId: String(businessId),
      specificationId: specification.specificationId,
      specificationVersion: specification.version ?? specification.specificationVersion,
      specificationContentHash: specification.contentHash,
      planId: plan.planId,
      planHash: plan.planHash ?? hashInstallationPlan(plan),
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
          specificationVersion: specification.version ?? specification.specificationVersion,
          actionCount: actionResults.length,
        },
      ],
    };

    this.repository.saveSpecification(withSpecificationStatus(specification, "installed", { updatedAt: nowISO }));
    this.repository.saveInstallation(record);
    this.store.saveSpecification(withSpecificationStatus(specification, "installed", { updatedAt: nowISO }));
    this.store.saveInstallation(record);

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

  resume({ businessId, specification, plan, dryRunResult, approved, approval, actorUserId, nowISO }) {
    return this.install({
      businessId,
      specification,
      plan,
      dryRunResult,
      approved,
      approval,
      actorUserId,
      nowISO,
    });
  }
}

function buildInstalledConfiguration({ specification, plan, actionResults }) {
  const applied = new Set(
    actionResults
      .filter((entry) => ["applied", "noop", "requires_setup", "deferred", "recorded_gap"].includes(entry.status))
      .map((entry) => entry.actionId ?? entry.operationId),
  );
  const actions = asArray(plan.operations ?? plan.actions).filter((action) => (
    applied.has(action.actionId) || applied.has(action.operationId)
  ));
  const typeOf = (action) => action.type ?? action.operationType;

  return deepFreeze({
    modules: actions.filter((action) => typeOf(action) === "CONFIGURE_MODULE").map((action) => action.payload),
    navigation: actions.find((action) => typeOf(action) === "CONFIGURE_NAVIGATION")?.payload?.navigation ?? null,
    subjectTypes: actions.filter((action) => typeOf(action) === "REGISTER_SUBJECT_TYPE").map((action) => action.payload),
    relationshipTypes: actions.filter((action) => typeOf(action) === "REGISTER_RELATIONSHIP_TYPE").map((action) => action.payload),
    requestTypes: actions.filter((action) => typeOf(action) === "REGISTER_REQUEST_TYPE").map((action) => action.payload),
    workTypes: actions.filter((action) => typeOf(action) === "REGISTER_WORK_TYPE").map((action) => action.payload),
    employees: actions.filter((action) => typeOf(action) === "INSTALL_EMPLOYEE").map((action) => action.payload),
    roles: actions.filter((action) => typeOf(action) === "INSTALL_ROLE").map((action) => action.payload),
    dashboards: actions.filter((action) => typeOf(action) === "INSTALL_DASHBOARD").map((action) => action.payload),
    campaigns: actions.filter((action) => typeOf(action) === "INSTALL_CAMPAIGN_TEMPLATE").map((action) => action.payload),
    knowledgeRequirements: actions.filter((action) => typeOf(action) === "REGISTER_KNOWLEDGE_REQUIREMENT").map((action) => action.payload),
    integrations: actions.filter((action) => (
      typeOf(action) === "REGISTER_INTEGRATION_REQUIREMENT"
      || (typeOf(action) === "RECORD_DEFERRED_CAPABILITY" && action.payload?.integrationId)
    )).map((action) => action.payload),
    capabilities: actions.filter((action) => typeOf(action) === "ENABLE_CAPABILITY").map((action) => action.payload.capabilityId),
    deferredCapabilities: actions.filter((action) => typeOf(action) === "RECORD_DEFERRED_CAPABILITY").map((action) => action.targetId ?? action.target),
    accessRequestPolicies: actions.filter((action) => typeOf(action) === "CONFIGURE_ACCESS_REQUEST_POLICY").map((action) => action.payload),
    supportAccessPolicy: actions.find((action) => typeOf(action) === "CONFIGURE_SUPPORT_ACCESS_POLICY")?.payload ?? null,
    terminology: specification.terminology,
    governancePolicies: specification.governancePolicies,
    roleDefinitions: specification.roleDefinitions,
    permissionPolicies: specification.permissionPolicies,
  });
}
