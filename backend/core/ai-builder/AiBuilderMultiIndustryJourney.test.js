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
  for (const [questionId, answer] of [
    ["q_company_name", businessName],
    ["q_industry", description],
    ["q_services", "core services"],
    ["q_customers", "customers"],
    ["q_roles", "owner, manager, employee"],
    ["q_repetitive_work", "follow-ups"],
    ["q_approvals", "customer messages"],
    ["q_pain_points", "manual coordination"],
    ["q_desired_outcomes", "clear workspaces and approvals"],
  ]) {
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

test("property management AI Builder journey", async () => {
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
  assert.ok(proposed.specification.modules.some((module) => module.moduleId === "properties"));
  assert.ok(installed.installation.configuration.modules.some((module) => module.moduleId === "properties"));
});

test("dental practice AI Builder journey", async () => {
  const { proposed } = await journey({
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
  const employee = resolveRoleAccess({
    specification: proposed.specification,
    membershipRole: MEMBERSHIP_ROLES.EMPLOYEE,
    roleId: "employee",
  });
  assert.equal(canAccessModule({ roleAccess: employee, moduleId: "billing" }), false);
});

test("hockey travel club AI Builder journey with tenant isolation and support access", async () => {
  const a = await journey({
    businessId: "biz_builder_hockey",
    businessName: "Northline Travel Hockey",
    description: "Youth travel hockey club with teams, practices, drills, and scouting reports.",
    changeText: "Give coaches access to scouting",
  });
  assert.ok(a.proposed.specification.modules.some((module) => module.moduleId === "teams"));

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
