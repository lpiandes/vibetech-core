import assert from "node:assert/strict";
import { test } from "node:test";

import { AiBuilderService } from "./AiBuilderService.js";
import { BusinessWebsiteResearchService } from "./BusinessWebsiteResearchService.js";
import { ContinuousBusinessBuilderService } from "./ContinuousBusinessBuilderService.js";
import { resolveRoleAccess, canAccessModule } from "../business-os/BusinessOSRoleAccess.js";
import { MEMBERSHIP_ROLES } from "../platform/permissions/rolePermissions.js";
import {
  SupportAccessService,
  createInMemorySupportAccessStore,
} from "../platform/support/SupportAccessService.js";
import { PLATFORM_ROLES } from "../platform/permissions/rolePermissions.js";

const NOW = () => "2026-07-11T14:00:00.000Z";

async function journey({
  description,
  businessName,
  businessId,
  websiteFixture = null,
  changeText = null,
}) {
  const fixtures = new Map();
  if (websiteFixture) fixtures.set(websiteFixture.url, { text: websiteFixture.text });
  const service = new AiBuilderService({
    researchService: new BusinessWebsiteResearchService({ fixtures }),
    nowISO: NOW,
  });

  const started = await service.startSession({
    mode: "new_business",
    businessId,
    businessName,
    description,
    websiteUrl: websiteFixture?.url ?? null,
  });
  assert.equal(started.ok, true);

  if (websiteFixture) {
    const research = await service.research({
      sessionId: started.session.sessionId,
      websiteUrl: websiteFixture.url,
    });
    assert.equal(research.ok, true);
    assert.equal(research.report.canInstallCapabilities, false);
  }

  // Answer key remaining questions until proposal-ready or force propose with enough summary.
  let sessionId = started.session.sessionId;
  const baseAnswers = [
    ["q_company_name", businessName],
    ["q_website", websiteFixture?.url ?? "We do not have a website yet"],
    ["q_industry", description],
    ["q_services", "core services"],
    ["q_customers", "customers"],
    ["q_value_promise", "reliable service and clear communication"],
    ["q_roles", "owner, manager, employee"],
    ["q_repetitive_work", "follow-ups"],
    ["q_desired_workflows", "FB lead comes in -> email -> SMS -> update pipeline"],
    ["q_bottlenecks", "manual coordination"],
    ["q_approvals", "customer messages"],
    ["q_communications", "email and text"],
    ["q_scheduling", "Yes, the team schedules appointments and events"],
    ["q_lead_sources", "website and referrals"],
    ["q_documents", "We have operating policies and templates"],
    ["q_integrations", "gmail, google_calendar, twilio_sms"],
    ["q_pain_points", "manual coordination"],
    ["q_desired_outcomes", "clear workspaces and approvals"],
    ["q_digital_workforce", "Intake coordinator"],
  ];
  const lowerDescription = description.toLowerCase();
  const packAnswers = /dental/.test(lowerDescription)
    ? [
      ["q_dental_pms", "Dentrix"],
      ["q_dental_billing", "Insurance and patient billing are reviewed by the office manager"],
      ["q_dental_recall", "Recall is reviewed weekly and approved before sending"],
      ["q_dental_appointment_model", "Front desk schedules appointments"],
      ["q_dental_first_reply", "Hours, insurance accepted, and next available appointment"],
    ]
    : /hockey|sports|club/.test(lowerDescription)
      ? [
        ["q_sports_teams", "U12 and U14 travel teams"],
        ["q_sports_schedule", "Coaches schedule practices, games, and tournaments with facilities"],
        ["q_sports_fundraising", "Track sponsor outreach and owner-approved fundraisers"],
        ["q_sports_opponents", "Track opponents, facilities, and ice time in the schedule"],
        ["q_sports_parent_comms", "Email and text with parent approval"],
      ]
      : /property/.test(lowerDescription)
        ? [
          ["q_other_vertical_shape", "We manage homes and coordinate leasing, maintenance, and owner communication"],
          ["q_other_primary_workflow", "Requests are routed to the right person and reviewed before external messages send"],
          ["q_other_communication_priority", "Keep owners, residents, and vendors informed with approved email and text"],
        ]
        : [];
  for (const [questionId, answer] of [...baseAnswers, ...packAnswers]) {
    await service.answer({ sessionId, questionId, answer });
  }

  const proposed = await service.propose({ sessionId });
  assert.equal(proposed.ok, true);
  assert.ok(proposed.proposal.views.navigation);
  assert.ok(proposed.proposal.views.digitalWorkforce);
  assert.ok(!JSON.stringify(proposed.specification.modules).includes("PatientRuntime"));
  assert.ok(!proposed.specification.subjectDefinitions.some((entry) => /Runtime$/i.test(entry.subjectType)));
  assert.ok(!/class HockeyRuntime|HockeyPlayerRuntime/.test(JSON.stringify(proposed.specification)));
  assert.ok(!/PropertyRuntime|PatientRuntime/.test(JSON.stringify(proposed.specification.modules)));

  const dry = await service.dryRun({ sessionId });
  assert.equal(dry.ok, true);
  assert.equal(dry.dryRunResult.mutated, false);

  const installed = await service.install({
    sessionId,
    approved: true,
    actorId: "owner_1",
  });
  assert.equal(installed.ok, true);
  assert.equal(installed.session.currentStage, "installed");

  const ownerAccess = resolveRoleAccess({
    specification: proposed.specification,
    configuration: installed.installation.configuration,
    membershipRole: MEMBERSHIP_ROLES.OWNER,
    roleId: proposed.specification.roleDefinitions?.[0]?.roleId,
  });
  assert.ok(ownerAccess.visibleModuleIds.length >= 1);

  if (changeText) {
    const changed = await service.chat({ sessionId, text: changeText });
    assert.equal(changed.ok, true);
    assert.equal(changed.changeImpact.requiresDryRun, true);
    const dry2 = await service.dryRun({ sessionId });
    assert.equal(dry2.ok, true);
    const installed2 = await service.install({ sessionId, approved: true, actorId: "owner_1" });
    assert.equal(installed2.ok, true);
  }

  return { service, proposed, installed, sessionId };
}

test("unsupported property-management AI Builder journey remains universal and never installs a property fixture", async () => {
  const { proposed, installed } = await journey({
    businessId: "biz_builder_pm",
    businessName: "Harbor Property Group",
    description: "Residential property management with leasing, maintenance, and owner communication.",
    websiteFixture: {
      url: "https://harbor.pm.example",
      text: "Harbor Property Group\nLeasing and maintenance for residents and owners",
    },
    changeText: "Add a weekly newsletter",
  });
  assert.ok(!proposed.specification.modules.some((module) => module.moduleId === "properties"));
  assert.ok(!installed.installation.configuration.modules.some((module) => module.moduleId === "properties"));
});

test("dental practice AI Builder journey installs its workflows and CRM pipelines", async () => {
  const { proposed, installed } = await journey({
    businessId: "biz_builder_dental",
    businessName: "Bright Smile Dental",
    description: "Family dental practice with cleanings, exams, and treatment plans for patients.",
    websiteFixture: {
      url: "https://brightsmile.dental.example",
      text: "Bright Smile Dental\nCleanings and treatment plans for patients",
    },
    changeText: "Only managers should see billing",
  });
  assert.ok(proposed.specification.modules.some((module) => module.label === "Patients"));
  assert.ok(proposed.specification.modules.some((module) => module.moduleId === "appointments"));
  assert.ok(proposed.specification.workflowDefinitions.some((workflow) => workflow.workflowId === "patient_intake"));
  assert.ok(proposed.specification.pipelineDefinitions.some((pipeline) => pipeline.pipelineId === "new_patient_intake"));
  assert.ok(installed.installation.configuration.workflows.some((workflow) => workflow.workflowId === "patient_intake"));
  assert.ok(installed.installation.configuration.pipelines.some((pipeline) => pipeline.pipelineId === "new_patient_intake"));
  const employee = resolveRoleAccess({
    specification: proposed.specification,
    membershipRole: MEMBERSHIP_ROLES.EMPLOYEE,
    roleId: "employee",
  });
  assert.equal(canAccessModule({ roleAccess: employee, moduleId: "billing" }), false);
});

test("sports-club AI Builder journey stays answer-driven and tenant-isolated", async () => {
  const a = await journey({
    businessId: "biz_builder_hockey",
    businessName: "Northline Travel Hockey",
    description: "Youth travel hockey club with teams, practices, drills, and scouting reports.",
  });
  assert.ok(a.proposed.specification.modules.some((module) => module.moduleId === "teams"));
  assert.ok(a.proposed.specification.modules.some((module) => module.moduleId === "players"));
  assert.ok(a.proposed.specification.workflowDefinitions.some((workflow) => workflow.workflowId === "player_registration"));
  assert.ok(a.installed.installation.configuration.pipelines.some((pipeline) => pipeline.pipelineId === "player_registration"));
  const customized = (a.proposed.specification.employeeDefinitions ?? []).find((employee) => (
    employee?.operatingContract?.automationPath?.customized
  ));
  assert.ok(customized, "desired workflows should install a customized automation path");
  assert.ok(
    customized.operatingContract.automationPath.steps.some((step) => step.type === "send_sms"),
  );

  const b = await journey({
    businessId: "biz_builder_pm_iso",
    businessName: "Other PM Co",
    description: "Property management leasing and maintenance company.",
  });
  assert.notEqual(
    a.installed.installation.configuration.modules.map((module) => module.moduleId).join(","),
    b.installed.installation.configuration.modules.map((module) => module.moduleId).join(","),
  );

  const support = new SupportAccessService({
    store: createInMemorySupportAccessStore({
      businesses: [
        { id: "biz_builder_hockey", name: "Hockey" },
        { id: "biz_builder_pm_iso", name: "PM" },
      ],
    }),
    nowISO: NOW,
  });
  const entered = await support.enter({
    adminUserId: "vt_admin",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_builder_hockey",
    reason: "Help owner with scouting permissions",
  });
  assert.equal(entered.ok, true);
  assert.equal(entered.session.actorIdentity.userId, "vt_admin");
  assert.equal(
    (await support.resolveAuthorization({
      adminUserId: "vt_admin",
      platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
      businessId: "biz_builder_pm_iso",
    })).ok,
    false,
  );

  const continuous = new ContinuousBusinessBuilderService({ aiBuilder: a.service });
  const improve = await continuous.startImprovement({
    businessId: "biz_builder_hockey",
    installedSpecification: a.proposed.specification,
    prompt: "Add a parent communication workflow",
  });
  assert.equal(improve.ok, true);
  assert.equal(improve.session.businessId, "biz_builder_hockey");
});
