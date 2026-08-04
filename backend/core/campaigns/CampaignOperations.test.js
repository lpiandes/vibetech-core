import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { exportRuntimeSnapshots } from "../persistence/exportRuntimeSnapshots.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { WorkViewAdapter } from "../work/views/WorkViewAdapter.js";
import { PM_CAMPAIGN_TEMPLATES, PM_RECURRING_OPERATION_DEFINITIONS } from "../../../industries/property-management/config/campaignOperations.js";

import { buildCampaignAudiencePreview } from "./CampaignAudienceProjection.js";
import { buildCampaignOperationsView } from "./CampaignOperationsProjection.js";
import { CampaignPreparationService } from "./CampaignPreparationService.js";
import { materializeDueRecurringOperations, recurringOperationStatus } from "./RecurringOperationService.js";

const NOW = "2026-07-01T00:00:00.000Z";
const BUSINESS_ID = "ws_campaigns";

function stack(runtimeSnapshots = {}) {
  return buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: BUSINESS_ID, runtimeSnapshots });
}

function snapshotMap(s) {
  return Object.fromEntries(
    exportRuntimeSnapshots({
      stack: s,
      integrationPlatform: null,
      kinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    }).map((snapshot) => [snapshot.kind, snapshot.state]),
  );
}

function seedParty(s, { id, name, email, relationshipType = "PROSPECT" }) {
  s.businessGraphRuntime.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "campaign_test",
    payload: {
      party: {
        id,
        partyType: "PERSON",
        displayName: name,
        status: "active",
        contactMethods: email ? [email] : [],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  s.businessGraphRuntime.applyEvent({
    id: `evt_rel_${id}_${relationshipType}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "campaign_test",
    payload: {
      relationship: {
        id: `rel_${id}_${relationshipType}`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: id }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" }),
        relationshipType,
        status: "active",
        effectiveFrom: NOW,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function seedSubject(s, { id = "subj_123", name = "123 main st" } = {}) {
  s.businessSubjectRuntime.applyEvent({
    id: `evt_subject_${id}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "campaign_test",
    payload: {
      subject: {
        id,
        workspaceId: BUSINESS_ID,
        subjectType: "property",
        displayName: name,
        status: "active",
        keyAttributes: { address: name },
        externalReferences: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return id;
}

function linkInterest(s, partyId, subjectId) {
  s.businessGraphRuntime.applyEvent({
    id: `evt_interest_${partyId}_${subjectId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "campaign_test",
    payload: {
      relationship: {
        id: `rel_interest_${partyId}_${subjectId}`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
        relationshipType: "INTERESTED_IN",
        status: "active",
        effectiveFrom: NOW,
        effectiveTo: null,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function suppress(s, partyId) {
  s.communicationPreferenceRuntime.applyEvent({
    id: `evt_suppress_${partyId}`,
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    payload: {
      preference: {
        id: `pref_${partyId}_email_marketing`,
        partyId,
        workspaceId: BUSINESS_ID,
        channel: "email",
        scope: "marketing",
        status: "suppressed",
        source: "test",
        recordedAt: NOW,
      },
    },
  });
}

function seedRequest(s, { id, requester, requestType = "MAINTENANCE_REQUEST", subjectId = null }) {
  s.requestRuntime.applyEvent({
    id: `evt_request_${id}`,
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "campaign_test",
    payload: {
      request: {
        id,
        title: "Request",
        description: "Request history",
        requestType,
        status: "received",
        priority: "medium",
        channel: "website",
        source: "test",
        requester,
        receivedAt: NOW,
        subjectRefs: subjectId ? [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })] : [],
        metadata: {},
      },
    },
  });
}

function seedAudienceStack() {
  const s = stack();
  const subjectId = seedSubject(s);
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  seedParty(s, { id: "party_unrelated", name: "Una Related", email: "una@example.com" });
  seedParty(s, { id: "party_suppressed", name: "Sam Suppressed", email: "sam@example.com" });
  linkInterest(s, "party_alex", subjectId);
  linkInterest(s, "party_suppressed", subjectId);
  suppress(s, "party_suppressed");
  return { s, subjectId };
}

test("weekly operation materializes exactly one due occurrence and does not duplicate on rerun", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });

  const first = materializeDueRecurringOperations({
    stack: s,
    businessId: BUSINESS_ID,
    operationDefinitions: [PM_RECURRING_OPERATION_DEFINITIONS[0]],
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: NOW,
  });
  const second = materializeDueRecurringOperations({
    stack: s,
    businessId: BUSINESS_ID,
    operationDefinitions: [PM_RECURRING_OPERATION_DEFINITIONS[0]],
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: NOW,
  });

  assert.equal(first.results[0].materialized, true);
  assert.equal(second.results[0].idempotent, true);
  assert.equal(s.workRuntime.getWorkItems().filter((work) => work.metadata?.campaignPreparation).length, 1);
  assert.equal(s.communicationRuntime.getMessages().length, 1);
});

test("restart preserves campaign preparation state through Work and Communication snapshots", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  materializeDueRecurringOperations({
    stack: s,
    businessId: BUSINESS_ID,
    operationDefinitions: [PM_RECURRING_OPERATION_DEFINITIONS[0]],
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: NOW,
  });

  const restarted = stack(snapshotMap(s));
  const rerun = materializeDueRecurringOperations({
    stack: restarted,
    businessId: BUSINESS_ID,
    operationDefinitions: [PM_RECURRING_OPERATION_DEFINITIONS[0]],
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: NOW,
  });

  assert.equal(rerun.results[0].idempotent, true);
  assert.equal(restarted.workRuntime.getWorkItems().filter((work) => work.metadata?.campaignPreparation).length, 1);
});

test("paused and future recurring operations do not materialize work", () => {
  const s = stack();
  const paused = { ...PM_RECURRING_OPERATION_DEFINITIONS[0], id: "paused_newsletter", enabled: false };
  const future = { ...PM_RECURRING_OPERATION_DEFINITIONS[0], id: "future_newsletter", startsAt: "2026-08-01T00:00:00.000Z" };
  const result = materializeDueRecurringOperations({
    stack: s,
    businessId: BUSINESS_ID,
    operationDefinitions: [paused, future],
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: NOW,
  });

  assert.deepEqual(result.results.map((entry) => entry.reason), ["paused", "not_due"]);
  assert.equal(s.workRuntime.getWorkItems().length, 0);
});

test("property-interest audience includes exact interest, excludes unrelated and suppressed, and does not mutate state", () => {
  const { s, subjectId } = seedAudienceStack();
  const beforeWork = s.workRuntime.exportState();
  const audience = buildCampaignAudiencePreview({
    stack: s,
    subjectId,
    audience: { type: "subject_interest" },
    channel: "email",
  });

  assert.deepEqual(audience.included.map((entry) => entry.partyId), ["party_alex"]);
  assert.equal(audience.excluded.some((entry) => entry.partyId === "party_suppressed"), true);
  assert.equal(audience.included.some((entry) => entry.partyId === "party_unrelated"), false);
  assert.equal(s.workRuntime.exportState(), beforeWork);
});

test("newsletter audience requires relationship-marketing evidence and excludes maintenance-only request history", () => {
  const { s, subjectId } = seedAudienceStack();
  seedParty(s, { id: "party_maintenance", name: "another issue", email: "maintenance@example.com", relationshipType: "RESIDENT" });
  seedRequest(s, { id: "req_maintenance", requester: "party_maintenance" });
  const newsletter = PM_CAMPAIGN_TEMPLATES.find((template) => template.id === "weekly_newsletter");
  const audience = buildCampaignAudiencePreview({
    stack: s,
    audience: newsletter.audience,
    channel: "email",
  });
  const propertyAudience = buildCampaignAudiencePreview({
    stack: s,
    subjectId,
    audience: { type: "subject_interest" },
    channel: "email",
  });

  assert.equal(audience.included.some((entry) => entry.partyId === "party_alex"), true);
  assert.equal(audience.included.some((entry) => entry.partyId === "party_maintenance"), false);
  assert.equal(propertyAudience.included.map((entry) => entry.partyId).join(","), "party_alex");
});

test("foreign-business subject cannot enter another business audience", () => {
  const local = stack();
  const foreign = stack();
  const foreignSubjectId = seedSubject(foreign);
  seedParty(local, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  linkInterest(foreign, "party_alex", foreignSubjectId);

  const audience = buildCampaignAudiencePreview({
    stack: local,
    subjectId: foreignSubjectId,
    audience: { type: "subject_interest" },
    channel: "email",
  });

  assert.equal(audience.includedCount, 0);
});

test("campaign draft keeps property reference, uses evidence-backed personalization, and queues only after approval", () => {
  const { s, subjectId } = seedAudienceStack();
  const service = new CampaignPreparationService();
  const propertyTemplate = PM_CAMPAIGN_TEMPLATES.find((template) => template.id === "property_announcement");
  const result = service.execute({
    stack: s,
    businessId: BUSINESS_ID,
    campaignTemplate: propertyTemplate,
    subjectId,
    occurrenceKey: "manual",
    nowISO: NOW,
  });

  const work = s.workRuntime.getWorkItem(result.workId);
  const message = s.communicationRuntime.getMessage(result.messageId);
  assert.equal(work.metadata.campaignPreparation.subject.id, subjectId);
  assert.equal(work.metadata.campaignPreparation.recipientPreparations[0].partyId, "party_alex");
  assert.equal(message.status, "draft");
  assert.equal(message.sentAt, null);

  service.approve({ stack: s, workId: result.workId, nowISO: NOW });
  assert.equal(s.workRuntime.getWorkItem(result.workId).status, "approved");
  assert.equal(s.communicationRuntime.getMessage(result.messageId).status, "queued");
  assert.equal(s.communicationRuntime.getMessage(result.messageId).sentAt, null);
});

test("prepare returns exact canonical work id and same logical request is idempotent", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  const service = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");

  const first = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, occurrenceKey: "2026-07-09", nowISO: "2026-07-09T12:00:00.000Z" });
  const second = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, occurrenceKey: "2026-07-09", nowISO: "2026-07-09T12:01:00.000Z" });

  assert.equal(first.workId, "work_campaign_manual_weekly_newsletter_2026_07_09");
  assert.equal(second.workId, first.workId);
  assert.equal(second.idempotent, true);
  assert.equal(s.workRuntime.getWorkItems().filter((work) => work.metadata?.campaignPreparation?.campaignTemplateId === "weekly_newsletter").length, 1);
});

test("property campaign idempotency is scoped by selected BusinessSubject context", () => {
  const { s, subjectId } = seedAudienceStack();
  const secondSubjectId = seedSubject(s, { id: "subj_456", name: "456 oak ave" });
  linkInterest(s, "party_alex", secondSubjectId);
  const service = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "property_announcement");

  const first = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, subjectId, occurrenceKey: "2026-07-09", nowISO: "2026-07-09T12:00:00.000Z" });
  const duplicate = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, subjectId, occurrenceKey: "2026-07-09", nowISO: "2026-07-09T12:02:00.000Z" });
  const otherSubject = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, subjectId: secondSubjectId, occurrenceKey: "2026-07-09", nowISO: "2026-07-09T12:03:00.000Z" });

  assert.equal(duplicate.workId, first.workId);
  assert.equal(duplicate.idempotent, true);
  assert.notEqual(otherSubject.workId, first.workId);
  assert.equal(s.workRuntime.getWorkItems().filter((work) => work.metadata?.campaignPreparation?.campaignTemplateId === "property_announcement").length, 2);
});

test("different recurring occurrences create distinct canonical preparation work", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  const service = new CampaignPreparationService();
  const operation = PM_RECURRING_OPERATION_DEFINITIONS.find((entry) => entry.id === "weekly_client_newsletter");
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");

  const first = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, operation, occurrenceKey: "2026-07-08", nowISO: "2026-07-09T12:00:00.000Z" });
  const second = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, operation, occurrenceKey: "2026-07-15", nowISO: "2026-07-15T12:00:00.000Z" });

  assert.notEqual(second.workId, first.workId);
  assert.equal(s.workRuntime.getWorkItems().filter((work) => work.metadata?.campaignPreparation?.operationId === "weekly_client_newsletter").length, 2);
});

test("selected campaign Work view exposes draft content and delivery truth before approval", () => {
  const { s, subjectId } = seedAudienceStack();
  const service = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "property_announcement");
  const result = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, subjectId, occurrenceKey: "manual", nowISO: NOW });
  const vm = new WorkViewAdapter({ nowISO: NOW }).translate({
    workRuntime: s.workRuntime,
    teamRuntime: s.teamRuntime,
    companyRuntime: s.companyRuntime,
    businessGraphRuntime: s.businessGraphRuntime,
    businessSubjectRuntime: s.businessSubjectRuntime,
    requestRuntime: s.requestRuntime,
    communicationRuntime: s.communicationRuntime,
    businessId: BUSINESS_ID,
  });
  const item = vm.items.find((entry) => entry.id === result.workId);
  const campaign = item.metadata.campaignPreparation;

  assert.equal(campaign.campaignName, "Property campaign");
  assert.equal(campaign.subject.displayName, "123 main st");
  assert.equal(campaign.recipientPreparations[0].subject, "123 main st: property update");
  assert.ok(campaign.recipientPreparations[0].body.includes("123 main st"));
  assert.equal(campaign.communicationStatus, "draft");

  service.approve({ stack: s, workId: result.workId, nowISO: NOW });
  const afterApprove = new WorkViewAdapter({ nowISO: NOW }).translate({
    workRuntime: s.workRuntime,
    teamRuntime: s.teamRuntime,
    companyRuntime: s.companyRuntime,
    businessGraphRuntime: s.businessGraphRuntime,
    businessSubjectRuntime: s.businessSubjectRuntime,
    requestRuntime: s.requestRuntime,
    communicationRuntime: s.communicationRuntime,
    businessId: BUSINESS_ID,
  }).items.find((entry) => entry.id === result.workId);
  assert.equal(afterApprove.metadata.campaignPreparation.approvalStatus, "approved");
  assert.equal(afterApprove.metadata.campaignPreparation.communicationStatus, "queued");
  assert.equal(afterApprove.metadata.campaignPreparation.sentAt, null);
});

test("campaign approval refuses invisible or empty campaign content", () => {
  const s = stack();
  const service = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");
  const result = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, occurrenceKey: "manual", nowISO: NOW });

  assert.equal(service.approve({ stack: s, workId: result.workId, nowISO: NOW }).reason, "campaign_review_not_ready");
  assert.equal(s.communicationRuntime.getMessage(result.messageId).status, "draft");
});

test("recurring operation nextDue advances after materialized weekly and monthly occurrences", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  materializeDueRecurringOperations({
    stack: s,
    businessId: BUSINESS_ID,
    operationDefinitions: PM_RECURRING_OPERATION_DEFINITIONS.slice(0, 2),
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: "2026-07-09T12:00:00.000Z",
  });
  const status = recurringOperationStatus({
    operationDefinitions: PM_RECURRING_OPERATION_DEFINITIONS.slice(0, 2),
    workRuntime: s.workRuntime,
    nowISO: "2026-07-09T12:00:00.000Z",
  });

  assert.deepEqual(
    status.map((entry) => [entry.id, entry.lastOccurrence, entry.nextDueAt]),
    [
      ["weekly_client_newsletter", "2026-07-08", "2026-07-15"],
      ["monthly_market_update", "2026-07-01", "2026-08-01"],
    ],
  );

  const restarted = stack(snapshotMap(s));
  assert.deepEqual(
    recurringOperationStatus({
      operationDefinitions: PM_RECURRING_OPERATION_DEFINITIONS.slice(0, 2),
      workRuntime: restarted.workRuntime,
      nowISO: "2026-07-09T12:00:00.000Z",
    }).map((entry) => [entry.id, entry.lastOccurrence, entry.nextDueAt]),
    [
      ["weekly_client_newsletter", "2026-07-08", "2026-07-15"],
      ["monthly_market_update", "2026-07-01", "2026-08-01"],
    ],
  );
});

test("recurring operation status prefers active review work over approved history", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  const service = new CampaignPreparationService();
  const operation = PM_RECURRING_OPERATION_DEFINITIONS.find((entry) => entry.id === "weekly_client_newsletter");
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");
  const approved = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, operation, occurrenceKey: "2026-07-08", nowISO: "2026-07-08T12:00:00.000Z" });
  service.approve({ stack: s, workId: approved.workId, nowISO: "2026-07-08T13:00:00.000Z" });
  const review = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, operation, occurrenceKey: "2026-07-15", nowISO: "2026-07-15T12:00:00.000Z" });

  const status = recurringOperationStatus({
    operationDefinitions: [operation],
    workRuntime: s.workRuntime,
    nowISO: "2026-07-16T12:00:00.000Z",
  })[0];

  assert.equal(status.workId, review.workId);
  assert.equal(status.status, "review_required");
  assert.equal(status.lastOccurrence, "2026-07-15");
});

test("property campaign requires a business subject selection and previews Alex through INTERESTED_IN", () => {
  const { s, subjectId } = seedAudienceStack();
  const service = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "property_announcement");
  assert.throws(
    () => service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, occurrenceKey: "manual", nowISO: NOW }),
    /subjectId required/,
  );
  assert.throws(
    () => service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: template, subjectId: "foreign_subject", occurrenceKey: "manual", nowISO: NOW }),
    /subject does not exist/,
  );

  const view = buildCampaignOperationsView({
    businessId: BUSINESS_ID,
    stack: s,
    operationDefinitions: PM_RECURRING_OPERATION_DEFINITIONS,
    campaignTemplates: PM_CAMPAIGN_TEMPLATES,
    nowISO: NOW,
  });
  const propertyTemplate = view.templates.find((entry) => entry.id === "property_announcement");
  const subjectPreview = propertyTemplate.subjectAudiencePreviews.find((entry) => entry.subject.id === subjectId);
  assert.equal(propertyTemplate.audienceCount, null);
  assert.equal(propertyTemplate.emptyAudienceExplanation, "Select a property to evaluate the audience.");
  assert.equal(subjectPreview.audienceCount, 1);
  assert.equal(subjectPreview.includedPreview[0].partyId, "party_alex");
});

test("CMA and referral templates include guardrails and require actual relationship evidence", () => {
  const s = stack();
  seedParty(s, { id: "party_past", name: "Pat Past", email: "pat@example.com", relationshipType: "PAST_BUYER" });
  const service = new CampaignPreparationService();
  const cma = PM_CAMPAIGN_TEMPLATES.find((template) => template.id === "cma_home_value");
  const referral = PM_CAMPAIGN_TEMPLATES.find((template) => template.id === "referral_outreach");

  const cmaResult = service.execute({ stack: s, businessId: BUSINESS_ID, campaignTemplate: cma, occurrenceKey: "cma", nowISO: NOW });
  const referralAudience = buildCampaignAudiencePreview({ stack: s, audience: referral.audience, channel: "email" });

  assert.ok(s.communicationRuntime.getMessage(cmaResult.messageId).body.includes("not a formal appraisal"));
  assert.equal(referralAudience.includedCount, 1);
  assert.equal(referralAudience.included[0].partyId, "party_past");
});

test("newsletter audience includes People CRM leads with email without graph marketing relationship", () => {
  const s = stack();
  const audience = buildCampaignAudiencePreview({
    stack: s,
    audience: { type: "all_marketable_contacts" },
    channel: "email",
    crmContacts: [
      { id: "contact_tim", name: "Tim", email: "tim@example.com", kind: "lead" },
      { id: "contact_emp", name: "Staff", email: "staff@example.com", kind: "employee" },
    ],
  });
  assert.equal(audience.included.some((entry) => entry.partyId === "contact_tim"), true);
  assert.equal(audience.included.some((entry) => entry.partyId === "contact_emp"), false);
  assert.equal(audience.included.find((entry) => entry.partyId === "contact_tim")?.email, "tim@example.com");
});
