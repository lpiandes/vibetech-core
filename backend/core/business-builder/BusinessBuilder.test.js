import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessBuilderService } from "./BusinessBuilderService.js";
import { nextDiscoveryQuestions, discoveryProgress } from "./BusinessDiscoveryQuestionEngine.js";
import { classifyDiscoveryUpload } from "./BusinessDiscoveryEvidence.js";
import { BusinessCapabilityGapAnalyzer } from "./BusinessCapabilityGapAnalyzer.js";
import { buildBusinessBuilderReviewProjection } from "./BusinessBuilderReviewProjection.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "../business-os/fixtures/HockeyTravelClubSpecification.js";
import { BusinessOSCompiler } from "../business-os/BusinessOSCompiler.js";
import { BusinessOSInstaller } from "../business-os/BusinessOSInstaller.js";
import { buildBusinessOSNavigation } from "../business-os/BusinessOSNavigationBuilder.js";

const NOW = "2026-07-10T22:00:00.000Z";

test("adaptive questions progress toward an initial proposal", () => {
  const first = nextDiscoveryQuestions({ answers: [], limit: 3 });
  assert.equal(first.length, 3);
  assert.ok(first.every((question) => question.requiredForInitialProposal));

  const answers = first.map((question, index) => ({
    questionId: question.questionId,
    answer: `answer-${index}`,
    confidence: 0.8,
  }));
  const progress = discoveryProgress({ answers });
  assert.ok(progress.requiredAnswered >= 3);
  assert.equal(classifyDiscoveryUpload({ filename: "contacts-crm.csv" }), "crm_import");
  assert.equal(classifyDiscoveryUpload({ filename: "mystery.bin" }), "unknown_review");
});

test("gap analyzer creates honest proposals instead of fabricating support", () => {
  const result = new BusinessCapabilityGapAnalyzer().analyzeNeeds([
    { requestedOutcome: "Autonomous drone inspection fleet", capabilityId: "drone_fleet_ops" },
    { requestedOutcome: "Work queue", capabilityId: "work_queue" },
  ]);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.resolutions[0].fabricated, false);
  assert.equal(result.resolutions[0].availability, "missing_reusable_capability");
  assert.equal(result.resolutions[1].availability, "supported");
});

test("client review projection hides technical internals", () => {
  const spec = exportMcBrideBusinessOSSpecification({ generatedAt: NOW });
  const plan = new BusinessOSCompiler().compile(spec).plan;
  const review = buildBusinessBuilderReviewProjection({
    session: { sessionId: "bbs_test", status: "proposed" },
    specification: spec,
    plan,
  });
  assert.equal(review.sections.recommendedOS.title, "Your recommended operating system");
  assert.ok(review.sections.workspaces.items.some((item) => item.label === "Properties"));
  assert.equal(review.navigationPreview.employeePlacement, "digital_workforce");
  const blob = JSON.stringify(review);
  assert.doesNotMatch(blob, /BusinessSubject|BusinessGraph|INSTALL_|capabilityId|JSONB/);
});

test("builder session: discover → propose → dry-run → install for hockey fixture path", async () => {
  const builder = new BusinessBuilderService();
  const started = builder.startSession({ mode: "operator", businessName: "Northline Hockey" });
  const sessionId = started.session.sessionId;

  builder.answerQuestion({ sessionId, questionId: "company_name", answer: "Northline Hockey" });
  builder.answerQuestion({ sessionId, questionId: "industry", answer: "hockey travel club" });
  builder.answerQuestion({ sessionId, questionId: "services", answer: "practices, travel, scouting" });
  builder.answerQuestion({ sessionId, questionId: "customer_types", answer: "players, parents, coaches" });
  builder.answerQuestion({
    sessionId,
    questionId: "important_records",
    answer: "Teams, Players, Practices, Drills, Scouting Reports",
  });
  builder.answerQuestion({ sessionId, questionId: "incoming_requests", answer: "travel questions, practice changes" });
  builder.answerQuestion({ sessionId, questionId: "approvals", answer: "parent messages" });
  builder.answerQuestion({ sessionId, questionId: "channels", answer: "email" });
  builder.answerQuestion({ sessionId, questionId: "pain_points", answer: "scattered schedules" });
  builder.answerQuestion({ sessionId, questionId: "automation_tolerance", answer: "prepare drafts, require approval" });
  builder.answerQuestion({ sessionId, questionId: "launch_priorities", answer: "schedule, drills, work queue" });

  const upload = builder.attachUpload({ sessionId, filename: "drill-library.pdf", notes: "sop drills" });
  assert.equal(upload.mutatesCanonicalData, false);

  const research = await builder.attachWebsiteResearch({
    sessionId,
    websiteUrl: "https://northlinehockey.example",
    nowISO: NOW,
  });
  assert.equal(research.ok, true);
  assert.ok(research.research.confidence < 1);

  const proposal = builder.propose({ sessionId, nowISO: NOW });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.validation.ok, true);
  assert.ok(proposal.specification.modules.some((module) => module.label === "Teams"));
  assert.ok(proposal.specification.modules.some((module) => module.label === "Drill Library"));
  assert.ok(proposal.review.sections.digitalWorkforce.placement.includes("Digital Workforce"));

  const nav = buildBusinessOSNavigation({
    modules: proposal.specification.modules,
    navigation: proposal.specification.navigation,
  });
  assert.ok(nav.primaryItems.some((item) => item.moduleId === "teams" || item.label === "Teams"));
  assert.ok(!nav.primaryItems.some((item) => item.moduleId?.startsWith("emp_")));
  assert.equal(nav.employeePlacement, "digital_workforce");

  const dry = builder.dryRun({
    sessionId,
    specification: proposal.specification,
    nowISO: NOW,
  });
  assert.equal(dry.ok, true);
  assert.equal(dry.dryRunResult.mutated, false);

  const installed = builder.install({
    sessionId,
    specification: proposal.specification,
    plan: dry.plan,
    dryRunResult: dry.dryRunResult,
    approved: true,
    nowISO: NOW,
  });
  assert.equal(installed.ok, true);
  assert.ok(installed.configuration.modules.some((module) => module.moduleId === "drills"));
});

test("McBride gold blueprint remains installable and unchanged as source", () => {
  const gold = exportMcBrideBusinessOSSpecification({ generatedAt: NOW });
  const hash = gold.contentHash;
  const compiled = new BusinessOSCompiler().compile(gold, { nowISO: NOW });
  const installer = new BusinessOSInstaller();
  const businessId = "biz_builder_mcbride_proof";
  const spec = exportMcBrideBusinessOSSpecification({ businessId, generatedAt: NOW });
  const plan = new BusinessOSCompiler().compile(spec, { nowISO: NOW }).plan;
  const dry = installer.dryRun({ specification: spec, plan, businessId, nowISO: NOW });
  const installed = installer.install({
    specification: spec,
    plan,
    businessId,
    dryRunResult: dry,
    approved: true,
    nowISO: NOW,
    existingGoldFingerprint: hash,
  });
  assert.equal(compiled.ok, true);
  assert.equal(installed.ok, true);
  assert.equal(gold.contentHash, hash);
  assert.ok(installed.configuration.modules.some((module) => module.moduleId === "campaigns"));
  assert.ok(installed.configuration.employees.length >= 1);
  assert.ok(!JSON.stringify(installed.configuration).includes("PropertyRuntime"));
});

test("hockey fixture navigation proof keeps employees in Digital Workforce", () => {
  const spec = createHockeyTravelClubSpecification();
  const nav = buildBusinessOSNavigation({ modules: spec.modules, navigation: spec.navigation });
  for (const label of ["Teams", "Players", "Schedule", "Practices", "Drill Library", "Scouting Reports"]) {
    assert.ok(spec.modules.some((module) => module.label === label));
  }
  const allNav = [...nav.primaryItems, ...nav.overflowItems];
  assert.ok(allNav.some((item) => item.moduleId === "digital_workforce"));
  assert.equal(nav.employeePlacement, "digital_workforce");
  assert.ok(spec.employeeDefinitions.every((employee) =>
    !allNav.some((item) => item.moduleId === employee.employeeId)));
});
