import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ARCHITECT_ASSEMBLY_STAGES,
  ARCHITECT_COMPLETION_ACTIONS,
  ARCHITECT_DNA_RINGS,
  ARCHITECT_HOME_ACTIONS,
  ARCHITECT_INSTALL_STAGES,
  ARCHITECT_PREVIEW_ROLES,
  ARCHITECT_PROPOSAL_SECTIONS,
  HUMAN_COPY,
  UNDERSTANDING_FIELDS,
  aiEmployeePersonas,
  approveWalkthroughCopy,
  askVibetechContinuity,
  architectRoutes,
  assemblyStagesFromProposal,
  buildApproveWalkthroughSteps,
  businessDnaPortrait,
  businessUnderstandingCards,
  changeImpactCopy,
  confidenceLabel,
  detectUploadHint,
  discoveryProgress,
  executiveBriefing,
  humanInstallState,
  humanizeToken,
  installStageProgress,
  proposalSectionView,
  reasoningMoments,
  researchFindingCards,
  scrubProposalPurpose,
  summarizeInstallProgress,
} from "./architectSemantics.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

test("website research findings map teamMembers without technical leaks", () => {
  const cards = researchFindingCards({
    locations: ["Austin", "Dallas"],
    services: ["Cleaning"],
    teamMembers: ["Alex", "Jordan"],
    contactMethods: ["email"],
    confidence: "high",
  });
  assert.equal(cards.find((card) => card.id === "locations")?.status, "found");
  assert.equal(cards.find((card) => card.id === "team")?.status, "found");
  assert.deepEqual(cards.find((card) => card.id === "team")?.values, ["Alex", "Jordan"]);
  assert.equal(cards.find((card) => card.id === "faqs")?.status, "empty");
  assert.ok(cards.every((card) => card.label && card.confidence === "high"));
  assert.ok(!cards.some((card) => /teamHints|teamMembers|json/i.test(card.label)));
});

test("upload recognition covers PDF DOCX TXT CSV Excel policies CRM SOPs handbook", () => {
  assert.equal(detectUploadHint("handbook.pdf").label, "Employee handbook");
  assert.equal(detectUploadHint("policy.docx").label, "Policy document");
  assert.equal(detectUploadHint("sop.txt").label, "Process guide");
  assert.equal(detectUploadHint("export.csv").label, "Customer export");
  assert.equal(detectUploadHint("roster.xlsx").label, "Excel spreadsheet");
  assert.ok(detectUploadHint("notes.txt").plannedUse.toLowerCase().includes("knowledge"));
  assert.ok(detectUploadHint("crm.csv").plannedUse.toLowerCase().includes("nothing imported"));
});

test("proposal sections use consultant labels without JSON jargon", () => {
  const labels = ARCHITECT_PROPOSAL_SECTIONS.map((section) => section.label);
  assert.ok(labels.includes("Overview"));
  assert.ok(labels.includes("Digital Workforce"));
  assert.ok(labels.includes("How work flows"));
  assert.ok(labels.includes("Still needed"));
  assert.ok(!labels.includes("Departments"));
  assert.ok(!labels.includes("Employees"));
  assert.ok(!labels.includes("Missing Capabilities"));
  assert.ok(!labels.some((label) => /json|runtime|compiler|dry.?run/i.test(label)));

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

test("AI employee personas are not membership roles", () => {
  const personas = aiEmployeePersonas({
    proposalWorkforce: {
      items: [{
        id: "coord_1",
        name: "Front Desk Coordinator",
        purpose: "Greets guests and routes approvals",
        responsibilities: ["Answer intake", "Escalate exceptions"],
        approvals: ["Manager for refunds"],
      }],
    },
  });
  assert.equal(personas.length, 1);
  assert.equal(personas[0].name, "Front Desk Coordinator");
  assert.ok(personas[0].purpose.includes("Greets"));
  assert.ok(!ARCHITECT_PREVIEW_ROLES.some((role) => role.id === personas[0].id));
});

test("business understanding and DNA portrait map summary fields", () => {
  const summary = {
    businessName: "Harbor Property",
    industry: "Property management",
    services: ["Leasing", "Maintenance"],
    customerTypes: ["Owners", "Tenants"],
    roles: ["Manager", "Coordinator"],
    goals: ["Faster leasing"],
  };
  const cards = businessUnderstandingCards(summary);
  assert.ok(cards.some((card) => card.id === "services" && card.status === "found"));
  assert.ok(cards.some((card) => card.id === "customers" && card.status === "found"));
  assert.equal(UNDERSTANDING_FIELDS.length, 6);

  const portrait = businessDnaPortrait(summary);
  assert.equal(portrait.rings.length, ARCHITECT_DNA_RINGS.length);
  assert.ok(portrait.rings.find((ring) => ring.id === "company")!.ratio > 0);
  assert.ok(portrait.rings.find((ring) => ring.id === "work")!.ratio > 0);
  assert.ok(!/BusinessDna|contract|json/i.test(portrait.label));
});

test("reasoning moments stay plain English", () => {
  const moments = reasoningMoments({
    nextQuestion: { why: "So we can size the team correctly", text: "How many people work here?" },
    proposal: { explanation: { summary: "A calm operating system for leasing and maintenance." } },
    changeImpact: { explanation: "Add a Payroll workspace for managers." },
  });
  assert.ok(moments.some((moment) => moment.id === "why_question"));
  assert.ok(moments.some((moment) => moment.id === "proposal_summary"));
  assert.ok(!moments.some((moment) => /json|runtime|compiler/i.test(moment.body)));
});

test("assembly stages reveal from proposal views", () => {
  assert.ok(ARCHITECT_ASSEMBLY_STAGES.length >= 5);
  const stages = assemblyStagesFromProposal({
    views: {
      navigation: { items: [{ id: "home" }] },
      digitalWorkforce: { items: [{ id: "a" }, { id: "b" }] },
    },
  });
  assert.equal(stages.find((stage) => stage.id === "navigation")?.ready, true);
  assert.equal(stages.find((stage) => stage.id === "workforce")?.count, 2);
  assert.equal(stages.find((stage) => stage.id === "workflows")?.ready, false);
});

test("conversational editing requires approval and never silent mutates", () => {
  const impact = changeImpactCopy({
    explanation: "Add Payroll workspace",
    risk: "medium",
  });
  assert.equal(impact?.requiresApproval, true);
  assert.match(impact?.headline ?? "", /nothing installed/i);
});

test("install experience uses humanized staged progress", () => {
  assert.ok(ARCHITECT_INSTALL_STAGES.length >= 6);
  assert.equal(ARCHITECT_INSTALL_STAGES[0].label, "Creating your business");
  assert.equal(ARCHITECT_INSTALL_STAGES.at(-1)?.label, "Opening your business");
  const stages = installStageProgress(2, "installing");
  assert.equal(stages[2].state, "active");
  assert.equal(stages[2].stateLabel, "In progress");
  assert.equal(stages[0].state, "done");
  assert.equal(humanInstallState("pending"), "Waiting");
  assert.equal(stages[5].state, "pending");
  assert.equal(HUMAN_COPY.installing, "Building your workspace…");
  const progress = summarizeInstallProgress([
    { type: "INSTALL_MODULE", status: "applied" },
    { type: "INSTALL_EMPLOYEE", status: "applied" },
    { type: "INSTALL_WORKFLOW", status: "requires_setup" },
  ]);
  assert.equal(progress.percent, 100);
  assert.ok(progress.stages.some((stage) => stage.id === "employees" && stage.state === "done"));
});

test("executive briefing and completion actions", () => {
  assert.deepEqual(
    ARCHITECT_COMPLETION_ACTIONS.map((action) => action.id),
    ["open_portal"],
  );
  assert.equal(ARCHITECT_COMPLETION_ACTIONS[0].label, "Open your business");
  const briefing = executiveBriefing({
    businessName: "Harbor",
    explanation: { summary: "Ready for leasing teams." },
    views: {
      navigation: { items: [1, 2] },
      digitalWorkforce: { items: [1] },
      dashboard: { cards: [1, 2, 3] },
      integrations: { items: [] },
    },
  });
  assert.equal(briefing.headline, "Open your business");
  assert.equal(briefing.highlights.find((item) => item.id === "navigation")?.value, 2);
  assert.equal(briefing.actions.length, 1);
  assert.equal(briefing.actions[0].id, "open_portal");

  const junk = executiveBriefing({
    businessName: "ok",
    explanation: { summary: "ok will run on VIBETech with 7 workspaces." },
  });
  assert.equal(junk.businessName, "Your business");
  assert.match(junk.summary, /ready\. Open Home/);
});

test("human copy bans technical install jargon", () => {
  assert.equal(HUMAN_COPY.prepareLaunch, "Check readiness");
  assert.equal(HUMAN_COPY.previewPortal, "Review before you approve");
  assert.equal(HUMAN_COPY.reviewContinue, "Looks good — continue");
  assert.equal(HUMAN_COPY.reviewApply, "Looks good — apply");
  assert.equal(HUMAN_COPY.launchReadiness, "Readiness check");
  assert.equal(HUMAN_COPY.approveLaunch, "Approve");
  assert.equal(HUMAN_COPY.proposePlan, "Show me the recommendation");
  assert.equal(HUMAN_COPY.requestChanges, "Tell us what we should change");
  assert.ok(!/dry run|propose os|record approval|launch readiness|prepare to launch|preview your home/i.test(Object.values(HUMAN_COPY).join(" ")));
});

test("scrubProposalPurpose removes junk for ok builder jargon", () => {
  const cleaned = scrubProposalPurpose(
    "Specialize reusable Coordinator archetype for ok — never invent a 'one-off' agent.",
    "Operations Coordinator",
  );
  assert.ok(!/for ok/i.test(cleaned));
  assert.ok(!/never invent/i.test(cleaned));
  assert.ok(!/Specialize reusable/i.test(cleaned));
  assert.match(cleaned, /this business|Operations Coordinator/i);
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
  assert.match(continuity.openPath, /\/b\/biz_1\/architect/);
});

test("architect routes are canonical; legacy /builder is not advertised", () => {
  const routes = architectRoutes("sess_1");
  assert.equal(routes.home, "/architect");
  assert.equal(routes.session, "/architect/sess_1");
  assert.equal(routes.dryRun, "/architect/sess_1/dry-run");
  const inBusiness = architectRoutes("sess_1", "biz_1");
  assert.equal(inBusiness.session, "/b/biz_1/architect?sessionId=sess_1");
  assert.equal(inBusiness.dryRun, "/architect/sess_1/dry-run");
  assert.equal(routes.install, "/architect/sess_1/install");
  assert.equal((routes as { legacyBuilderHome?: string }).legacyBuilderHome, undefined);
});

test("accessibility and responsive helpers stay humanized", () => {
  assert.equal(humanizeToken("digital_workforce"), "digital workforce");
  assert.equal(humanizeToken("q_company_name".replace(/^q_/, "")), "company name");
  assert.ok(ARCHITECT_PREVIEW_ROLES.every((role) => role.label.length <= 10));
  assert.ok(ARCHITECT_PROPOSAL_SECTIONS.every((section) => section.label.length <= 24));
});

test("approve walkthrough builds one concrete step at a time from the proposal", () => {
  const steps = buildApproveWalkthroughSteps({
    continuous: false,
    proposal: {
      businessName: "Mind and Mobility",
      explanation: { summary: "A calm operating system for Mind and Mobility." },
      views: {
        navigation: {
          items: [
            { id: "home", label: "Home" },
            { id: "work", label: "Work" },
            { id: "people", label: "People" },
          ],
        },
        dashboard: {
          cards: [
            { id: "health", title: "Business health" },
            { id: "kpi", title: "KPI cards" },
            { id: "attention", title: "Needs attention" },
          ],
        },
        digitalWorkforce: {
          items: [
            {
              id: "emp_1",
              name: "Follow-Up Specialist",
              purpose: "Keeps stalled work moving",
              responsibilities: ["Chase open follow-ups"],
              approvals: ["Send client replies"],
              knowledge: ["Service menu"],
            },
          ],
        },
      },
    },
  });

  assert.equal(steps[0].kind, "nav");
  assert.ok(steps[0].items.includes("Home"));
  assert.ok(steps[0].items.includes("Needs attention"));
  assert.ok(!steps[0].items.some((item) => /business health|kpi cards?/i.test(item)));
  assert.equal(steps.some((step) => step.kind === "teammate" && step.title === "Follow-Up Specialist"), true);
  assert.equal(steps.some((step) => step.kind === "approvals"), true);
  assert.equal(steps.at(-1)?.kind, "confirm");
  assert.match(steps.at(-1)?.body ?? "", /Mind and Mobility/);

  const rendered = JSON.stringify(steps);
  assert.ok(!/Shows real counts once you have activity/i.test(rendered));
  assert.ok(!/prepare to launch/i.test(rendered));
});

test("approve walkthrough copy differs for continuous improve vs first install", () => {
  const install = approveWalkthroughCopy(false);
  const continuous = approveWalkthroughCopy(true);
  assert.equal(install.primaryCta, "Looks good — continue");
  assert.equal(continuous.primaryCta, "Looks good — apply");
  assert.match(install.headline, /approving/i);
  assert.match(continuous.headline, /change/i);
});

test("Architect workspace mounts approve walkthrough instead of portal preview", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const workspace = readFileSync(path.join(here, "ArchitectWorkspace.tsx"), "utf8");
  const walkthrough = readFileSync(path.join(here, "ApproveWalkthrough.tsx"), "utf8");
  assert.match(workspace, /ApproveWalkthrough/);
  assert.ok(workspace.includes("<ApproveWalkthrough"));
  assert.ok(!workspace.includes("PortalPreviewImmersive"));
  assert.ok(!workspace.includes("portal_preview"));
  assert.match(workspace, /continuous\) \{\s*setCenterMode\("conversation"\)/s);
  assert.ok(!workspace.includes("Review recommendation"));
  assert.match(walkthrough, /Back/);
  assert.match(walkthrough, /Next/);
  assert.ok(!walkthrough.includes("Business health"));
  assert.ok(!walkthrough.includes("KPI cards"));
  assert.ok(!walkthrough.includes("See it as your team will"));
});
