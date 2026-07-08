import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID, HORIZON_PROPERTIES_DEMO_ID } from "../workspace/activation/activateWorkspace.js";
import { resolveDefaultActivationForWorkspace } from "../workspace/activation/activateWorkspace.js";
import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { createABCPropertyGroupSeed } from "../company/fixtures/ABCPropertyGroupSeed.js";
import { createEmptyBusiness } from "./EmptyBusinessProvisioner.js";
import { createHorizonDemoBusiness } from "./DemoWorkspaceProvisioner.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { getHorizonTaylorPartyId } from "../integration/FirstClientOperatingLoopRunner.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

test("normal startup does not resolve Horizon as default activation", () => {
  assert.equal(resolveDefaultActivationForWorkspace("ws_horizon_properties"), null);
  assert.equal(resolveDefaultActivationForWorkspace("ws_any"), null);
});

test("normal workspace activation does not bootstrap Horizon demo", () => {
  const result = activateWorkspace({
    workspaceId: "ws_empty_phase1",
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: buildEmptyPropertyManagementConfiguration({
        companyName: "Clean Business",
        workspaceId: "ws_empty_phase1",
      }),
    },
  });

  assert.equal(result.demoBootstrap, null);
  assert.equal(result.demoConfigurationResult, null);
  assert.equal(result.ctx.businessGraphRuntime.getParties().length, 0);
  assert.equal(result.ctx.businessSubjectRuntime.getSubjects().length, 0);
  assert.equal(result.ctx.requestRuntime.getRequests().length, 0);
  assert.equal(result.ctx.workRuntime.getWorkItems().length, 0);
  assert.equal(result.ctx.communicationRuntime.getMessages().length, 0);
  assert.equal(result.ctx.teamRuntime.getMembers().filter((m) => m.memberType === "human").length, 0);
  assert.equal(result.ctx.companyRuntime.getKnowledgeRepository().items.length, 0);
});

test("fresh business has zero fake operational facts", () => {
  const wid = "ws_fresh_facts_test";
  const result = activateWorkspace({
    workspaceId: wid,
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: buildEmptyPropertyManagementConfiguration({
        companyName: "Fresh Facts LLC",
        workspaceId: wid,
      }),
    },
  });

  assert.equal(result.ctx.businessGraphRuntime.getParties().length, 0);
  assert.equal(result.ctx.businessSubjectRuntime.getSubjects().length, 0);
  assert.equal(result.ctx.requestRuntime.getRequests().length, 0);
  assert.equal(result.ctx.workRuntime.getWorkItems().length, 0);
  assert.equal(result.ctx.communicationRuntime.getMessages().length, 0);
  assert.equal(result.ctx.teamRuntime.getMembers().filter((m) => m.memberType === "human").length, 0);
  assert.equal(result.ctx.companyRuntime.getKnowledgeRepository().items.length, 0);
  assert.ok(result.installationResult);
  assert.ok(result.ctx.capabilityRuntime.getCapabilities().length > 0);
});

test("Horizon can still be created explicitly as DEMO", async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }
  const { business, activation } = await createHorizonDemoBusiness({ nowISO: NOW_ISO });
  assert.equal(business.kind, "DEMO");
  assert.equal(business.demoConfigurationId, HORIZON_PROPERTIES_DEMO_ID);
  assert.ok(activation.demoBootstrap?.primaryPartyId);
  assert.equal(activation.demoBootstrap.primaryPartyId, getHorizonTaylorPartyId());
});

test("Horizon demo creation still produces intended demo reality", () => {
  const result = activateWorkspace({
    workspaceId: "ws_horizon_explicit_phase1",
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      demoConfigurationId: HORIZON_PROPERTIES_DEMO_ID,
    },
  });

  assert.ok(result.demoBootstrap?.requestIds?.length >= 3);
  assert.ok(result.ctx.businessGraphRuntime.getParty(getHorizonTaylorPartyId()));
  assert.ok(result.ctx.businessSubjectRuntime.getSubject("subj_horizon_unit_2b"));
});

test("CompanyWorkspaceRuntime default seed is empty", () => {
  const runtime = new CompanyWorkspaceRuntime();
  assert.equal(runtime.getCompanyData().properties.length, 0);
  assert.equal(runtime.getCompanyData().buyers.length, 0);
  assert.equal(runtime.getCompanyData().inquiries.length, 0);
  assert.equal(runtime.getEmployees().length, 0);
  assert.equal(runtime.getKnowledgeRepository().items.length, 0);
});

test("ABC fixture still provides legacy seeded company runtime for tests", () => {
  const runtime = new CompanyWorkspaceRuntime({ seed: createABCPropertyGroupSeed });
  assert.ok(runtime.getCompanyData().properties.length > 0);
  assert.equal(runtime.getKnowledge().faqs.length, 2);
});

test("empty business provisioner requires platform admin path", () => {
  assert.throws(
    () => createEmptyBusiness(),
    /platform admin is removed/,
  );
});
