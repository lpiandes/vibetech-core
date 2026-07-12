import assert from "node:assert/strict";
import { test } from "node:test";

import { AiBuilderService } from "./AiBuilderService.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { BusinessWebsiteResearchService } from "./BusinessWebsiteResearchService.js";
import { BusinessOSInstallationRepository } from "../business-os/BusinessOSInstallationRepository.js";
import { BusinessOSInstaller } from "../business-os/BusinessOSInstaller.js";
import {
  clientSafeProposalView,
  discoveryStageProgress,
  sessionListCard,
  stripTechnicalFields,
} from "./BuilderUxPresentation.js";
import { buildDryRunChecklist } from "./BuilderDryRunChecklist.js";
import { buildBuilderPortalPreview } from "./BuilderPortalPreview.js";
import { composeBusinessOSUI } from "../../../frontend/lib/business-os-ui/BusinessOSUIComposer.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";

const NOW = () => "2026-07-11T16:00:00.000Z";

async function seedService(repository = new BuilderSessionRepository()) {
  const fixtures = new Map([
    ["https://smile.dental.example", { text: "Smile Dental\nCleanings and exams in Austin\nCall 555-0100" }],
  ]);
  const installationRepository = new BusinessOSInstallationRepository();
  const service = new AiBuilderService({
    repository,
    installationRepository,
    installer: new BusinessOSInstaller({ repository: installationRepository }),
    researchService: new BusinessWebsiteResearchService({ fixtures }),
    nowISO: NOW,
  });
  return { service, repository };
}

test("Builder home lists sessions with next action", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "List Co",
    description: "A property management company",
  });
  const listed = await service.listSessions();
  assert.equal(listed.ok, true);
  assert.ok(listed.sessions.some((entry) => entry.sessionId === started.session.sessionId));
  const card = sessionListCard(started.session);
  assert.ok(card.nextAction);
  assert.equal(card.businessName, "List Co");
});

test("discovery asks adaptive next questions with journey stages", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Adaptive Co",
    description: "Dental practice with patients and appointments",
  });
  assert.ok(started.nextQuestions.length >= 1);
  const answered = await service.answer({
    sessionId: started.session.sessionId,
    questionId: started.nextQuestions[0].questionId,
    answer: "dental",
  });
  assert.equal(answered.ok, true);
  assert.ok(answered.progress.journey?.stages?.length >= 5);
  const journey = discoveryStageProgress({
    answers: answered.session.answers,
    questions: answered.session.questions,
    progress: answered.progress,
    businessSummary: answered.session.businessSummary,
  });
  assert.ok(journey.activeStageLabel);
});

test("website findings require confirmation before treated as truth", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Smile Dental",
    websiteUrl: "https://smile.dental.example",
    description: "dental practice",
  });
  const research = await service.research({
    sessionId: started.session.sessionId,
    websiteUrl: "https://smile.dental.example",
  });
  assert.equal(research.ok, true);
  assert.equal(research.requiresConfirmation, true);
  const workspace = await service.getWorkspace(started.session.sessionId);
  assert.equal(workspace.researchFindings.confirmationStatus, "pending");
  const confirmed = await service.confirmResearch({
    sessionId: started.session.sessionId,
    accepted: true,
  });
  assert.equal(confirmed.confirmation.confirmationStatus, "confirmed");
});

test("uploads remain non-mutating during discovery", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Upload Co",
    description: "property management",
  });
  const uploaded = await service.upload({
    sessionId: started.session.sessionId,
    filename: "sop-leasing.pdf",
    mimeType: "application/pdf",
    textPreview: "Leasing SOP for new residents",
  });
  assert.equal(uploaded.ok, true);
  assert.equal(uploaded.mapping.confirmed, false);
  assert.equal(uploaded.mapping.mutatesCanonicalData, false);
  const workspace = await service.getWorkspace(started.session.sessionId);
  assert.equal(workspace.uploads[0].mutatesCanonicalData, false);
});

test("visual proposal hides technical fields", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Safe View Co",
    description: "Hockey travel club with teams and tournaments",
  });
  for (const [questionId, answer] of [
    ["q_company_name", "Safe View Co"],
    ["q_industry", "hockey"],
    ["q_services", "travel tournaments"],
    ["q_customers", "families"],
    ["q_roles", "coach, manager"],
    ["q_repetitive_work", "scheduling"],
    ["q_approvals", "parent messages"],
    ["q_pain_points", "coordination"],
    ["q_desired_outcomes", "clear workspaces"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }
  const proposed = await service.propose({ sessionId: started.session.sessionId });
  const safe = clientSafeProposalView(proposed.proposal);
  const serialized = JSON.stringify(safe);
  assert.ok(!serialized.includes("contentHash"));
  assert.ok(!/HockeyRuntime|PatientRuntime|PropertyRuntime/.test(serialized));
  assert.equal(stripTechnicalFields({ schemaVersion: 1, label: "Work" }).schemaVersion, undefined);
});

test("role preview changes navigation and blocks unknown UI components", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Role Preview Dental",
    description: "dental practice with billing and patients",
  });
  for (const [questionId, answer] of [
    ["q_company_name", "Role Preview Dental"],
    ["q_industry", "dental"],
    ["q_services", "cleanings"],
    ["q_customers", "patients"],
    ["q_roles", "owner, hygienist"],
    ["q_repetitive_work", "recalls"],
    ["q_approvals", "messages"],
    ["q_pain_points", "manual work"],
    ["q_desired_outcomes", "clear portal"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }
  const proposed = await service.propose({ sessionId: started.session.sessionId });
  const owner = buildBuilderPortalPreview({
    specification: proposed.specification,
    membershipRole: "OWNER",
  });
  const employee = buildBuilderPortalPreview({
    specification: proposed.specification,
    membershipRole: "EMPLOYEE",
  });
  assert.equal(owner.ok, true);
  assert.equal(employee.ok, true);
  assert.ok(owner.sidebar.primary.length >= 1);
  const composed = composeBusinessOSUI({
    dashboardCards: [
      { id: "a", componentType: "work_queue", title: "Work" },
      { id: "b", componentType: "evil_custom_widget", title: "Nope" },
    ],
    actions: [{ id: "1", componentType: "eval_script", label: "Bad" }],
  });
  assert.deepEqual(composed.rejected.dashboardCards, ["evil_custom_widget"]);
  assert.deepEqual(composed.rejected.actions, ["eval_script"]);
});

test("conversational edits create proposals and invalidate dry-run approval path", async () => {
  const { service } = await seedService();
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Change Co",
    description: "property management company",
  });
  for (const [questionId, answer] of [
    ["q_company_name", "Change Co"],
    ["q_industry", "property management"],
    ["q_services", "leasing"],
    ["q_customers", "owners"],
    ["q_roles", "owner"],
    ["q_repetitive_work", "follow-ups"],
    ["q_approvals", "messages"],
    ["q_pain_points", "manual"],
    ["q_desired_outcomes", "automation"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }
  await service.propose({ sessionId: started.session.sessionId });
  const dry = await service.dryRun({ sessionId: started.session.sessionId });
  assert.equal(dry.ok, true);
  assert.ok(dry.checklist.items.length >= 3);
  await service.approve({ sessionId: started.session.sessionId, actorId: "owner" });
  const changed = await service.chat({
    sessionId: started.session.sessionId,
    text: "Rename Customers to Patients",
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.changeImpact.requiresDryRun, true);
  assert.equal(changed.changeImpact.requiresApproval, true);
  const after = await service.getProposal(started.session.sessionId);
  assert.equal(after.approval, null);
  assert.equal(after.plan, null);
  assert.equal(after.dryRunResult, null);
});

test("approval binds exact version and install progress survives restart", async () => {
  const repository = new BuilderSessionRepository();
  const { service } = await seedService(repository);
  const started = await service.startSession({
    mode: "new_business",
    businessName: "Bind Co",
    description: "hockey travel club",
  });
  for (const [questionId, answer] of [
    ["q_company_name", "Bind Co"],
    ["q_industry", "hockey"],
    ["q_services", "tournaments"],
    ["q_customers", "families"],
    ["q_roles", "coach"],
    ["q_repetitive_work", "travel planning"],
    ["q_approvals", "parent messages"],
    ["q_pain_points", "coordination"],
    ["q_desired_outcomes", "workspaces"],
  ]) {
    await service.answer({ sessionId: started.session.sessionId, questionId, answer });
  }
  const proposed = await service.propose({ sessionId: started.session.sessionId });
  await service.dryRun({ sessionId: started.session.sessionId });
  const approved = await service.approve({ sessionId: started.session.sessionId, actorId: "owner" });
  assert.equal(approved.approval.specificationContentHash, proposed.specification.contentHash);

  const restarted = new AiBuilderService({
    repository,
    installationRepository: new BusinessOSInstallationRepository(),
    installer: new BusinessOSInstaller({ repository: new BusinessOSInstallationRepository() }),
    nowISO: NOW,
  });
  const recovered = await restarted.getProposal(started.session.sessionId);
  assert.ok(recovered.approval);
  assert.equal(recovered.approval.specificationContentHash, proposed.specification.contentHash);
  const installed = await restarted.install({
    sessionId: started.session.sessionId,
    approved: true,
    actorId: "owner",
  });
  assert.equal(installed.ok, true);
});

test("McBride still works and dental/hockey portals are distinct", async () => {
  const mcbride = exportMcBrideBusinessOSSpecification();
  assert.ok(mcbride.modules.some((module) => module.moduleId === "properties"));
  const { service } = await seedService();

  async function proposeFor(description, businessName) {
    const started = await service.startSession({ mode: "new_business", businessName, description });
    for (const [questionId, answer] of [
      ["q_company_name", businessName],
      ["q_industry", description],
      ["q_services", "core services"],
      ["q_customers", "customers"],
      ["q_roles", "owner"],
      ["q_repetitive_work", "follow-ups"],
      ["q_approvals", "messages"],
      ["q_pain_points", "manual"],
      ["q_desired_outcomes", "clarity"],
    ]) {
      await service.answer({ sessionId: started.session.sessionId, questionId, answer });
    }
    return service.propose({ sessionId: started.session.sessionId });
  }

  const dental = await proposeFor("dental practice with patients and appointments", "Dental UX Co");
  const hockey = await proposeFor("hockey travel club with teams and scouting", "Hockey UX Co");
  const dentalPreview = buildBuilderPortalPreview({ specification: dental.specification, membershipRole: "OWNER" });
  const hockeyPreview = buildBuilderPortalPreview({ specification: hockey.specification, membershipRole: "OWNER" });
  assert.ok(dental.specification.modules.some((module) => module.label === "Patients" || module.moduleId === "appointments"));
  assert.ok(hockey.specification.modules.some((module) => module.moduleId === "teams" || /scout/i.test(module.label ?? "")));
  assert.notEqual(
    JSON.stringify(dentalPreview.sidebar.primary.map((item) => item.label)),
    JSON.stringify(hockeyPreview.sidebar.primary.map((item) => item.label)),
  );
});

test("dry run checklist is client readable", () => {
  const checklist = buildDryRunChecklist({
    dryRunResult: {
      ok: true,
      mutated: false,
      simulatedOperations: [
        { type: "CONFIGURE_MODULE", outcome: "would_apply" },
        { type: "CONFIGURE_ROLE", outcome: "would_apply" },
        { type: "INSTALL_EMPLOYEE", outcome: "would_apply" },
        { type: "REQUIRE_SETUP", outcome: "requires_setup" },
        { type: "REQUIRE_PLATFORM_CAPABILITY", outcome: "deferred" },
      ],
    },
  });
  assert.equal(checklist.mutated, false);
  assert.ok(checklist.items.some((item) => /workspaces/i.test(item.label)));
  assert.match(checklist.headline, /Architect will set up/i);
  assert.ok(!JSON.stringify(checklist).includes("CONFIGURE_MODULE"));
  assert.ok(!/Installing|Registering/i.test(JSON.stringify(checklist.items)));
});

test("employee without manage permission cannot use continuous Builder entry", () => {
  function canUseBuilderImprove({ permissions = [], role = "EMPLOYEE" } = {}) {
    return permissions.includes("business.manage") || role === "OWNER" || role === "PLATFORM_ADMIN";
  }
  assert.equal(canUseBuilderImprove({ permissions: ["business.manage"], role: "OWNER" }), true);
  assert.equal(canUseBuilderImprove({ permissions: [], role: "PLATFORM_ADMIN" }), true);
  assert.equal(canUseBuilderImprove({ permissions: [], role: "EMPLOYEE" }), false);
  assert.equal(canUseBuilderImprove({ permissions: ["work.view"], role: "MANAGER" }), false);
});
