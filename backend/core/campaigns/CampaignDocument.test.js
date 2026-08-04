import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeContentHash,
  createCampaignDocument,
  createCampaignSection,
  createApprovalBinding,
  approvalBindingsMatch,
  normalizeCampaignDocumentFromPreparation,
  messageIdForContentVersion,
} from "./CampaignDocument.js";
import { buildRecipientPreparations, previewCampaignForRecipient } from "./CampaignDocumentRenderer.js";
import { composeCampaignDraft } from "./CampaignDraftComposer.js";
import { CampaignDocumentService, buildExpectedApprovalBinding } from "./CampaignDocumentService.js";
import { CampaignPreparationService } from "./CampaignPreparationService.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { PM_CAMPAIGN_TEMPLATES } from "../../../industries/property-management/config/campaignOperations.js";
import { exportRuntimeSnapshots } from "../persistence/exportRuntimeSnapshots.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

const NOW = "2026-07-01T00:00:00.000Z";
const BUSINESS_ID = "ws_campaign_studio";

function stack(runtimeSnapshots = {}) {
  return buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: BUSINESS_ID, runtimeSnapshots });
}

function seedParty(s, { id, name, email }) {
  s.businessGraphRuntime.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "studio_test",
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
    id: `evt_rel_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "studio_test",
    payload: {
      relationship: {
        id: `rel_${id}_prospect`,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: id }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" }),
        relationshipType: "PROSPECT",
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

function prepareNewsletter(s) {
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com" });
  const service = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");
  return service.execute({
    stack: s,
    businessId: BUSINESS_ID,
    campaignTemplate: template,
    occurrenceKey: "studio",
    nowISO: NOW,
  });
}

test("editing bumps contentVersion and contentHash", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const docs = new CampaignDocumentService();
  const before = docs.getCampaignWork(s, prepared.workId).document;
  const updated = docs.updateDocument({
    stack: s,
    workId: prepared.workId,
    subjectLine: "Edited subject",
    nowISO: "2026-07-01T01:00:00.000Z",
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.contentVersion, before.contentVersion + 1);
  assert.notEqual(updated.contentHash, before.contentHash);
});

test("reordering sections changes the hash deterministically", () => {
  const sections = [
    createCampaignSection({ id: "a", type: "intro", order: 0, fields: { body: "A" } }),
    createCampaignSection({ id: "b", type: "custom_text", order: 1, fields: { body: "B" } }),
  ];
  const hashA = computeContentHash({ subjectLine: "S", sections });
  const reordered = [
    createCampaignSection({ id: "b", type: "custom_text", order: 0, fields: { body: "B" } }),
    createCampaignSection({ id: "a", type: "intro", order: 1, fields: { body: "A" } }),
  ];
  const hashB = computeContentHash({ subjectLine: "S", sections: reordered });
  assert.notEqual(hashA, hashB);
  assert.equal(computeContentHash({ subjectLine: "S", sections: reordered }), hashB);
});

test("identical saved content remains idempotent", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const docs = new CampaignDocumentService();
  const loaded = docs.getCampaignWork(s, prepared.workId);
  const first = docs.updateDocument({
    stack: s,
    workId: prepared.workId,
    subjectLine: loaded.document.subjectLine,
    previewText: loaded.document.previewText,
    sections: loaded.document.sections,
    nowISO: "2026-07-01T01:00:00.000Z",
  });
  assert.equal(first.idempotent, true);
  assert.equal(first.contentVersion, loaded.document.contentVersion);
});

test("approval binds to exact version hash audience and message", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const campaign = s.workRuntime.getWorkItem(prepared.workId).metadata.campaignPreparation;
  const expected = buildExpectedApprovalBinding(campaign, prepared.workId);
  assert.equal(expected.workId, prepared.workId);
  assert.equal(expected.messageId, prepared.messageId);
  assert.ok(expected.contentHash);
  assert.ok(expected.audienceFingerprint);
  const ok = new CampaignPreparationService().approve({
    stack: s,
    workId: prepared.workId,
    binding: expected,
    nowISO: NOW,
  });
  assert.equal(ok.ok, true);
  assert.equal(s.communicationRuntime.getMessage(prepared.messageId).status, "queued");
  assert.equal(s.communicationRuntime.getMessage(prepared.messageId).sentAt, null);
});

test("editing after approval creates a new draft version and leaves queued message unchanged", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const prep = new CampaignPreparationService();
  const docs = new CampaignDocumentService();
  const binding = buildExpectedApprovalBinding(
    s.workRuntime.getWorkItem(prepared.workId).metadata.campaignPreparation,
    prepared.workId,
  );
  prep.approve({ stack: s, workId: prepared.workId, binding, nowISO: NOW });
  const queuedBefore = s.communicationRuntime.getMessage(prepared.messageId);
  assert.equal(queuedBefore.status, "queued");

  const updated = docs.updateDocument({
    stack: s,
    workId: prepared.workId,
    subjectLine: "Post-approval edit",
    nowISO: "2026-07-01T02:00:00.000Z",
  });
  assert.equal(updated.forkedFromApproved, true);
  assert.notEqual(updated.messageId, prepared.messageId);
  assert.equal(s.communicationRuntime.getMessage(prepared.messageId).status, "queued");
  assert.equal(s.communicationRuntime.getMessage(prepared.messageId).subject, queuedBefore.subject);
  assert.equal(s.communicationRuntime.getMessage(updated.messageId).status, "draft");
  assert.equal(s.workRuntime.getWorkItem(prepared.workId).status, "review_required");
});

test("stale approval binding is rejected", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const docs = new CampaignDocumentService();
  const stale = buildExpectedApprovalBinding(
    s.workRuntime.getWorkItem(prepared.workId).metadata.campaignPreparation,
    prepared.workId,
  );
  docs.updateDocument({
    stack: s,
    workId: prepared.workId,
    subjectLine: "Changed before approve",
    nowISO: "2026-07-01T01:30:00.000Z",
  });
  const result = new CampaignPreparationService().approve({
    stack: s,
    workId: prepared.workId,
    binding: stale,
    nowISO: "2026-07-01T01:31:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "stale_approval_binding");
});

test("audience refresh invalidates approval when fingerprint changes", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const prep = new CampaignPreparationService();
  const docs = new CampaignDocumentService();
  const binding = buildExpectedApprovalBinding(
    s.workRuntime.getWorkItem(prepared.workId).metadata.campaignPreparation,
    prepared.workId,
  );
  prep.approve({ stack: s, workId: prepared.workId, binding, nowISO: NOW });

  seedParty(s, { id: "party_blake", name: "Blake New", email: "blake@example.com" });
  const refreshed = docs.refreshAudience({
    stack: s,
    workId: prepared.workId,
    campaignTemplate: PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter"),
    nowISO: "2026-07-01T03:00:00.000Z",
  });
  assert.equal(refreshed.fingerprintChanged, true);
  assert.equal(refreshed.approvalInvalidated, true);
  assert.equal(s.workRuntime.getWorkItem(prepared.workId).status, "review_required");
  assert.equal(s.communicationRuntime.getMessage(prepared.messageId).status, "queued");
});

test("recipient preview uses canonical evidence", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  const preview = new CampaignDocumentService().preview({
    stack: s,
    workId: prepared.workId,
    partyId: "party_alex",
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.preview.found, true);
  assert.ok(String(preview.preview.body).includes("Alex") || String(preview.preview.body).includes("Hi"));
  assert.ok(Array.isArray(preview.preview.personalizationSummary));
});

test("existing flat campaign preparations still load safely", () => {
  const flat = {
    campaignTemplateId: "weekly_newsletter",
    campaignName: "Weekly",
    cta: "Reply please",
    recipientPreparations: [{ partyId: "p1", displayName: "Pat", email: "p@x.com", subject: "Hello", body: "Body text" }],
    workId: "work_legacy",
  };
  const document = normalizeCampaignDocumentFromPreparation(flat);
  assert.equal(document.subjectLine, "Hello");
  assert.ok(document.sections.length >= 1);
  assert.equal(document.contentVersion, 1);
});

test("message version ids are deterministic and package compose has no provider send", () => {
  assert.equal(messageIdForContentVersion("cm_campaign_x", 1), "cm_campaign_x");
  assert.equal(messageIdForContentVersion("cm_campaign_x", 2), "cm_campaign_x_v2");
  const draft = composeCampaignDraft({
    template: PM_CAMPAIGN_TEMPLATES[0],
    audiencePreview: { included: [], excluded: [], excludedCount: 0, subject: null },
    nowISO: NOW,
  });
  assert.equal(draft.communicationStatus, "draft");
  assert.ok(draft.document.sections.length > 0);
  assert.ok(draft.knowledgeSummary.includes("No Knowledge docs"));
});

test("restart preserves studio document through work and communication snapshots", () => {
  const s = stack();
  const prepared = prepareNewsletter(s);
  new CampaignDocumentService().updateDocument({
    stack: s,
    workId: prepared.workId,
    subjectLine: "Persisted subject",
    nowISO: "2026-07-01T04:00:00.000Z",
  });
  const snapshots = Object.fromEntries(
    exportRuntimeSnapshots({
      stack: s,
      integrationPlatform: null,
      kinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.COMMUNICATION],
    }).map((snapshot) => [snapshot.kind, snapshot.state]),
  );
  const restarted = stack(snapshots);
  const campaign = restarted.workRuntime.getWorkItem(prepared.workId).metadata.campaignPreparation;
  assert.equal(campaign.document.subjectLine, "Persisted subject");
  assert.ok(campaign.contentVersion >= 2);
});

test("approvalBindingsMatch requires exact fields", () => {
  const a = createApprovalBinding({
    workId: "w1",
    messageId: "m1",
    contentVersion: 2,
    contentHash: "abc",
    audienceFingerprint: "fp",
  });
  assert.equal(approvalBindingsMatch(a, { ...a }), true);
  assert.equal(approvalBindingsMatch(a, { ...a, contentHash: "other" }), false);
});
