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

function restartService(repository, installationRepository = new BusinessOSInstallationRepository()) {
  return new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    nowISO: NOW,
  });
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
