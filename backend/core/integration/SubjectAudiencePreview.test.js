import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../integration/ProspectInquiryOperatingLoopService.js";
import { RecordBusinessSubjectService } from "../business-subject/RecordBusinessSubjectService.js";
import { updateBusinessSubjectStatus } from "../business-subject/updateBusinessSubjectStatus.js";
import { buildSubjectInterestSegmentCriteria } from "../segments/buildSubjectInterestSegmentCriteria.js";
import { projectSegmentMembership } from "../segments/SegmentProjectionEngine.js";
import { buildSubjectAudiencePreview } from "../segments/views/buildSubjectAudiencePreview.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "../persistence/RuntimeSnapshotKinds.js";
import { stablePartyIdFromEmail } from "../integration/prospectPartySetup.js";

const NOW = "2026-07-07T20:30:00.000Z";

function buildActivation(workspaceId, companyName = "Audience Preview Co") {
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
    companyName: "Audience Preview Co",
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

function buildPreview(stack, subjectId) {
  return buildSubjectAudiencePreview({
    subjectId,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    interactionRuntime: stack.interactionRuntime,
    presentation: {
      interactionOutcomes: stack.installationResult?.interactionOutcomes ?? [],
    },
    nowISO: NOW,
  });
}

function segmentMemberIds(stack, subjectId) {
  const criteria = buildSubjectInterestSegmentCriteria(subjectId);
  const projection = projectSegmentMembership({
    segmentDefinition: { id: "seg_check", targetEntityType: "Party", criteria },
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    interactionRuntime: stack.interactionRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
  });
  return projection.members.map((m) => m.entityId).sort();
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

test("one inquiry for Property A places person in Property A audience", async () => {
  const workspaceId = "ws_audience_one";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_harbor",
    displayName: "742 Harbor Lane",
    address: "742 Harbor Ln",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jane Smith",
      email: "jane@example.com",
      message: "Interested in harbor lane",
      subjectId: listing.id,
    },
  });

  const preview = buildPreview(stack, listing.id);
  assert.equal(preview.audience.totalCount, 1);
  assert.equal(preview.audience.members[0].displayName, "Jane Smith");
  assert.equal(preview.audience.members[0].email, "jane@example.com");
  assert.deepEqual(
    preview.audience.members.map((m) => m.partyId).sort(),
    segmentMemberIds(stack, listing.id),
  );
});

test("same person interested in Property A and B appears in both audiences", async () => {
  const workspaceId = "ws_audience_multi";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listingA = seedListing(stack, { id: "subj_a", displayName: "Property A", address: "1 A St" });
  const listingB = seedListing(stack, { id: "subj_b", displayName: "Property B", address: "2 B St" });
  const partyId = stablePartyIdFromEmail("jordan@example.com");

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      message: "Interested in A",
      subjectId: listingA.id,
      submissionId: "sub_a",
    },
  });
  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      message: "Also interested in B",
      subjectId: listingB.id,
      submissionId: "sub_b",
    },
  });

  const previewA = buildPreview(stack, listingA.id);
  const previewB = buildPreview(stack, listingB.id);
  assert.ok(previewA.audience.members.some((m) => m.partyId === partyId));
  assert.ok(previewB.audience.members.some((m) => m.partyId === partyId));
  assert.equal(previewA.audience.totalCount, 1);
  assert.equal(previewB.audience.totalCount, 1);
});

test("person interested only in Property A never appears in Property B audience", async () => {
  const workspaceId = "ws_audience_isolation_ab";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listingA = seedListing(stack, { id: "subj_only_a", displayName: "Only A", address: "A" });
  const listingB = seedListing(stack, { id: "subj_only_b", displayName: "Only B", address: "B" });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Solo A",
      email: "solo.a@example.com",
      message: "Only A",
      subjectId: listingA.id,
    },
  });

  const previewB = buildPreview(stack, listingB.id);
  assert.equal(previewB.audience.totalCount, 0);
  assert.equal(previewB.audience.members.length, 0);
});

test("repeated inquiries for same person and property yield one audience member with latest activity", async () => {
  const workspaceId = "ws_audience_dedupe";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, { id: "subj_dedupe", displayName: "Dedupe House", address: "Dedupe" });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Prospect A",
      email: "prospect.a@example.com",
      message: "First message",
      subjectId: listing.id,
      submissionId: "dup_1",
    },
  });
  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Prospect A",
      email: "prospect.a@example.com",
      message: "Second message",
      subjectId: listing.id,
      submissionId: "dup_2",
    },
  });

  const preview = buildPreview(stack, listing.id);
  assert.equal(preview.audience.totalCount, 1);
  assert.equal(preview.audience.members[0].displayName, "Prospect A");
  assert.ok(preview.audience.members[0].evidence.filter((e) => e.type === "REQUEST").length >= 2);
});

test("historical audience survives subject status active to inactive", async () => {
  const workspaceId = "ws_audience_inactive";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, { id: "subj_sold", displayName: "Sold House", address: "Sold" });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Morgan Buyer",
      email: "morgan@example.com",
      message: "Want showing",
      subjectId: listing.id,
    },
  });

  assert.equal(buildPreview(stack, listing.id).audience.totalCount, 1);

  updateBusinessSubjectStatus({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    subjectId: listing.id,
    status: "inactive",
    nowISO: NOW,
  });

  const preview = buildPreview(stack, listing.id);
  assert.equal(preview.subject.status, "inactive");
  assert.equal(preview.audience.totalCount, 1);
});

test("audience preview survives destroy-and-rehydrate via runtime snapshots", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const workspaceId = "ws_audience_restart";
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

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  const runtimeSnapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT]);

  const rehydrated = activateWorkspace({
    workspaceId,
    activation: buildActivation(workspaceId),
    nowISO: NOW,
    runtimeSnapshots,
  });

  const preview = buildSubjectAudiencePreview({
    subjectId: listing.id,
    businessSubjectRuntime: rehydrated.operatingStack.businessSubjectRuntime,
    businessGraphRuntime: rehydrated.operatingStack.businessGraphRuntime,
    requestRuntime: rehydrated.operatingStack.requestRuntime,
    interactionRuntime: rehydrated.operatingStack.interactionRuntime,
    presentation: {
      interactionOutcomes: rehydrated.operatingStack.installationResult?.interactionOutcomes ?? [],
    },
    nowISO: NOW,
  });

  assert.equal(preview.audience.totalCount, 1);
  assert.equal(preview.audience.members[0].email, "restart@example.com");
});

test("tenant B cannot preview tenant A subject audience", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const a = buildOperatingStack("ws_audience_tenant_a");
  const bId = "ws_audience_tenant_b";
  const listing = seedListing(a.stack, {
    id: "subj_tenant_a",
    displayName: "Tenant A Listing",
    address: "Tenant A",
  });

  await runInquiry({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.stack.workspaceId,
    inquiry: {
      name: "Tenant A Prospect",
      email: "tenant.a@example.com",
      message: "Tenant A only",
      subjectId: listing.id,
    },
  });

  await persistAffectedRuntimes({
    workspaceId: a.stack.workspaceId,
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  const bSnapshots = await loadRuntimeSnapshotsMap(bId, persistence);
  const bRehydrated = activateWorkspace({
    workspaceId: bId,
    activation: buildActivation(bId, "Tenant B"),
    nowISO: NOW,
    runtimeSnapshots: bSnapshots,
  });

  const preview = buildSubjectAudiencePreview({
    subjectId: listing.id,
    businessSubjectRuntime: bRehydrated.operatingStack.businessSubjectRuntime,
    businessGraphRuntime: bRehydrated.operatingStack.businessGraphRuntime,
    requestRuntime: bRehydrated.operatingStack.requestRuntime,
    interactionRuntime: bRehydrated.operatingStack.interactionRuntime,
    nowISO: NOW,
  });

  assert.equal(preview, null);
});

test("subject with no interested people returns valid empty audience", () => {
  const { stack } = buildOperatingStack("ws_audience_empty");
  const listing = seedListing(stack, {
    id: "subj_empty",
    displayName: "Empty Listing",
    address: "Empty",
  });

  const preview = buildPreview(stack, listing.id);
  assert.equal(preview.audience.totalCount, 0);
  assert.deepEqual(preview.audience.members, []);
  assert.ok(preview.audience.explanation);
});
