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
import { queryPartiesInterestedInSubject } from "../business-subject/queryPartiesInterestedInSubject.js";
import { projectSegmentMembership } from "../segments/SegmentProjectionEngine.js";
import { buildCommunicationThreadDetail } from "../communications/views/buildCommunicationThreadDetail.js";
import { WorkViewAdapter } from "../work/views/WorkViewAdapter.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "../persistence/RuntimeSnapshotKinds.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { stablePartyIdFromEmail } from "../integration/prospectPartySetup.js";

const NOW = "2026-07-07T18:00:00.000Z";

function buildActivation(workspaceId, companyName = "Property Loop Co") {
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
    companyName: "Property Loop Co",
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
  return { stack, integrationPlatform, demoConfiguration };
}

function seedListing(stack, { id, displayName, address }) {
  return new RecordBusinessSubjectService().execute({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    workspaceId: stack.workspaceId,
    subjectInput: {
      id,
      subjectType: "listing",
      displayName,
      keyAttributes: { address },
    },
    nowISO: NOW,
    source: "test",
  });
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

test("create listing and inquiry tied to exact property retains attribution in work and inbox detail", async () => {
  const workspaceId = "ws_property_attribution";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_123_main",
    displayName: "123 Main Street",
    address: "123 Main St, Springfield",
  });

  const result = await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Taylor Prospect",
      email: "taylor@example.com",
      message: "Interested in 123 Main.",
      subjectId: listing.id,
    },
  });

  assert.equal(result.ok, true);
  const request = stack.requestRuntime.getRequest(result.requestId);
  assert.equal(request.subjectRefs[0].entityId, listing.id);
  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 1);

  const workVm = new WorkViewAdapter({ nowISO: NOW }).translate({
    workRuntime: stack.workRuntime,
    teamRuntime: stack.teamRuntime,
    companyRuntime: stack.companyRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    requestRuntime: stack.requestRuntime,
    presentation: PROPERTY_MANAGEMENT_PACKAGE.presentation,
  });
  const workItem = workVm.items[0];
  assert.equal(workItem.metadata.display.subjectId, listing.id);
  assert.equal(workItem.metadata.display.subjectName, "123 Main Street");

  const detail = buildCommunicationThreadDetail({
    threadId: `ct_ack_${result.requestId}`,
    communicationRuntime: stack.communicationRuntime,
    requestRuntime: stack.requestRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    interactionRuntime: stack.interactionRuntime,
  });
  assert.equal(detail.subject.id, listing.id);
  assert.equal(detail.subject.displayName, "123 Main Street");
});

test("inquiry without property and one person interested in multiple properties", async () => {
  const workspaceId = "ws_multi_property_interest";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listingA = seedListing(stack, {
    id: "subj_alpha",
    displayName: "Alpha Listing",
    address: "1 Alpha Rd",
  });
  const listingB = seedListing(stack, {
    id: "subj_beta",
    displayName: "Beta Listing",
    address: "2 Beta Rd",
  });

  const noProperty = await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      message: "General inquiry",
    },
  });
  assert.equal(noProperty.ok, true);
  assert.equal(stack.requestRuntime.getRequest(noProperty.requestId).subjectRefs.length, 0);

  const inquiryA = await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      message: "Interested in Alpha",
      subjectId: listingA.id,
      submissionId: "sub_alpha",
    },
  });
  const inquiryB = await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      message: "Also interested in Beta",
      subjectId: listingB.id,
      submissionId: "sub_beta",
    },
  });
  assert.equal(inquiryA.ok, true);
  assert.equal(inquiryB.ok, true);

  const partyId = stablePartyIdFromEmail("jordan@example.com");
  assert.ok(queryPartiesInterestedInSubject({ businessGraphRuntime: stack.businessGraphRuntime, subjectId: listingA.id }).includes(partyId));
  assert.ok(queryPartiesInterestedInSubject({ businessGraphRuntime: stack.businessGraphRuntime, subjectId: listingB.id }).includes(partyId));
  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 2);
});

test("listing status change preserves historical interest and segment queries", async () => {
  const workspaceId = "ws_listing_status_history";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_sold_house",
    displayName: "Sold House",
    address: "9 Sold Ln",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Morgan Buyer",
      email: "morgan@example.com",
      message: "Want a showing",
      subjectId: listing.id,
    },
  });

  const partyId = stablePartyIdFromEmail("morgan@example.com");
  const interestedBefore = queryPartiesInterestedInSubject({
    businessGraphRuntime: stack.businessGraphRuntime,
    subjectId: listing.id,
  });
  assert.deepEqual(interestedBefore, [partyId]);

  updateBusinessSubjectStatus({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    subjectId: listing.id,
    status: "inactive",
    nowISO: NOW,
  });
  assert.equal(stack.businessSubjectRuntime.getSubject(listing.id).status, "inactive");
  assert.deepEqual(
    queryPartiesInterestedInSubject({ businessGraphRuntime: stack.businessGraphRuntime, subjectId: listing.id }),
    [partyId],
  );

  const segment = stack.segmentDefinitionRuntime.getDefinitions().find((d) => d.id === "interested_in_subject");
  const membership = projectSegmentMembership({
    segmentDefinition: {
      ...segment,
      criteria: [{ fieldPath: "subjectIds", operator: "IN", value: [listing.id] }],
    },
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    interactionRuntime: stack.interactionRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
  });
  assert.equal(membership.members.length, 1);
  assert.equal(membership.members[0].entityId, partyId);

  new RecordInteractionService({ interactionPlatformEventPublisher: stack.osInteractionPublisher }).execute({
    interactionRuntime: stack.interactionRuntime,
    interactionInput: {
      id: "int_showing_done",
      interactionType: "visit",
      direction: "inbound",
      channel: "in_person",
      occurredAt: NOW,
      participants: [{ partyId, participantType: "primary" }],
      relatedObjects: [
        createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: listing.id }),
      ],
      ownerId: "pm_resident_prospect_coordinator",
      status: "completed",
      summary: "Showing completed",
      metadata: {},
    },
    noteText: "Tour completed",
    noteAuthorId: "pm_resident_prospect_coordinator",
    noteTimestampISO: NOW,
    outcome: "showing_requested",
    nextStep: "showing_requested",
    followUpAt: null,
    nowISO: NOW,
    metadata: {},
  });

  const withoutShowing = projectSegmentMembership({
    segmentDefinition: {
      ...segment,
      criteria: [
        { fieldPath: "subjectIds", operator: "IN", value: [listing.id] },
        { fieldPath: "latestOutcome", operator: "NOT_EQUALS", value: "showing_requested" },
      ],
    },
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    interactionRuntime: stack.interactionRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
  });
  assert.equal(withoutShowing.members.length, 0);
});

test("repeated inquiry events do not duplicate canonical listing records", async () => {
  const workspaceId = "ws_no_duplicate_subjects";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_unique",
    displayName: "Unique Listing",
    address: "44 Unique Ave",
  });

  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "First",
      email: "first@example.com",
      message: "First inquiry",
      subjectId: listing.id,
      submissionId: "dup_1",
    },
  });
  await runInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    inquiry: {
      name: "Second",
      email: "second@example.com",
      message: "Second inquiry",
      subjectId: listing.id,
      submissionId: "dup_2",
    },
  });

  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 1);
  assert.equal(stack.businessSubjectRuntime.getSubject(listing.id).displayName, "Unique Listing");
});

test("property attribution survives destroy-and-rehydrate via businessSubject snapshots", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const workspaceId = "ws_property_restart";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  const listing = seedListing(stack, {
    id: "subj_restart_listing",
    displayName: "Restart Listing",
    address: "77 Restart Rd",
  });

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    persistence,
  });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Restart Prospect",
      email: "restart@example.com",
      message: "Interested after restart",
      subjectId: listing.id,
    },
  });
  assert.equal(result.ok, true);

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  const runtimeSnapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT]);
  assert.equal(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT].subjects.length, 1);

  const rehydrated = activateWorkspace({
    workspaceId,
    activation: buildActivation(workspaceId),
    nowISO: NOW,
    runtimeSnapshots,
  });

  const hydratedListing = rehydrated.operatingStack.businessSubjectRuntime.getSubject(listing.id);
  assert.ok(hydratedListing);
  assert.equal(hydratedListing.displayName, "Restart Listing");

  const request = rehydrated.operatingStack.requestRuntime.getRequest(result.requestId);
  assert.equal(request.subjectRefs[0].entityId, listing.id);

  const detail = buildCommunicationThreadDetail({
    threadId: `ct_ack_${result.requestId}`,
    communicationRuntime: rehydrated.operatingStack.communicationRuntime,
    requestRuntime: rehydrated.operatingStack.requestRuntime,
    businessGraphRuntime: rehydrated.operatingStack.businessGraphRuntime,
    businessSubjectRuntime: rehydrated.operatingStack.businessSubjectRuntime,
    interactionRuntime: rehydrated.operatingStack.interactionRuntime,
  });
  assert.equal(detail.subject.displayName, "Restart Listing");
});

test("tenant B has no property snapshots after tenant A listing and inquiry", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const a = buildOperatingStack("ws_property_tenant_a");
  const bId = "ws_property_tenant_b";

  const listing = seedListing(a.stack, {
    id: "subj_tenant_a_only",
    displayName: "Tenant A Listing",
    address: "1 Tenant A",
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
    activation: buildActivation(bId, "Tenant B Co"),
    nowISO: NOW,
    runtimeSnapshots: bSnapshots,
  });

  assert.equal(bRehydrated.operatingStack.businessSubjectRuntime.getSubjects().length, 0);
  assert.equal(bRehydrated.operatingStack.requestRuntime.getRequests().length, 0);
});
