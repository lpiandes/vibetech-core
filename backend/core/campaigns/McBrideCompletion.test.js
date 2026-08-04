import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { PM_CAMPAIGN_TEMPLATES } from "../../../industries/property-management/config/campaignOperations.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "../../../industries/property-management/config/mcbrideClientTemplate.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { CONNECTION_EVENT_TYPES } from "../integrations/connections/ConnectionEventTypes.js";

import { CampaignPreparationService } from "./CampaignPreparationService.js";
import { CampaignDocumentService, buildExpectedApprovalBinding } from "./CampaignDocumentService.js";
import { CampaignDeliveryService } from "./CampaignDeliveryService.js";
import { DeterministicCampaignEmailProvider } from "./DeterministicCampaignEmailProvider.js";
import {
  selectCampaignKnowledgeDocuments,
  attachKnowledgeToCampaignDocument,
} from "./CampaignKnowledgeAssembler.js";
import {
  recordReferralIntroduction,
  ensureReferredByRelationship,
  buildReferralOperationsSummary,
  REFERRED_BY_RELATIONSHIP_TYPE,
} from "./ReferralLoopService.js";
import { buildMcBrideReadinessProjection } from "./McBrideReadinessProjection.js";
import { composeCampaignDraft } from "./CampaignDraftComposer.js";
import { createCampaignDocument } from "./CampaignDocument.js";

const NOW = "2026-07-10T12:00:00.000Z";
const BUSINESS_ID = "ws_mcbride_complete";

function stack() {
  return buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: BUSINESS_ID });
}

function seedParty(s, { id, name, email, optIn = true }) {
  s.businessGraphRuntime.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
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
    source: "test",
    payload: {
      relationship: {
        id: `rel_PROSPECT_${id}`,
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
  if (optIn && email) {
    s.communicationPreferenceRuntime.applyEvent({
      id: `evt_pref_${id}`,
      timestampISO: NOW,
      type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
      payload: {
        preference: {
          id: `pref_${id}_email_marketing`,
          partyId: id,
          workspaceId: BUSINESS_ID,
          channel: "email",
          scope: "marketing",
          status: "opt_in",
          source: "test",
          recordedAt: NOW,
        },
      },
    });
  }
}

function prepareApprovedCampaign(s, { optIn = true } = {}) {
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com", optIn });
  const prep = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");
  const knowledgeDocuments = [
    {
      id: "doc_ready",
      businessId: BUSINESS_ID,
      title: "Leasing guidance",
      status: "ready",
      categoryIds: ["PM_LEASING"],
      contentText: "Offer a private tour window and confirm desired move timing.",
    },
    {
      id: "doc_other_tenant",
      businessId: "other_business",
      title: "Foreign doc",
      status: "ready",
      categoryIds: ["PM_LEASING"],
      contentText: "Should never appear.",
    },
    {
      id: "doc_not_ready",
      businessId: BUSINESS_ID,
      title: "Draft only",
      status: "failed",
      categoryIds: ["PM_LEASING"],
      contentText: "Not ready.",
    },
  ];
  const result = prep.execute({
    stack: s,
    businessId: BUSINESS_ID,
    campaignTemplate: template,
    occurrenceKey: "complete",
    nowISO: NOW,
    knowledgeDocuments,
    knowledgeExpectations: MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE.knowledgeExpectations,
  });
  const binding = buildExpectedApprovalBinding(
    s.workRuntime.getWorkItem(result.workId).metadata.campaignPreparation,
    result.workId,
  );
  prep.approve({ stack: s, workId: result.workId, binding, nowISO: NOW });
  return { result, binding, template };
}

test("S2 knowledge: only ready same-tenant docs attach with provenance", () => {
  const selected = selectCampaignKnowledgeDocuments({
    documents: [
      { id: "a", businessId: "b1", status: "ready", title: "A", categoryIds: ["PM_LEASING"], contentText: "Alpha guidance text." },
      { id: "b", businessId: "b2", status: "ready", title: "B", categoryIds: ["PM_LEASING"], contentText: "Foreign." },
      { id: "c", businessId: "b1", status: "failed", title: "C", categoryIds: ["PM_LEASING"], contentText: "Not ready." },
    ],
    businessId: "b1",
    allowedCategoryIds: ["PM_LEASING"],
  });
  assert.deepEqual(selected.map((entry) => entry.id), ["a"]);
  assert.ok(selected[0].excerpt.includes("Alpha"));
});

test("S2 knowledge: compose attaches sources and no-doc truth remains honest", () => {
  const withDocs = composeCampaignDraft({
    template: PM_CAMPAIGN_TEMPLATES[0],
    audiencePreview: { included: [], excluded: [], excludedCount: 0, subject: null },
    nowISO: NOW,
    businessId: BUSINESS_ID,
    knowledgeDocuments: [{
      id: "doc1",
      businessId: BUSINESS_ID,
      status: "ready",
      title: "Market notes",
      categoryIds: ["PM_OWNER_COMMUNICATION"],
      contentText: "Inventory remains selective this month.",
    }],
    knowledgeExpectations: MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE.knowledgeExpectations,
  });
  assert.ok(withDocs.knowledgeSources.length >= 1);
  assert.ok(withDocs.knowledgeSummary.includes("approved knowledge"));

  const noDocs = composeCampaignDraft({
    template: PM_CAMPAIGN_TEMPLATES[0],
    audiencePreview: { included: [], excluded: [], excludedCount: 0, subject: null },
    nowISO: NOW,
    businessId: BUSINESS_ID,
    knowledgeDocuments: [],
  });
  assert.equal(noDocs.knowledgeSources.length, 0);
  assert.ok(noDocs.knowledgeSummary.includes("No Knowledge docs"));
});

test("S3 delivery: explicit send required, consent re-check, idempotent retry, missing provider truth", async () => {
  const s = stack();
  const { result, binding } = prepareApprovedCampaign(s);
  const delivery = new CampaignDeliveryService();

  const blocked = await delivery.executeSend({ stack: s, workId: result.workId, binding, nowISO: NOW });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "needs_setup_business_email");

  const provider = new DeterministicCampaignEmailProvider({ nowISO: NOW });
  const first = await delivery.executeSend({
    stack: s,
    workId: result.workId,
    binding,
    emailProvider: provider,
    nowISO: NOW,
  });
  assert.equal(first.ok, true);
  assert.equal(first.deliverySummary.counts.sent, 1);
  const messageId = first.deliveryRecords.find((record) => record.status === "sent").messageId;
  assert.equal(s.communicationRuntime.getMessage(messageId).status, "sent");

  const second = await delivery.executeSend({
    stack: s,
    workId: result.workId,
    binding,
    emailProvider: provider,
    nowISO: "2026-07-10T13:00:00.000Z",
  });
  assert.equal(second.deliverySummary.counts.sent, 1);
  assert.equal(second.deliveryRecords.filter((record) => record.status === "sent").length, 1);
});

test("S3 delivery: suppressed recipients are excluded and partial failure is visible", async () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com", optIn: true });
  seedParty(s, { id: "party_sam", name: "Sam Suppressed", email: "sam@example.com", optIn: true });
  const prep = new CampaignPreparationService();
  const prepared = prep.execute({
    stack: s,
    businessId: BUSINESS_ID,
    campaignTemplate: PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter"),
    occurrenceKey: "partial",
    nowISO: NOW,
  });
  const binding = buildExpectedApprovalBinding(
    s.workRuntime.getWorkItem(prepared.workId).metadata.campaignPreparation,
    prepared.workId,
  );
  prep.approve({ stack: s, workId: prepared.workId, binding, nowISO: NOW });

  // Consent changes after approval — send-time re-check must exclude Sam.
  s.communicationPreferenceRuntime.applyEvent({
    id: "evt_suppress_sam",
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    payload: {
      preference: {
        id: "pref_sam_email_marketing",
        partyId: "party_sam",
        workspaceId: BUSINESS_ID,
        channel: "email",
        scope: "marketing",
        status: "suppressed",
        source: "test",
        recordedAt: NOW,
      },
    },
  });

  const sent = await new CampaignDeliveryService().executeSend({
    stack: s,
    workId: prepared.workId,
    binding,
    emailProvider: new DeterministicCampaignEmailProvider({ nowISO: NOW }),
    nowISO: NOW,
  });
  assert.ok(sent.deliverySummary.counts.excluded >= 1);
  assert.ok(sent.deliverySummary.counts.sent >= 1);
});

test("S3 stale approval cannot send", async () => {
  const s = stack();
  const { result, binding } = prepareApprovedCampaign(s);
  new CampaignDocumentService().updateDocument({
    stack: s,
    workId: result.workId,
    subjectLine: "Changed after approval",
    nowISO: "2026-07-10T14:00:00.000Z",
  });
  const send = await new CampaignDeliveryService().executeSend({
    stack: s,
    workId: result.workId,
    binding,
    emailProvider: new DeterministicCampaignEmailProvider({ nowISO: NOW }),
    nowISO: NOW,
  });
  assert.equal(send.ok, false);
  assert.equal(send.reason, "not_approved");
});

test("S6 referral loop records REFERRED_BY and refuses vague identity", () => {
  const s = stack();
  seedParty(s, { id: "party_referrer", name: "Pat Past", email: "pat@example.com" });
  seedParty(s, { id: "party_intro", name: "New Person", email: "new@example.com" });

  const unresolved = recordReferralIntroduction({
    stack: s,
    referrerPartyId: "party_referrer",
    introducedDisplayName: "someone from work",
    nowISO: NOW,
  });
  assert.equal(unresolved.unresolved, true);
  assert.equal(unresolved.reason, "insufficient_identity_evidence");

  const recorded = recordReferralIntroduction({
    stack: s,
    referrerPartyId: "party_referrer",
    introducedPartyId: "party_intro",
    nowISO: NOW,
  });
  assert.equal(recorded.ok, true);
  const rel = s.businessGraphRuntime.getRelationship(recorded.relationshipId);
  assert.equal(rel.relationshipType, REFERRED_BY_RELATIONSHIP_TYPE);
  const summary = buildReferralOperationsSummary({ stack: s });
  assert.equal(summary.introductionsRecorded, 1);
  assert.ok(summary.openReferralWork >= 1);
});

test("S7 readiness distinguishes ready, needs attention, and deferred", () => {
  const s = stack();
  seedParty(s, { id: "party_alex", name: "Alex", email: "alex@example.com" });
  const readiness = buildMcBrideReadinessProjection({
    businessId: BUSINESS_ID,
    stack: s,
    knowledgeDocumentCount: 0,
    membershipCount: 0,
    integrationPlatform: null,
  });
  assert.equal(readiness.launchState, "Not ready");
  assert.ok(readiness.checks.some((check) => check.id === "sms" && check.status === "deferred"));
  assert.ok(readiness.checks.some((check) => check.id === "appfolio" && check.status === "deferred"));
  assert.ok(readiness.checks.some((check) => check.id === "missed_call" && check.status === "deferred"));
  assert.ok(readiness.checks.some((check) => check.id === "business_email" && check.status === "needs_attention"));
  for (const check of readiness.checks) {
    const blob = `${check.label} ${check.why} ${check.nextAction}`;
    assert.doesNotMatch(blob, /BusinessSubject|REFERRED_BY|business graph|PM_LEASING|mock\/dev/i);
    assert.ok(check.nextAction);
  }
});

test("S8 acceptance spine: prepare → knowledge → approve → send → referral", async () => {
  const s = stack();
  const { result, binding } = prepareApprovedCampaign(s);
  const campaign = s.workRuntime.getWorkItem(result.workId).metadata.campaignPreparation;
  assert.ok(campaign.knowledgeSources?.length >= 1 || campaign.knowledgeSummary.includes("No approved") || campaign.knowledgeSummary.includes("approved"));
  assert.equal(s.communicationRuntime.getMessage(result.messageId).status, "queued");

  const delivery = await new CampaignDeliveryService().executeSend({
    stack: s,
    workId: result.workId,
    binding,
    emailProvider: new DeterministicCampaignEmailProvider({ nowISO: NOW }),
    nowISO: NOW,
  });
  assert.equal(delivery.ok, true);
  assert.ok(delivery.deliverySummary.counts.sent >= 1);

  seedParty(s, { id: "party_referrer", name: "Referrer", email: "ref@example.com" });
  seedParty(s, { id: "party_intro", name: "Introduced", email: "intro@example.com" });
  const referral = ensureReferredByRelationship({
    stack: s,
    introducedPartyId: "party_intro",
    referrerPartyId: "party_referrer",
    nowISO: NOW,
  });
  assert.equal(referral.ok, true);
});
