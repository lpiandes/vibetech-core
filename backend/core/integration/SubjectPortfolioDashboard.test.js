import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "./ProspectInquiryOperatingLoopService.js";
import { RecordBusinessSubjectService } from "../business-subject/RecordBusinessSubjectService.js";
import { updateBusinessSubjectStatus } from "../business-subject/updateBusinessSubjectStatus.js";
import { buildSubjectPortfolioProjection } from "../business-subject/views/buildSubjectPortfolioProjection.js";
import { buildSubjectOperatingDetail } from "../business-subject/views/buildSubjectOperatingDetail.js";
import { buildBusinessOperatingHomeView } from "../command-center/buildBusinessOperatingHomeView.js";
import { buildExecutiveWorkspaceHomeView } from "../command-center/buildExecutiveWorkspaceHomeView.js";
import { buildBusinessSubjectPortfolioIndex } from "../business-subject/views/buildBusinessSubjectPortfolioIndex.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "../persistence/RuntimeSnapshotKinds.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";

const NOW = "2026-07-07T20:30:00.000Z";
const SUBJECT_TYPES = ["property", "listing", "unit"];

function buildActivation(workspaceId, companyName = "Portfolio Dashboard Co") {
  return {
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    industryPackageVersion: 1,
    packageConfiguration: { companyName },
    demoConfigurationId: null,
    workspaceId,
    activatedAt: NOW,
  };
}

function buildOperatingStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Portfolio Dashboard Co",
    workspaceId,
  });
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId,
    installPackage: true,
    demoConfiguration,
  });
  installPackageEmployees({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    humanTeamMembers: [],
    teamRuntime: stack.teamRuntime,
    nowISO: NOW,
  });
  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO: NOW,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });
  return { stack, integrationPlatform };
}

function seedListing(stack, { id, displayName, address }) {
  return new RecordBusinessSubjectService().execute({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    workspaceId: stack.workspaceId,
    subjectInput: { id, subjectType: "listing", displayName, keyAttributes: { address } },
    nowISO: NOW,
    source: "test",
  });
}

function buildCtx(stack) {
  return {
    businessSubjectRuntime: stack.businessSubjectRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    teamRuntime: stack.teamRuntime,
    approvalRuntime: stack.approvalRuntime,
    automationRuntime: stack.automationRuntime,
  };
}

async function runInquiry({ stack, integrationPlatform, workspaceId, inquiry }) {
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  return runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry,
  });
}

test("portfolio dashboard zero state", () => {
  const workspaceId = "ws_portfolio_zero";
  const { stack } = buildOperatingStack(workspaceId);
  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });
  const home = buildBusinessOperatingHomeView({
    ctx: buildCtx(stack),
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
    businessId: workspaceId,
    subjectTypes: SUBJECT_TYPES,
  });

  assert.equal(portfolio.totals.totalProperties, 0);
  assert.equal(home.showOperatingDashboard, false);
  assert.equal(home.metrics.find((m) => m.id === "open_inquiries")?.value, "0");
});

test("portfolio dashboard and property detail stay consistent after inquiry", async () => {
  const workspaceId = "ws_portfolio_consistency";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_harbor",
    displayName: "742 Harbor Lane",
    address: "742 Harbor Lane",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jane Smith",
      email: "jane@example.com",
      message: "Interested in this listing",
      subjectId: listing.id,
    },
  });

  const ctx = buildCtx(stack);
  const portfolio = buildSubjectPortfolioProjection({
    ctx,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });
  const detail = buildSubjectOperatingDetail({
    subjectId: listing.id,
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });
  const home = buildBusinessOperatingHomeView({
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
    businessId: workspaceId,
    subjectTypes: SUBJECT_TYPES,
  });

  const row = portfolio.topProperties.find((p) => p.subjectId === listing.id);
  assert.ok(row);
  assert.equal(row.inquiryCount, detail.metrics.inquiryCount);
  assert.equal(row.interestedCount, detail.metrics.interestedCount);
  assert.equal(row.openFollowUpCount, detail.metrics.openFollowUpCount);
  assert.equal(home.showOperatingDashboard, true);
  assert.equal(home.topProperties[0].subjectId, listing.id);
  assert.equal(home.metrics.find((m) => m.id === "open_inquiries")?.value, "1");
});

test("repeated inquiries keep one interested prospect but raise inquiry count", async () => {
  const workspaceId = "ws_portfolio_repeat";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_repeat",
    displayName: "Repeat House",
    address: "Repeat",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Alex Buyer",
      email: "alex@example.com",
      message: "First",
      subjectId: listing.id,
      submissionId: "repeat_1",
    },
  });
  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Alex Buyer",
      email: "alex@example.com",
      message: "Second",
      subjectId: listing.id,
      submissionId: "repeat_2",
    },
  });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  assert.equal(portfolio.topProperties[0].inquiryCount, 2);
  assert.equal(portfolio.topProperties[0].interestedCount, 1);
  assert.equal(portfolio.totals.interestedProspects, 1);
});

test("multiple properties order top properties by inquiry count", async () => {
  const workspaceId = "ws_portfolio_multi";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listingA = seedListing(stack, { id: "subj_a", displayName: "AAA Property", address: "A" });
  const listingB = seedListing(stack, { id: "subj_b", displayName: "ZZZ Property", address: "Z" });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Buyer A",
      email: "buyer.a@example.com",
      message: "A only",
      subjectId: listingA.id,
      submissionId: "multi_a",
    },
  });
  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Buyer B1",
      email: "buyer.b1@example.com",
      message: "B first",
      subjectId: listingB.id,
      submissionId: "multi_b1",
    },
  });
  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Buyer B2",
      email: "buyer.b2@example.com",
      message: "B second",
      subjectId: listingB.id,
      submissionId: "multi_b2",
    },
  });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  assert.equal(portfolio.topProperties[0].subjectId, listingB.id);
  assert.equal(portfolio.topProperties[0].inquiryCount, 2);
  assert.equal(portfolio.topProperties[1].subjectId, listingA.id);
});

test("inactive property keeps historical portfolio metrics", async () => {
  const workspaceId = "ws_portfolio_inactive";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, { id: "subj_sold", displayName: "Sold House", address: "Sold" });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Historical Buyer",
      email: "historical@example.com",
      message: "Before sold",
      subjectId: listing.id,
    },
  });

  updateBusinessSubjectStatus({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    subjectId: listing.id,
    status: "archived",
    nowISO: NOW,
  });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  assert.equal(portfolio.totals.activeProperties, 0);
  assert.equal(portfolio.totals.totalProperties, 1);
  assert.equal(portfolio.topProperties[0].inquiryCount, 1);
  assert.equal(portfolio.topProperties[0].status, "archived");
});

test("portfolio dashboard survives destroy-and-rehydrate via runtime snapshots", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const workspaceId = "ws_portfolio_restart";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_restart",
    displayName: "Restart Listing",
    address: "77 Restart Rd",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Restart Prospect",
      email: "restart@example.com",
      message: "After restart",
      subjectId: listing.id,
    },
  });

  const before = buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  const runtimeSnapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.REQUEST]);

  const rehydrated = activateWorkspace({
    workspaceId,
    activation: buildActivation(workspaceId),
    nowISO: NOW,
    runtimeSnapshots,
  });

  const after = buildSubjectPortfolioProjection({
    ctx: {
      businessSubjectRuntime: rehydrated.operatingStack.businessSubjectRuntime,
      businessGraphRuntime: rehydrated.operatingStack.businessGraphRuntime,
      requestRuntime: rehydrated.operatingStack.requestRuntime,
      workRuntime: rehydrated.operatingStack.workRuntime,
      interactionRuntime: rehydrated.operatingStack.interactionRuntime,
      communicationRuntime: rehydrated.operatingStack.communicationRuntime,
      teamRuntime: rehydrated.operatingStack.teamRuntime,
      approvalRuntime: rehydrated.operatingStack.approvalRuntime,
      automationRuntime: rehydrated.operatingStack.automationRuntime,
    },
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  assert.equal(after.totals.openInquiries, before.totals.openInquiries);
  assert.equal(after.topProperties[0].inquiryCount, before.topProperties[0].inquiryCount);
  assert.equal(after.topProperties[0].interestedCount, before.topProperties[0].interestedCount);
});

test("tenant isolation for portfolio dashboard metrics", async () => {
  const workspaceA = "ws_portfolio_tenant_a";
  const workspaceB = "ws_portfolio_tenant_b";
  const stackA = buildOperatingStack(workspaceA);
  const stackB = buildOperatingStack(workspaceB);

  const listingA = seedListing(stackA.stack, { id: "subj_a", displayName: "Tenant A Listing", address: "A" });
  await runInquiry({
    stack: stackA.stack,
    integrationPlatform: stackA.integrationPlatform,
    workspaceId: workspaceA,
    inquiry: {
      name: "Tenant A Buyer",
      email: "tenant.a@example.com",
      message: "A inquiry",
      subjectId: listingA.id,
    },
  });

  seedListing(stackB.stack, { id: "subj_b", displayName: "Tenant B Listing", address: "B" });

  const portfolioA = buildSubjectPortfolioProjection({
    ctx: buildCtx(stackA.stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });
  const portfolioB = buildSubjectPortfolioProjection({
    ctx: buildCtx(stackB.stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  assert.equal(portfolioA.totals.openInquiries, 1);
  assert.equal(portfolioB.totals.openInquiries, 0);
  assert.equal(portfolioA.totals.totalProperties, 1);
  assert.equal(portfolioB.totals.totalProperties, 1);
});

test("executive workspace home composes portfolio metrics with business-scoped links", async () => {
  const workspaceId = "ws_executive_home";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_exec",
    displayName: "Executive Test Listing",
    address: "1 Executive Way",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Exec Buyer",
      email: "exec@example.com",
      message: "Executive home inquiry",
      subjectId: listing.id,
    },
  });

  const ctx = buildCtx(stack);
  const executive = buildExecutiveWorkspaceHomeView({
    identityViewModel: { businessName: "Executive Test Co" },
    installationResult: stack.installationResult,
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
    businessId: workspaceId,
    subjectTypes: SUBJECT_TYPES,
    checklistComplete: false,
  });

  assert.equal(executive.showOperatingDashboard, true);
  assert.equal(executive.workspacePhase, "onboarding");
  assert.equal(executive.collapseChecklist, true);
  assert.equal(executive.metrics.find((m) => m.id === "open_inquiries")?.href, `/b/${workspaceId}/inbox`);
  assert.equal(executive.topProperties[0]?.href, `/b/${workspaceId}/properties/${listing.id}`);
  if (executive.workMovingNow.length > 0) {
    assert.match(String(executive.workMovingNow[0].href), new RegExp(`^/b/${workspaceId}/`));
  }
});

test("portfolio index matches home and detail metrics for same subject", async () => {
  const workspaceId = "ws_portfolio_index_consistency";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_index_consistency",
    displayName: "Index Consistency Listing",
    address: "1 Index Way",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Index Buyer",
      email: "index@example.com",
      message: "Index consistency inquiry",
      subjectId: listing.id,
    },
  });

  const ctx = buildCtx(stack);
  const index = buildBusinessSubjectPortfolioIndex({
    ctx,
    subjectTypes: SUBJECT_TYPES,
    businessId: workspaceId,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });
  const home = buildBusinessOperatingHomeView({
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
    businessId: workspaceId,
    subjectTypes: SUBJECT_TYPES,
  });
  const detail = buildSubjectOperatingDetail({
    subjectId: listing.id,
    ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  const indexRow = index.rows.find((row) => row.subjectId === listing.id);
  const homeRow = home.topProperties.find((row) => row.subjectId === listing.id);
  assert.ok(indexRow);
  assert.ok(homeRow);
  assert.equal(homeRow.inquiryCount, indexRow.inquiryCount);
  assert.equal(homeRow.interestedCount, indexRow.interestedCount);
  assert.equal(homeRow.openFollowUpCount, indexRow.openFollowUpCount);
  assert.equal(homeRow.latestActivityAt, indexRow.latestActivityAt);
  assert.equal(detail.metrics.inquiryCount, indexRow.inquiryCount);
  assert.equal(detail.metrics.interestedCount, indexRow.interestedCount);
  assert.equal(detail.metrics.openFollowUpCount, indexRow.openFollowUpCount);
  assert.equal(detail.metrics.latestActivityAt, indexRow.latestActivityAt);
});
