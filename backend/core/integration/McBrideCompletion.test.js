import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { queryPartiesInterestedInSubject } from "../business-subject/queryPartiesInterestedInSubject.js";
import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { PM_CAMPAIGN_TEMPLATES } from "../../../industries/property-management/config/campaignOperations.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "../../../industries/property-management/config/mcbrideClientTemplate.js";

import { CampaignPreparationService } from "../campaigns/CampaignPreparationService.js";
import { CampaignDocumentService, buildExpectedApprovalBinding } from "../campaigns/CampaignDocumentService.js";
import { CampaignDeliveryService } from "../campaigns/CampaignDeliveryService.js";
import { DeterministicCampaignEmailProvider } from "../campaigns/DeterministicCampaignEmailProvider.js";
import {
  recordReferralIntroduction,
  REFERRED_BY_RELATIONSHIP_TYPE,
} from "../campaigns/ReferralLoopService.js";
import { buildMcBrideReadinessProjection } from "../campaigns/McBrideReadinessProjection.js";
import { buildCampaignOperationsView } from "../campaigns/CampaignOperationsProjection.js";

const NOW = "2026-07-10T15:00:00.000Z";
const BUSINESS_ID = "ws_mcbride_acceptance";

function stack() {
  return buildPropertyManagementWorkspaceStack({ nowISO: NOW, workspaceId: BUSINESS_ID });
}

function seedParty(s, { id, name, email, relationshipType = "PROSPECT", optIn = true }) {
  s.businessGraphRuntime.applyEvent({
    id: `evt_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "mcbride_acceptance",
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
    source: "mcbride_acceptance",
    payload: {
      relationship: {
        id: `rel_${relationshipType}_${id}`,
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
          source: "mcbride_acceptance",
          recordedAt: NOW,
        },
      },
    });
  }
}

function seedSubject(s, { id = "subj_harbor", name = "12 Harbor View" } = {}) {
  s.businessSubjectRuntime.applyEvent({
    id: `evt_subject_${id}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "mcbride_acceptance",
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
    source: "mcbride_acceptance",
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

/**
 * Proves the McBride operating spine end-to-end without snapshot-only assertions:
 * CRM/person → property → INTERESTED_IN → campaign document → Knowledge →
 * approval → explicit delivery truth → referral → readiness.
 */
test("McBride acceptance spine: CRM → property → campaign → knowledge → approve → send → referral → readiness", async () => {
  const s = stack();

  // A. CRM / people — multiple classifications + consent truth
  seedParty(s, { id: "party_alex", name: "Alex Morgan", email: "alex@example.com", relationshipType: "PROSPECT" });
  seedParty(s, { id: "party_pat", name: "Pat Past", email: "pat@example.com", relationshipType: "REFERRAL_SOURCE" });
  seedParty(s, { id: "party_owner", name: "Olivia Owner", email: "olivia@example.com", relationshipType: "OWNER" });
  assert.equal(s.businessGraphRuntime.getParty("party_alex").displayName, "Alex Morgan");
  assert.ok(s.communicationPreferenceRuntime.getPreferences().some((pref) => pref.partyId === "party_alex" && pref.status === "opt_in"));

  // B. Properties — BusinessSubject + INTERESTED_IN + interested-person projection
  const subjectId = seedSubject(s, { id: "subj_harbor", name: "12 Harbor View" });
  linkInterest(s, "party_alex", subjectId);
  assert.equal(s.businessSubjectRuntime.getSubject(subjectId).displayName, "12 Harbor View");
  const interested = queryPartiesInterestedInSubject({
    businessGraphRuntime: s.businessGraphRuntime,
    subjectId,
  });
  assert.deepEqual(interested, ["party_alex"]);
  const interestRels = s.businessGraphRuntime.getRelationships().filter((rel) => rel.relationshipType === "INTERESTED_IN");
  assert.equal(interestRels.length, 1);
  assert.equal(interestRels[0].fromEntity.entityId, "party_alex");
  assert.equal(interestRels[0].toEntity.entityId, subjectId);

  // D/E. Campaign Studio prepare with Knowledge (ready, same-tenant only)
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
      id: "doc_foreign",
      businessId: "other_business",
      title: "Foreign",
      status: "ready",
      categoryIds: ["PM_LEASING"],
      contentText: "Must not appear.",
    },
    {
      id: "doc_draft",
      businessId: BUSINESS_ID,
      title: "Not ready",
      status: "failed",
      categoryIds: ["PM_LEASING"],
      contentText: "Must not appear.",
    },
  ];
  const prep = new CampaignPreparationService();
  const template = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");
  const prepared = prep.execute({
    stack: s,
    businessId: BUSINESS_ID,
    campaignTemplate: template,
    occurrenceKey: "acceptance",
    nowISO: NOW,
    knowledgeDocuments,
    knowledgeExpectations: MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE.knowledgeExpectations,
  });
  assert.equal(prepared.ok, true);
  const docs = new CampaignDocumentService();
  const beforeEdit = docs.getCampaignWork(s, prepared.workId);
  assert.equal(beforeEdit.ok, true);
  assert.ok(beforeEdit.campaign.document?.sections?.length >= 1 || beforeEdit.document?.sections?.length >= 1);
  const beforeDoc = beforeEdit.document ?? beforeEdit.campaign.document;
  assert.ok(beforeDoc?.sections?.length >= 1);
  assert.ok(beforeEdit.campaign.knowledgeSources?.some((source) => source.id === "doc_ready"));
  assert.ok(!beforeEdit.campaign.knowledgeSources?.some((source) => source.id === "doc_foreign"));
  assert.ok(beforeEdit.campaign.knowledgeSummary.includes("approved knowledge")
    || beforeEdit.campaign.knowledgeSources?.length >= 1);

  // D. Editable studio — subject edit bumps version/hash; audience fingerprint present
  const edited = docs.updateDocument({
    stack: s,
    workId: prepared.workId,
    subjectLine: "McBride weekly — Harbor View",
    previewText: "This week’s listings and follow-ups",
    nowISO: "2026-07-10T15:05:00.000Z",
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.contentVersion, beforeDoc.contentVersion + 1);
  assert.notEqual(edited.contentHash, beforeDoc.contentHash);
  assert.ok(edited.audienceFingerprint || beforeEdit.campaign.audienceFingerprint);

  const afterEdit = docs.getCampaignWork(s, prepared.workId);
  const binding = buildExpectedApprovalBinding(afterEdit.campaign, prepared.workId);
  assert.equal(binding.contentVersion, afterEdit.document.contentVersion);
  assert.equal(binding.contentHash, afterEdit.document.contentHash);
  assert.equal(binding.audienceFingerprint, afterEdit.campaign.audienceFingerprint);

  // D. Approval bound to exact content + audience
  const approved = prep.approve({ stack: s, workId: prepared.workId, binding, nowISO: "2026-07-10T15:10:00.000Z" });
  assert.equal(approved.ok, true);
  assert.equal(s.communicationRuntime.getMessage(binding.messageId).status, "queued");

  // F. Explicit send — provider-backed; no silent send; idempotent
  const deliveryService = new CampaignDeliveryService();
  const needsSetup = await deliveryService.executeSend({
    stack: s,
    workId: prepared.workId,
    binding,
    nowISO: "2026-07-10T15:15:00.000Z",
  });
  assert.equal(needsSetup.ok, false);
  assert.equal(needsSetup.reason, "needs_setup_business_email");

  const provider = new DeterministicCampaignEmailProvider({ nowISO: "2026-07-10T15:20:00.000Z" });
  const sent = await deliveryService.executeSend({
    stack: s,
    workId: prepared.workId,
    binding,
    emailProvider: provider,
    nowISO: "2026-07-10T15:20:00.000Z",
  });
  assert.equal(sent.ok, true);
  assert.ok(sent.deliverySummary.counts.sent >= 1);
  assert.ok(Array.isArray(sent.deliveryRecords));
  assert.ok(sent.deliveryRecords.every((record) => ["sent", "failed", "excluded"].includes(record.status)));
  assert.equal(Object.prototype.hasOwnProperty.call(sent.deliverySummary.counts, "opens"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sent.deliverySummary.counts, "clicks"), false);

  const retry = await deliveryService.executeSend({
    stack: s,
    workId: prepared.workId,
    binding,
    emailProvider: provider,
    nowISO: "2026-07-10T15:25:00.000Z",
  });
  assert.equal(retry.deliverySummary.counts.sent, sent.deliverySummary.counts.sent);

  // G. Referral — known parties only; vague names do not create people
  const vague = recordReferralIntroduction({
    stack: s,
    referrerPartyId: "party_pat",
    introducedDisplayName: "someone from work",
    nowISO: "2026-07-10T15:30:00.000Z",
  });
  assert.equal(vague.unresolved, true);
  assert.equal(vague.reason, "insufficient_identity_evidence");
  assert.equal(s.businessGraphRuntime.getParties().filter((p) => /someone/i.test(p.displayName)).length, 0);

  seedParty(s, { id: "party_intro", name: "New Neighbor", email: "neighbor@example.com", relationshipType: "PROSPECT" });
  const referral = recordReferralIntroduction({
    stack: s,
    referrerPartyId: "party_pat",
    introducedPartyId: "party_intro",
    nowISO: "2026-07-10T15:35:00.000Z",
  });
  assert.equal(referral.ok, true);
  const referred = s.businessGraphRuntime.getRelationship(referral.relationshipId);
  assert.equal(referred.relationshipType, REFERRED_BY_RELATIONSHIP_TYPE);
  const retryReferral = recordReferralIntroduction({
    stack: s,
    referrerPartyId: "party_pat",
    introducedPartyId: "party_intro",
    nowISO: "2026-07-10T15:40:00.000Z",
  });
  assert.equal(retryReferral.ok, true);
  assert.ok(retryReferral.duplicate === true || retryReferral.relationshipId === referral.relationshipId);

  // H. Readiness — client-readable statuses; deferred capabilities honest
  const readiness = buildMcBrideReadinessProjection({
    businessId: BUSINESS_ID,
    stack: s,
    knowledgeDocuments,
    knowledgeDocumentCount: 1,
    membershipCount: 2,
    subjectCount: 1,
  });
  assert.ok(["Ready", "Ready with deferred capabilities", "Not ready"].includes(readiness.launchState));
  for (const check of readiness.checks) {
    assert.ok(["ready", "needs_attention", "not_configured", "deferred"].includes(check.status));
    assert.ok(check.nextAction);
    const blob = `${check.label} ${check.why} ${check.nextAction}`;
    assert.doesNotMatch(blob, /BusinessSubject|REFERRED_BY|business graph|PM_LEASING|mock\/dev/i);
  }
  assert.ok(readiness.checks.some((check) => check.id === "sms" && check.status === "deferred"));
  assert.ok(readiness.checks.some((check) => check.id === "appfolio" && check.status === "deferred"));
  assert.ok(readiness.checks.some((check) => check.id === "inbound_website" && check.status === "deferred"));
  assert.ok(readiness.checks.some((check) => check.id === "missed_call" && check.status === "deferred"));

  // Performance projection exposes delivery truth without inventing opens/clicks
  const ops = buildCampaignOperationsView({ stack: s, businessId: BUSINESS_ID });
  const text = JSON.stringify(ops);
  assert.doesNotMatch(text, /"opens"\s*:\s*[1-9]/);
  assert.doesNotMatch(text, /"clicks"\s*:\s*[1-9]/);
});
