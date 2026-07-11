import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ARCHITECT_COMPLETION_ACTIONS,
  ARCHITECT_HOME_ACTIONS,
  ARCHITECT_INSTALL_STAGES,
  ARCHITECT_PREVIEW_ROLES,
  ARCHITECT_PROPOSAL_SECTIONS,
  askVibetechContinuity,
  architectRoutes,
  changeImpactCopy,
  confidenceLabel,
  detectUploadHint,
  discoveryProgress,
  humanizeToken,
  installStageProgress,
  proposalSectionView,
  researchFindingCards,
} from "./architectSemantics.ts";

test("Architect home actions cover welcome entry points", () => {
  assert.deepEqual([...ARCHITECT_HOME_ACTIONS], [
    "continue_session",
    "build_new",
    "browse_examples",
    "browse_blueprints",
    "learn_how",
  ]);
});

test("discovery progress and confidence indicators", () => {
  const progress = discoveryProgress({
    progress: { percent: 42, label: "Understanding your business" },
    answers: [{ questionId: "q_tell_us" }],
    questions: [{ questionId: "q_industry" }],
  });
  assert.equal(progress.percent, 42);
  assert.equal(progress.answered, 1);
  assert.equal(progress.remaining, 1);
  assert.equal(confidenceLabel(0.9).tone, "success");
  assert.equal(confidenceLabel("low").tone, "warning");
});

test("website research findings become editable cards", () => {
  const cards = researchFindingCards({
    locations: ["Austin", "Dallas"],
    services: ["Cleaning"],
    contactMethods: ["email"],
    confidence: "high",
  });
  assert.equal(cards.find((card) => card.id === "locations")?.status, "found");
  assert.equal(cards.find((card) => card.id === "faqs")?.status, "empty");
  assert.ok(cards.every((card) => card.label && card.confidence === "high"));
});

test("upload recognition covers PDF DOCX TXT CSV Excel policies CRM SOPs handbook", () => {
  assert.equal(detectUploadHint("handbook.pdf").label, "Employee handbook");
  assert.equal(detectUploadHint("policy.docx").label, "Policy document");
  assert.equal(detectUploadHint("sop.txt").label, "SOP");
  assert.equal(detectUploadHint("export.csv").label, "CRM export");
  assert.equal(detectUploadHint("roster.xlsx").label, "Excel spreadsheet");
  assert.ok(detectUploadHint("notes.txt").plannedUse.includes("knowledge"));
  assert.ok(detectUploadHint("crm.csv").plannedUse.toLowerCase().includes("non-mutating"));
});

test("proposal sections are plain-English visual cards without JSON jargon", () => {
  const labels = ARCHITECT_PROPOSAL_SECTIONS.map((section) => section.label);
  assert.ok(labels.includes("Overview"));
  assert.ok(labels.includes("Employees"));
  assert.ok(labels.includes("Missing Capabilities"));
  assert.ok(!labels.some((label) => /json|runtime|compiler/i.test(label)));

  const { view } = proposalSectionView("employees", {
    views: {
      digitalWorkforce: { title: "Digital employees", items: [{ label: "Coordinator" }] },
    },
  });
  assert.equal(view?.title, "Digital employees");
});

test("portal preview supports Owner Manager Employee role switching", () => {
  assert.deepEqual(
    ARCHITECT_PREVIEW_ROLES.map((role) => role.id),
    ["OWNER", "MANAGER", "EMPLOYEE"],
  );
});

test("conversational editing requires approval and never silent mutates", () => {
  const impact = changeImpactCopy({
    explanation: "Add Payroll workspace",
    risk: "medium",
  });
  assert.equal(impact?.requiresApproval, true);
  assert.match(impact?.headline ?? "", /nothing installed/i);
});

test("install experience uses staged progress", () => {
  assert.ok(ARCHITECT_INSTALL_STAGES.length >= 6);
  assert.equal(ARCHITECT_INSTALL_STAGES[0].label, "Creating Business");
  assert.equal(ARCHITECT_INSTALL_STAGES.at(-1)?.label, "Finalizing");
  const stages = installStageProgress(2, "installing");
  assert.equal(stages[2].state, "active");
  assert.equal(stages[0].state, "done");
  assert.equal(stages[5].state, "pending");
});

test("completion experience celebrates and offers portal invite improve", () => {
  assert.deepEqual(
    ARCHITECT_COMPLETION_ACTIONS.map((action) => action.id),
    ["open_portal", "invite", "improve"],
  );
});

test("Ask VIBETech continuity never restarts discovery", () => {
  const continuity = askVibetechContinuity({
    businessId: "biz_1",
    hasDna: true,
    hasInstalledOs: true,
    hasHistory: true,
  });
  assert.equal(continuity.neverRestartDiscovery, true);
  assert.equal(continuity.mode, "continuous_improvement");
  assert.equal(continuity.entryLabel, "Ask VIBETech");
  assert.ok(continuity.knows.businessDna);
  assert.ok(continuity.knows.installedBusinessOs);
  assert.match(continuity.openPath, /builder\/improve/);
});

test("architect routes replace builder landing and keep legacy redirects", () => {
  const routes = architectRoutes("sess_1");
  assert.equal(routes.home, "/architect");
  assert.equal(routes.session, "/architect/sess_1");
  assert.equal(routes.dryRun, "/architect/sess_1/dry-run");
  assert.equal(routes.install, "/architect/sess_1/install");
  assert.equal(routes.legacyBuilderHome, "/builder");
});

test("accessibility and responsive helpers stay humanized", () => {
  assert.equal(humanizeToken("digital_workforce"), "digital workforce");
  assert.equal(humanizeToken("q_company_name".replace(/^q_/, "")), "company name");
  // Responsive layout contract: proposal + preview roles remain short labels for narrow screens.
  assert.ok(ARCHITECT_PREVIEW_ROLES.every((role) => role.label.length <= 10));
  assert.ok(ARCHITECT_PROPOSAL_SECTIONS.every((section) => section.label.length <= 24));
});
