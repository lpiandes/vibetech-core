import assert from "node:assert/strict";
import { test } from "node:test";

import { AiBuilderService } from "./AiBuilderService.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { ContinuousBusinessBuilderService } from "./ContinuousBusinessBuilderService.js";
import { BusinessOSInstallationRepository } from "../business-os/BusinessOSInstallationRepository.js";
import { BusinessOSInstaller } from "../business-os/BusinessOSInstaller.js";
import { buildVisualBusinessOSProposal } from "./VisualBusinessOSProposal.js";

const NOW = () => "2026-07-11T15:00:00.000Z";

async function prepareReadySession(repository, installationRepository) {
  const service = new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    nowISO: NOW,
  });

  const started = await service.startSession({
    mode: "new_business",
    businessId: "biz_durability_1",
    businessName: "Durability Dental",
    description: "A dental practice with patients, appointments, and treatment plans.",
  });

  for (const [questionId, answer] of [
    ["q_company_name", "Durability Dental"],
    ["q_industry", "dental practice"],
    ["q_services", "cleanings, exams"],
    ["q_customers", "patients"],
    ["q_roles", "owner, hygienist"],
    ["q_repetitive_work", "reminders"],
    ["q_approvals", "patient messages"],
    ["q_pain_points", "manual scheduling"],
    ["q_desired_outcomes", "clear patient workspaces"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }

  return { service, sessionId: started.session.sessionId };
}

function restartService(repository, installationRepository = new BusinessOSInstallationRepository(), platformStore = null) {
  return new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    platformStore,
    nowISO: NOW,
  });
}

/**
 * Builds a fully installable session (specification + plan + dry-run + approval) without
 * going through the discovery-completeness gate — these install()-recovery tests only care
 * about what happens after approval, not discovery readiness rules.
 */
async function prepareInstallableSession({
  repository,
  installationRepository,
  platformStore = null,
  businessId,
  businessName,
  description,
}) {
  const service = new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    platformStore,
    nowISO: NOW,
  });

  const started = await service.startSession({
    mode: "new_business",
    businessId,
    businessName,
    description,
  });
  const sessionId = started.session.sessionId;
  for (const [questionId, answer] of [
    ["q_company_name", businessName],
    ["q_industry", "general services"],
    ["q_services", "consulting"],
    ["q_customers", "clients"],
    ["q_roles", "owner"],
  ]) {
    await service.answer({ sessionId, questionId, answer });
  }

  const session = await service.requireSession(sessionId);
  const assemblyPlan = service.assemblyPlanner.plan({ session });
  const assembled = service.assembler.assemble({ session, assemblyPlan, nowISO: service.nowISO() });
  assert.equal(assembled.ok, true, "test fixture: assembler must produce a specification");
  await service.seedProposalState({ sessionId, specification: assembled.specification, assemblyPlan });

  const dry = await service.dryRun({ sessionId });
  assert.equal(dry.ok, true, "test fixture: dry run must succeed");

  const approved = await service.approve({ sessionId, actorId: "owner_test" });
  assert.equal(approved.ok, true, "test fixture: approval must succeed");

  return { service, sessionId };
}

test("Builder proposal survives process restart", async () => {
  const repository = new BuilderSessionRepository();
  const { service, sessionId } = await prepareReadySession(repository, new BusinessOSInstallationRepository());
  const proposed = await service.propose({ sessionId });
  assert.equal(proposed.ok, true);

  const restarted = restartService(repository);
  assert.equal(restarted.proposals.size, 0);

  const recovered = await restarted.getProposal(sessionId);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.specification.contentHash, proposed.specification.contentHash);
  assert.equal(recovered.session.specificationContentHash, proposed.specification.contentHash);
});

test("Builder visual preview can be rederived after restart", async () => {
  const repository = new BuilderSessionRepository();
  const { service, sessionId } = await prepareReadySession(repository, new BusinessOSInstallationRepository());
  const proposed = await service.propose({ sessionId });

  const restarted = restartService(repository);
  const recovered = await restarted.getProposal(sessionId);
  const rebuilt = buildVisualBusinessOSProposal({
    session: recovered.session,
    specification: recovered.specification,
    assemblyPlan: recovered.assemblyPlan,
  });

  assert.ok(recovered.proposal.views.navigation);
  assert.ok(rebuilt.views.digitalWorkforce);
  assert.equal(recovered.proposal.businessName, rebuilt.businessName);
  assert.deepEqual(
    recovered.proposal.views.navigation.items?.map((item) => item.label)
      ?? recovered.proposal.views.navigation,
    rebuilt.views.navigation.items?.map((item) => item.label)
      ?? rebuilt.views.navigation,
  );
});

test("installation plan and dry-run survive restart", async () => {
  const repository = new BuilderSessionRepository();
  const { service, sessionId } = await prepareReadySession(repository, new BusinessOSInstallationRepository());
  await service.propose({ sessionId });
  const dry = await service.dryRun({ sessionId });
  assert.equal(dry.ok, true);
  assert.ok(dry.plan.planHash);

  const restarted = restartService(repository);
  const recovered = await restarted.getProposal(sessionId);
  assert.equal(recovered.plan.planHash, dry.plan.planHash);
  assert.equal(recovered.dryRunResult.planHash, dry.dryRunResult.planHash);
  assert.equal(recovered.dryRunResult.mutated, false);
  assert.equal(recovered.session.installationPlanHash, dry.plan.planHash);
});

test("approval binding survives restart and remains hash-bound", async () => {
  const repository = new BuilderSessionRepository();
  const { service, sessionId } = await prepareReadySession(repository, new BusinessOSInstallationRepository());
  await service.propose({ sessionId });
  await service.dryRun({ sessionId });
  const approved = await service.approve({ sessionId, actorId: "owner_durability" });
  assert.equal(approved.ok, true);

  const restarted = restartService(repository);
  const recovered = await restarted.getProposal(sessionId);
  assert.ok(recovered.approval);
  assert.equal(recovered.approval.specificationContentHash, recovered.specification.contentHash);
  assert.equal(recovered.approval.planHash, recovered.plan.planHash);
  assert.equal(recovered.session.currentStage, "awaiting_approval");
});

test("installation can resume safely after restart mid-failure", async () => {
  const repository = new BuilderSessionRepository();
  const sharedInstallRepo = new BusinessOSInstallationRepository();
  const { service, sessionId } = await prepareReadySession(repository, sharedInstallRepo);
  await service.propose({ sessionId });
  await service.dryRun({ sessionId });
  await service.approve({ sessionId, actorId: "owner_durability" });

  const recoveredBefore = await service.getProposal(sessionId);
  const ops = recoveredBefore.plan.operations ?? recoveredBefore.plan.actions ?? [];
  const failAt = ops[1]?.operationId
    ?? ops[1]?.actionId
    ?? ops[0]?.operationId
    ?? ops[0]?.actionId;

  const failed = await service.install({
    sessionId,
    approved: true,
    actorId: "owner_durability",
    failAtOperationId: failAt,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.installation.reason, "partial_failure");

  // Fresh installer repository (process restart) — hydrate from durable session.
  const restarted = restartService(repository, new BusinessOSInstallationRepository());
  const resumed = await restarted.resumeInstall({ sessionId, actorId: "owner_durability" });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.session.currentStage, "installed");
  assert.ok(
    (resumed.installation.actionResults ?? []).some((entry) => entry.status === "noop")
      || (resumed.installation.actionResults ?? []).length >= 1,
  );
});

test("post-install improvement session survives restart", async () => {
  const repository = new BuilderSessionRepository();
  const installationRepository = new BusinessOSInstallationRepository();
  const service = new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    nowISO: NOW,
  });

  const started = await service.startSession({
    mode: "new_business",
    businessId: "biz_durability_improve",
    businessName: "Improve Co",
    description: "Property management company",
  });
  for (const [questionId, answer] of [
    ["q_company_name", "Improve Co"],
    ["q_industry", "property management"],
    ["q_services", "leasing"],
    ["q_customers", "owners"],
    ["q_roles", "owner"],
    ["q_repetitive_work", "follow-ups"],
    ["q_approvals", "messages"],
    ["q_pain_points", "manual work"],
    ["q_desired_outcomes", "automation"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }
  const proposed = await service.propose({ sessionId: started.session.sessionId });
  await service.dryRun({ sessionId: started.session.sessionId });
  const installed = await service.install({
    sessionId: started.session.sessionId,
    approved: true,
    actorId: "owner_1",
  });
  assert.equal(installed.ok, true);

  const continuous = new ContinuousBusinessBuilderService({ aiBuilder: service });
  const improve = await continuous.startImprovement({
    businessId: "biz_durability_improve",
    actorId: "owner_1",
    installedSpecification: proposed.specification,
    prompt: "Add a weekly newsletter",
  });
  assert.equal(improve.ok, true);
  assert.equal(improve.session.metadata.continuousImprovement, true);

  const restarted = restartService(repository);
  const recovered = await restarted.getProposal(improve.session.sessionId);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.specification.specificationId, proposed.specification.specificationId);
  assert.equal(recovered.session.metadata.continuousImprovement, true);

  const changed = await restarted.chat({
    sessionId: improve.session.sessionId,
    text: "Add a weekly newsletter",
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.changeImpact.requiresDryRun, true);
});

test("successful install upserts canonical Business OS rows when platformStore is present", async () => {
  const repository = new BuilderSessionRepository();
  const installationRepository = new BusinessOSInstallationRepository();
  /** @type {any[]} */
  const specs = [];
  /** @type {any[]} */
  const installs = [];
  /** @type {any[]} */
  const audits = [];
  const platformStore = {
    async createBusiness({ id, name }) {
      return { id: id ?? "biz_canonical_os", name };
    },
    async getBusinessById(id) {
      return id ? { id, name: "Canonical Co" } : null;
    },
    async upsertBusinessOSSpecification(row) {
      specs.push(row);
      return { ...row, id: row.id };
    },
    async upsertBusinessOSInstallation(row) {
      installs.push(row);
      return { ...row, id: row.id };
    },
    async recordAuditEvent(event) {
      audits.push(event);
      return event;
    },
  };

  const service = new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    platformStore,
    nowISO: NOW,
  });

  const started = await service.startSession({
    mode: "new_business",
    businessId: "biz_canonical_os",
    businessName: "Canonical Co",
    description: "Dental practice needing patient workspaces.",
  });
  for (const [questionId, answer] of [
    ["q_company_name", "Canonical Co"],
    ["q_industry", "dental"],
    ["q_services", "exams"],
    ["q_customers", "patients"],
    ["q_roles", "owner"],
    ["q_repetitive_work", "reminders"],
    ["q_approvals", "messages"],
    ["q_pain_points", "manual work"],
    ["q_desired_outcomes", "automation"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }
  await service.propose({ sessionId: started.session.sessionId });
  await service.dryRun({ sessionId: started.session.sessionId });
  const installed = await service.install({
    sessionId: started.session.sessionId,
    approved: true,
    actorId: "owner_canonical",
  });
  assert.equal(installed.ok, true);
  assert.equal(specs.length, 1);
  assert.equal(specs[0].status, "installed");
  assert.equal(specs[0].businessId, "biz_canonical_os");
  assert.equal(installs.length, 1);
  assert.equal(installs[0].status, "installed");
  assert.equal(installs[0].businessId, "biz_canonical_os");
  assert.ok(audits.some((entry) => entry.action === "architect.installed"));
});

// --- Approve/Open regression coverage -------------------------------------------------
// Root cause: install() used to mark the session "installed" before canonical Business OS
// persistence succeeded. If that persist step failed (or threw), the session was already
// durably "installed" with no canonical row — Home then found nothing in
// business_os_installations, fell back to onboarding, and linked to a sessionless
// /architect (losing the owner's answers/plan/approval on refresh). These tests lock in the
// fix: the session is never advanced to "installed" until canonical persistence succeeds,
// answers/plan/approval always survive a failed install, and a retry succeeds without
// re-asking discovery.

test("install failure during canonical persistence keeps session recoverable and retry succeeds", async () => {
  const repository = new BuilderSessionRepository();
  const installationRepository = new BusinessOSInstallationRepository();
  let failCanonicalPersist = true;
  const specs = [];
  const installs = [];
  const platformStore = {
    async createBusiness({ id, name }) {
      return { id: id ?? "biz_canonical_recovery", name };
    },
    async getBusinessById(id) {
      return id ? { id, name: "Recovery Co" } : null;
    },
    async getBusinessOSInstallation() {
      return installs.length ? installs[installs.length - 1] : null;
    },
    async upsertBusinessOSSpecification(row) {
      if (failCanonicalPersist) throw new Error("simulated canonical specification write failure");
      specs.push(row);
      return { ...row, id: row.id };
    },
    async upsertBusinessOSInstallation(row) {
      if (failCanonicalPersist) throw new Error("simulated canonical installation write failure");
      installs.push(row);
      return { ...row, id: row.id };
    },
    async recordAuditEvent() {
      return null;
    },
  };

  const { service, sessionId } = await prepareInstallableSession({
    repository,
    installationRepository,
    platformStore,
    businessId: "biz_canonical_recovery",
    businessName: "Recovery Co",
    description: "A services business that needs recovery testing.",
  });

  const beforeFailure = await service.requireSession(sessionId);
  const answersBefore = beforeFailure.answers;

  const failedInstall = await service.install({
    sessionId,
    approved: true,
    actorId: "owner_recovery",
  });

  assert.equal(failedInstall.ok, false);
  assert.equal(failedInstall.reason, "canonical_persist_failed");
  assert.equal(failedInstall.openHref, null);

  // Session must remain durable and recoverable — never silently lost back to step 1.
  const failedSession = failedInstall.session;
  assert.equal(failedSession.currentStage, "failed");
  assert.deepEqual(failedSession.answers, answersBefore);
  assert.ok(failedSession.metadata.installError);
  assert.equal(failedSession.metadata.installError.reason, "canonical_persist_failed");

  const storedAfterFailure = await service.loadProposalState(failedSession);
  assert.ok(storedAfterFailure.specification, "specification must survive a failed install");
  assert.ok(storedAfterFailure.plan, "plan must survive a failed install");
  assert.ok(storedAfterFailure.approval, "approval must survive a failed install");

  // Retry after the transient failure clears — must succeed without re-running discovery.
  failCanonicalPersist = false;
  const retried = await service.install({
    sessionId,
    approved: true,
    actorId: "owner_recovery",
  });

  assert.equal(retried.ok, true);
  assert.equal(retried.session.currentStage, "installed");
  assert.equal(retried.openHref, "/b/biz_canonical_recovery/home");
  assert.equal(specs.length, 1);
  assert.equal(installs.length, 1);
  assert.equal(retried.session.metadata.installError, null);
});

test("resumeInstall retries a failed install using the durable approval — never requires re-approval", async () => {
  const repository = new BuilderSessionRepository();
  const installationRepository = new BusinessOSInstallationRepository();
  let failCanonicalPersist = true;
  const platformStore = {
    async createBusiness({ id, name }) {
      return { id: id ?? "biz_resume_recovery", name };
    },
    async getBusinessById(id) {
      return id ? { id, name: "Resume Co" } : null;
    },
    async getBusinessOSInstallation() {
      return null;
    },
    async upsertBusinessOSSpecification(row) {
      if (failCanonicalPersist) throw new Error("simulated failure");
      return { ...row, id: row.id };
    },
    async upsertBusinessOSInstallation(row) {
      if (failCanonicalPersist) throw new Error("simulated failure");
      return { ...row, id: row.id };
    },
    async recordAuditEvent() {
      return null;
    },
  };

  const { service, sessionId } = await prepareInstallableSession({
    repository,
    installationRepository,
    platformStore,
    businessId: "biz_resume_recovery",
    businessName: "Resume Co",
    description: "A services business testing resume-safe installs.",
  });

  const failed = await service.install({ sessionId, approved: true, actorId: "owner_resume" });
  assert.equal(failed.ok, false);
  assert.equal(failed.session.currentStage, "failed");

  failCanonicalPersist = false;
  const resumed = await service.resumeInstall({ sessionId, actorId: "owner_resume" });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.session.currentStage, "installed");
  assert.equal(resumed.openHref, "/b/biz_resume_recovery/home");
});

test("install is idempotent once live: reloading /install does not re-run install or lose data", async () => {
  const repository = new BuilderSessionRepository();
  const installationRepository = new BusinessOSInstallationRepository();
  const installs = [];
  const platformStore = {
    async createBusiness({ id, name }) {
      return { id: id ?? "biz_idempotent", name };
    },
    async getBusinessById(id) {
      return id ? { id, name: "Idempotent Co" } : null;
    },
    async getBusinessOSInstallation(businessId) {
      return installs.find((row) => row.businessId === businessId) ?? null;
    },
    async upsertBusinessOSSpecification() {
      return { id: "spec_row" };
    },
    async upsertBusinessOSInstallation(row) {
      installs.push(row);
      return { ...row, id: row.id };
    },
    async recordAuditEvent() {
      return null;
    },
  };

  const { service, sessionId } = await prepareInstallableSession({
    repository,
    installationRepository,
    platformStore,
    businessId: "biz_idempotent",
    businessName: "Idempotent Co",
    description: "A services business testing idempotent installs.",
  });

  const first = await service.install({ sessionId, approved: true, actorId: "owner_idempotent" });
  assert.equal(first.ok, true);

  // Reloading /install (e.g. after refresh) must short-circuit as already-installed —
  // never re-enter "installing" or throw.
  const second = await service.install({ sessionId, approved: true, actorId: "owner_idempotent" });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyInstalled, true);
  assert.equal(second.openHref, "/b/biz_idempotent/home");
  assert.equal(installs.length, 1, "canonical installation must not be duplicated on reload");
});

test("install self-heals when session claims installed but canonical Business OS row is missing", async () => {
  const repository = new BuilderSessionRepository();
  const installationRepository = new BusinessOSInstallationRepository();
  let canonicalRow = null;
  const platformStore = {
    async createBusiness({ id, name }) {
      return { id: id ?? "biz_self_heal", name };
    },
    async getBusinessById(id) {
      return id ? { id, name: "Self Heal Co" } : null;
    },
    async getBusinessOSInstallation() {
      return canonicalRow;
    },
    async upsertBusinessOSSpecification() {
      return { id: "spec_row" };
    },
    async upsertBusinessOSInstallation(row) {
      canonicalRow = row;
      return { ...row, id: row.id };
    },
    async recordAuditEvent() {
      return null;
    },
  };

  const { service, sessionId } = await prepareInstallableSession({
    repository,
    installationRepository,
    platformStore,
    businessId: "biz_self_heal",
    businessName: "Self Heal Co",
    description: "A services business testing self-healing installs.",
  });

  const installedFirst = await service.install({ sessionId, approved: true, actorId: "owner_self_heal" });
  assert.equal(installedFirst.ok, true);

  // Simulate legacy corrupted state: session claims installed, but the canonical row is gone
  // (e.g. an older bug, or the row failed to persist on a prior process before this fix).
  canonicalRow = null;

  const reloaded = await service.install({ sessionId, approved: true, actorId: "owner_self_heal" });
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.alreadyInstalled, true);
  assert.equal(reloaded.canonicalReconciled, true);
  assert.equal(reloaded.openHref, "/b/biz_self_heal/home");
  assert.ok(canonicalRow, "canonical row must be written by the self-heal path");
});
