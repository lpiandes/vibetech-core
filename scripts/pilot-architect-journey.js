#!/usr/bin/env node
/**
 * Production-parity Architect → install → invites → access → improve journey.
 * Uses product services only (no demo/Horizon shortcuts).
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool, withClient } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { bootstrapPlatformAdmin, hashPassword } from "../backend/core/platform/services/AuthCredentialService.js";
import { createAndDeliverInvitation } from "../backend/core/platform/services/invitationService.default.js";
import { MEMBERSHIP_ROLES } from "../backend/core/platform/permissions/rolePermissions.js";
import { authorizeBusinessAccess, AuthorizationError } from "../backend/core/platform/authorizeBusinessAccess.js";
import { AiBuilderService } from "../backend/core/ai-builder/AiBuilderService.js";
import { BuilderSessionRepository } from "../backend/core/ai-builder/BuilderSessionRepository.js";
import { ContinuousBusinessBuilderService } from "../backend/core/ai-builder/ContinuousBusinessBuilderService.js";
import { createDurableAccessRequestService } from "../backend/core/access-requests/AccessRequestService.js";
import { applyAccessRequestMembershipGrant } from "../backend/core/access-requests/applyAccessRequestMembershipGrant.js";
import { createKnowledgeStorageProvider } from "../backend/core/platform/knowledge/createKnowledgeStorageProvider.js";
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/platformBusinessService.default.js";
import { PostgresWorkspacePersistence } from "../backend/core/persistence/PostgresWorkspacePersistence.js";
import { setWorkspacePersistence, loadRuntimeSnapshotsMap } from "../backend/core/persistence/createWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../backend/core/persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../backend/core/persistence/RuntimeSnapshotKinds.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../backend/core/workspace/activation/activateWorkspace.js";
import { REQUEST_EVENT_TYPES } from "../backend/core/request/RequestEventTypes.js";
import { WORK_EVENT_TYPES } from "../backend/core/work/WorkEventTypes.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../backend/core/business-graph/BusinessGraphEventTypes.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../backend/core/business-subject/BusinessSubjectEventTypes.js";
import { INTERACTION_EVENT_TYPES } from "../backend/core/interactions/InteractionEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../backend/core/references/EntityRef.js";
import { ensurePartySubjectRelationship } from "../backend/core/business-graph/partySubjectRelationship.js";
import { BusinessIntelligenceEvaluationService } from "../backend/core/business-intelligence/evaluation/BusinessIntelligenceEvaluationService.js";
import { resetDefaultBusinessIntelligenceDefinitionRegistryForTests } from "../backend/core/business-intelligence/definitions/BusinessIntelligenceDefinitionRegistry.js";
import { registerDefaultBusinessIntelligenceDefinitions } from "../backend/core/business-intelligence/registerDefaultBusinessIntelligenceDefinitions.js";
import { IntelligenceToWorkConversionService } from "../backend/core/business-intelligence/conversion/IntelligenceToWorkConversionService.js";
import {
  buildIntelligenceCandidateArchitectBrief,
  formatArchitectCandidateReply,
} from "../backend/core/business-intelligence/conversion/IntelligenceArchitectExplanation.js";
import { explainCandidateMemory, buildBusinessMemoryTimeline } from "../backend/core/business-intelligence/memory/BusinessMemoryTimeline.js";
import { projectOwnerAttention } from "../backend/core/command-center/OwnerAttentionProjection.js";
import { projectIntelligenceCandidates } from "../backend/core/business-intelligence/candidates/IntelligenceCandidateProjection.js";

const suffix = Date.now();
const storageRoot = process.env.KNOWLEDGE_STORAGE_ROOT
  ?? path.join(root, ".dev", "pilot-knowledge-storage");
process.env.KNOWLEDGE_STORAGE_ROOT = storageRoot;
fs.mkdirSync(storageRoot, { recursive: true });

function step(label) {
  console.log(`→ ${label}`);
}

await runMigrations();

step("Admin bootstrap");
const admin = await bootstrapPlatformAdmin({
  email: `pilot-admin-${suffix}@vtechdevelopment.com`,
  password: `PilotAdmin-${suffix}!`,
  name: "Pilot Admin",
});

const builder = new AiBuilderService({
  repository: new BuilderSessionRepository({ platformStore }),
  platformStore,
});

step("Architect — create new business session");
const started = await builder.startSession({
  mode: "new_business",
  actorId: admin.user.id,
  businessName: `Pilot Co ${suffix}`,
  description: "Property management company needing leasing, maintenance, and owner reporting.",
});
const sessionId = started.session.sessionId;

step("Architect interview");
for (const [questionId, answer] of [
  ["q_company_name", `Pilot Co ${suffix}`],
  ["q_industry", "property management"],
  ["q_services", "leasing, maintenance, owner reporting"],
  ["q_customers", "property owners and residents"],
  ["q_roles", "owner, manager, leasing agent"],
  ["q_repetitive_work", "maintenance follow-ups and owner updates"],
  ["q_approvals", "lease offers and vendor spend"],
  ["q_pain_points", "manual coordination across email and spreadsheets"],
  ["q_desired_outcomes", "one Mission Control for the living business"],
]) {
  await builder.answer({ sessionId, questionId, answer });
}

step("Website research");
try {
  await builder.research({
    sessionId,
    websiteUrl: "https://vtechdevelopment.com",
    manualFallbackText: "VIBETech builds operating systems for real businesses.",
  });
} catch (err) {
  console.log(`  research soft-fail: ${err instanceof Error ? err.message : err}`);
}

step("Upload documents (durable object storage)");
const upload = await builder.upload({
  sessionId,
  filename: "pilot-handbook.txt",
  mimeType: "text/plain",
  textPreview: "Pilot SOP: respond to maintenance tickets within 4 hours.",
  contentBase64: Buffer.from("Pilot SOP: respond to maintenance tickets within 4 hours.", "utf8").toString("base64"),
});
if (!upload.ok) throw new Error("Upload failed");

step("Generate proposal / Business OS");
const proposed = await builder.propose({ sessionId });
if (!proposed.ok) throw new Error(`Propose failed: ${proposed.reason ?? "unknown"}`);

step("Preview portal");
await builder.portalPreview({ sessionId, membershipRole: "OWNER" });

step("Dry run → approve → install");
const dry = await builder.dryRun({ sessionId });
if (!dry.ok) throw new Error(`Dry run failed: ${dry.reason ?? "unknown"}`);
const approved = await builder.approve({ sessionId, actorId: admin.user.id });
if (!approved.ok) throw new Error(`Approve failed: ${approved.reason ?? "unknown"}`);
const installed = await builder.install({ sessionId, actorId: admin.user.id });
if (!installed.ok) throw new Error(`Install failed: ${installed.reason ?? "unknown"}`);
const businessId = installed.session?.businessId ?? installed.openHref?.match(/\/b\/([^/]+)/)?.[1];
if (!businessId || String(businessId).startsWith("draft_")) {
  throw new Error(`Install did not register a platform business: ${businessId}`);
}
const businessRow = await platformStore.getBusinessById(businessId);
if (!businessRow) throw new Error("Installed business missing from platform store");

step("Invite owner + accept");
const ownerEmail = `pilot-owner-${suffix}@example.com`;
const ownerInvite = await createAndDeliverInvitation({
  businessId,
  email: ownerEmail,
  role: MEMBERSHIP_ROLES.OWNER,
  invitedByUserId: admin.user.id,
  inviterRole: MEMBERSHIP_ROLES.OWNER,
  businessName: businessRow.name,
});
const owner = await platformStore.createUser({
  email: ownerEmail,
  name: "Pilot Owner",
  passwordHash: await hashPassword("PilotOwner-123!"),
});
await platformStore.acceptInvitation({ invitationId: ownerInvite.invitation.id, userId: owner.id });

step("Invite employee + accept");
const employeeEmail = `pilot-employee-${suffix}@example.com`;
const employeeInvite = await createAndDeliverInvitation({
  businessId,
  email: employeeEmail,
  role: MEMBERSHIP_ROLES.EMPLOYEE,
  invitedByUserId: owner.id,
  inviterRole: MEMBERSHIP_ROLES.OWNER,
  businessName: businessRow.name,
});
const employee = await platformStore.createUser({
  email: employeeEmail,
  name: "Pilot Employee",
  passwordHash: await hashPassword("PilotEmployee-123!"),
});
await platformStore.acceptInvitation({ invitationId: employeeInvite.invitation.id, userId: employee.id });

step("Access request → owner approval");
const access = createDurableAccessRequestService(platformStore);
const req = await access.requestAccess({
  businessId,
  requesterUserId: employee.id,
  requestKind: "module",
  requestedModuleId: "performance",
  reason: "Need performance for weekly report",
});
if (!req.ok) throw new Error("Access request failed");
const decided = await access.decide({
  businessId,
  accessRequestId: req.accessRequest.accessRequestId,
  actorUserId: owner.id,
  actorRole: MEMBERSHIP_ROLES.OWNER,
  decision: "approved",
  membershipUpdater: async (grant) => {
    await applyAccessRequestMembershipGrant(platformStore, { ...grant, approverUserId: owner.id });
  },
});
if (!decided.ok) throw new Error("Access approval failed");

step("Restart recovery for access requests");
const access2 = createDurableAccessRequestService(platformStore);
const listed = await access2.store.list(businessId);
if (!listed.some((row) => row.accessRequestId === req.accessRequest.accessRequestId && row.status === "approved")) {
  throw new Error("Access request did not survive service recreation");
}

step("Ask VIBETech / improve → structural change → dry run → approve → install revision");
const continuous = new ContinuousBusinessBuilderService({ aiBuilder: builder });
const improve = await continuous.startImprovement({
  businessId,
  actorId: owner.id,
  installedSpecification: proposed.specification,
  prompt: "Improve this business",
});
if (!improve.ok) throw new Error(`Improve failed: ${improve.reason ?? "unknown"}`);
const improveSessionId = improve.session.sessionId;
const changeChat = await builder.chat({
  sessionId: improveSessionId,
  text: "We hired another leasing agent",
});
if (!changeChat.ok) throw new Error(`Change chat failed: ${changeChat.reason ?? "unknown"}`);
if (changeChat.status === "unsupported") {
  throw new Error("Expected structural hire change to be supported");
}
if (!changeChat.proposal && changeChat.status !== "needs_information") {
  // matched proposals attach proposal view
  if (changeChat.status !== "matched" && !changeChat.specification) {
    throw new Error(`Expected matched change proposal, got ${changeChat.status}`);
  }
}
const improveDry = await builder.dryRun({ sessionId: improveSessionId });
if (!improveDry.ok) throw new Error(`Improve dry-run failed: ${improveDry.reason ?? "unknown"}`);
const improveApproved = await builder.approve({ sessionId: improveSessionId, actorId: owner.id });
if (!improveApproved.ok) throw new Error(`Improve approve failed: ${improveApproved.reason ?? "unknown"}`);
const improveInstalled = await builder.install({ sessionId: improveSessionId, actorId: owner.id });
if (!improveInstalled.ok) throw new Error(`Improve install failed: ${improveInstalled.reason ?? "unknown"}`);

step("Verify change persisted after reload");
const reloadedOs = await platformStore.getBusinessOSInstallation(businessId);
if (!reloadedOs || reloadedOs.status !== "installed") {
  throw new Error("Installed OS missing after structural change");
}
const reloadedSpec = await platformStore.getBusinessOSSpecification({
  businessId,
  specificationId: reloadedOs.specificationId,
  specificationVersion: reloadedOs.specificationVersion,
});
const employees = reloadedSpec?.specification?.employeeDefinitions ?? [];
if (!employees.some((entry) => /leasing/i.test(String(entry.label ?? "")))) {
  throw new Error("Expected leasing agent employee definition after approved change");
}

step("Tenant isolation");
const otherBiz = await createBusinessWithOwnerInvite({
  name: `Other Pilot ${suffix}`,
  ownerEmail: `other-owner-${suffix}@example.com`,
  createdByUserId: admin.user.id,
});
let denied = false;
try {
  await authorizeBusinessAccess({ userId: owner.id, businessId: otherBiz.business.id });
} catch (err) {
  denied = err instanceof AuthorizationError;
}
if (!denied) throw new Error("Expected tenant isolation denial");

step("Persistent storage verification");
const storage = createKnowledgeStorageProvider();
const probeKey = `pilot_probe_${crypto.randomBytes(4).toString("hex")}.txt`;
await storage.putObject({ businessId, storageKey: probeKey, buffer: Buffer.from("pilot-ok") });
if (!(await storage.objectExists({ businessId, storageKey: probeKey }))) {
  throw new Error("Storage probe missing after putObject");
}

step("Business Intelligence operating loop — seed canonical state");
const workspacePersistence = new PostgresWorkspacePersistence(withClient);
setWorkspacePersistence(workspacePersistence);
const BI_NOW = new Date().toISOString();
const activation = {
  industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  industryPackageVersion: 1,
  packageConfiguration: { companyName: businessRow.name },
  demoConfigurationId: null,
  workspaceId: businessId,
  activatedAt: BI_NOW,
};
const activated = activateWorkspace({
  workspaceId: businessId,
  activation,
  nowISO: BI_NOW,
});
const stack = activated.operatingStack;
if (!stack?.intelligenceCandidateRuntime) {
  throw new Error("intelligenceCandidateRuntime missing after activation");
}

const partyId = `party_pilot_${suffix}`;
const subjectId = `subj_pilot_${suffix}`;
const requestId = `req_pilot_unassigned_${suffix}`;
stack.businessGraphRuntime.applyEvent({
  id: `evt_party_${partyId}`,
  timestampISO: BI_NOW,
  type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
  source: "pilot",
  payload: {
    party: {
      id: partyId,
      partyType: "PERSON",
      displayName: "Pilot Prospect",
      status: "active",
      contactMethods: [`prospect-${suffix}@example.com`],
      externalReferences: [],
      metadata: {},
      createdAt: BI_NOW,
      updatedAt: BI_NOW,
    },
  },
});
stack.businessSubjectRuntime.applyEvent({
  id: `evt_subject_${subjectId}`,
  timestampISO: BI_NOW,
  type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
  source: "pilot",
  payload: {
    subject: {
      id: subjectId,
      workspaceId: businessId,
      subjectType: "listing",
      displayName: "Pilot Listing 1",
      status: "active",
      keyAttributes: {},
      externalReferences: [],
      createdAt: BI_NOW,
      updatedAt: BI_NOW,
    },
  },
});
const interest = ensurePartySubjectRelationship({
  stack,
  partyId,
  subjectId,
  nowISO: BI_NOW,
  metadata: { timeline: "immediate" },
});
if (!interest.ok) throw new Error(`INTERESTED_IN seed failed: ${interest.reason}`);
stack.requestRuntime.applyEvent({
  id: `evt_req_${requestId}`,
  timestampISO: BI_NOW,
  type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
  source: "pilot",
  payload: {
    request: {
      id: requestId,
      title: "Pilot unassigned inquiry",
      description: "Needs an owner",
      requestType: "prospect_inquiry",
      priority: "high",
      channel: "website",
      source: "pilot",
      requester: partyId,
      receivedAt: BI_NOW,
      dueAt: null,
      assignedWorkId: null,
      assignedTeamMemberId: null,
      qualificationStatus: null,
      attachments: [],
      metadata: {},
      inboundAttribution: null,
      subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })],
    },
  },
});
stack.interactionRuntime.applyEvent({
  id: `evt_int_seed_${suffix}`,
  timestampISO: BI_NOW,
  type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
  source: "pilot",
  payload: {
    interaction: {
      id: `int_pilot_seed_${suffix}`,
      interactionType: "note",
      direction: "inbound",
      channel: "manual",
      occurredAt: BI_NOW,
      participants: [{ partyId }],
      relatedObjects: [
        createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
      ],
      ownerId: owner.id,
      status: "active",
      summary: "Initial inquiry note",
      notes: [],
      outcome: null,
      nextStep: null,
      followUpAt: null,
      source: "manual",
      externalReference: null,
      metadata: {},
      createdAt: BI_NOW,
      updatedAt: BI_NOW,
    },
  },
});

await persistAffectedRuntimes({
  workspaceId: businessId,
  stack,
  integrationPlatform: activated.integrationPlatform,
  kinds: [
    RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH,
    RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT,
    RUNTIME_SNAPSHOT_KINDS.REQUEST,
    RUNTIME_SNAPSHOT_KINDS.INTERACTION,
  ],
  persistence: workspacePersistence,
});

const communicationsBeforeEval = stack.communicationRuntime?.getCommunications?.()?.length
  ?? stack.communicationRuntime?.listCommunications?.()?.length
  ?? 0;
const workBeforeEval = (stack.workRuntime.getWorkItems?.() ?? []).length;

step("Business Intelligence evaluation → evidence-backed candidate");
const registry = resetDefaultBusinessIntelligenceDefinitionRegistryForTests();
registerDefaultBusinessIntelligenceDefinitions({ registry, replace: true });
const biService = new BusinessIntelligenceEvaluationService({ registry });
const evaluated = await biService.evaluate({
  stack,
  businessId,
  nowISO: BI_NOW,
  industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  platformStore,
  actorUserId: owner.id,
});
if (!evaluated.ok) throw new Error("BI evaluation failed");
const candidate = evaluated.candidates.find((entry) => (
  String(entry.definitionId).includes("unassigned_request")
  && String(entry.deduplicationKey).includes(requestId)
)) ?? evaluated.candidates[0];
if (!candidate) throw new Error("Expected intelligence candidate after evaluation");
if (!candidate.evidence?.length) throw new Error("Candidate missing evidence");
if (!candidate.confidenceReason) throw new Error("Candidate missing confidenceReason");
if ((stack.workRuntime.getWorkItems?.() ?? []).length !== workBeforeEval) {
  throw new Error("Candidate existence created Work before approval");
}
const communicationsAfterEval = stack.communicationRuntime?.getCommunications?.()?.length
  ?? stack.communicationRuntime?.listCommunications?.()?.length
  ?? 0;
if (communicationsAfterEval !== communicationsBeforeEval) {
  throw new Error("BI evaluation triggered silent external communication");
}

await persistAffectedRuntimes({
  workspaceId: businessId,
  stack,
  integrationPlatform: activated.integrationPlatform,
  kinds: evaluated.snapshotKinds,
  persistence: workspacePersistence,
});

step("Reload persistence — candidate survives without duplication");
const snapshotMap = await loadRuntimeSnapshotsMap(businessId, workspacePersistence);
const reloaded = activateWorkspace({
  workspaceId: businessId,
  activation,
  nowISO: BI_NOW,
  runtimeSnapshots: snapshotMap,
});
const reloadedStack = reloaded.operatingStack;
const restored = reloadedStack.intelligenceCandidateRuntime.getCandidate(candidate.id);
if (!restored) throw new Error("Candidate did not survive persistence reload");
const reEval = await biService.evaluate({
  stack: reloadedStack,
  businessId,
  nowISO: BI_NOW,
  industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  platformStore,
  actorUserId: owner.id,
});
const sameKeyCount = reloadedStack.intelligenceCandidateRuntime.getCandidates()
  .filter((entry) => entry.deduplicationKey === candidate.deduplicationKey).length;
if (sameKeyCount !== 1) {
  throw new Error(`Expected one candidate for dedupe key, found ${sameKeyCount}`);
}
if ((reloadedStack.workRuntime.getWorkItems?.() ?? []).filter((w) => (
  String(w.metadata?.businessIntelligence?.candidateId ?? "") === String(candidate.id)
)).length) {
  throw new Error("Work existed for candidate before explicit approval");
}

step("Needs Attention surfaces candidate");
const attention = projectOwnerAttention({
  approvalRuntime: reloadedStack.approvalRuntime,
  workRuntime: reloadedStack.workRuntime,
  requestRuntime: reloadedStack.requestRuntime,
  businessGraphRuntime: reloadedStack.businessGraphRuntime,
  businessSubjectRuntime: reloadedStack.businessSubjectRuntime,
  nowISO: BI_NOW,
  intelligenceCandidateRuntime: reloadedStack.intelligenceCandidateRuntime,
});
if (!attention.some((item) => item.intelligenceCandidateId === candidate.id || item.sourceId === candidate.id)) {
  throw new Error("Candidate missing from Needs Attention projection");
}
const projection = projectIntelligenceCandidates({
  intelligenceCandidateRuntime: reloadedStack.intelligenceCandidateRuntime,
  businessId,
});
if (!projection.candidates.some((entry) => entry.id === candidate.id)) {
  throw new Error("Candidate missing from intelligence projection");
}

step("Ask VIBETech explains candidate from evidence only");
const liveCandidate = reloadedStack.intelligenceCandidateRuntime.getCandidate(candidate.id);
const memory = explainCandidateMemory({
  candidate: liveCandidate,
  workRuntime: reloadedStack.workRuntime,
});
const brief = buildIntelligenceCandidateArchitectBrief({
  candidate: liveCandidate,
  stack: reloadedStack,
  memory,
});
if (!brief.ok || brief.inventedFacts !== false) {
  throw new Error("Architect brief invented facts or failed");
}
if (!brief.answers.evidence?.length) throw new Error("Architect brief missing evidence");
const explanation = formatArchitectCandidateReply(brief);
if (!/What needs attention/i.test(explanation)) {
  throw new Error("Architect explanation missing required structure");
}
await builder.seedProposalState({
  sessionId: improveSessionId,
  specification: reloadedSpec?.specification ?? proposed.specification,
  extraMetadata: {
    intelligenceCandidateId: candidate.id,
    candidateSnapshot: liveCandidate,
  },
});
const askChat = await builder.chat({
  sessionId: improveSessionId,
  text: "What evidence supports this?",
  stack: reloadedStack,
});
if (!askChat.ok) throw new Error("Architect chat failed for candidate explanation");
if (askChat.brief?.inventedFacts) {
  throw new Error("Architect invented unsupported facts");
}

step("Owner approves Create Work — deterministic + idempotent");
const converter = new IntelligenceToWorkConversionService();
const createdWork = await converter.execute({
  stack: reloadedStack,
  candidateId: candidate.id,
  actorUserId: owner.id,
  nowISO: BI_NOW,
  platformStore,
});
if (!createdWork.ok || !createdWork.created) {
  throw new Error(`Work conversion failed: ${createdWork.reason ?? createdWork.message}`);
}
const workMeta = createdWork.workItem?.metadata?.businessIntelligence;
if (!workMeta?.candidateId || !workMeta?.definitionId) {
  throw new Error("Work metadata missing candidateId/definitionId");
}
if (!Array.isArray(workMeta.evidenceObjectIds)) {
  throw new Error("Work metadata missing evidence links");
}
const retryWork = await converter.execute({
  stack: reloadedStack,
  candidateId: candidate.id,
  actorUserId: owner.id,
  nowISO: BI_NOW,
  platformStore,
});
if (!retryWork.ok || !retryWork.existing || retryWork.workItem.id !== createdWork.workItem.id) {
  throw new Error("Work conversion was not idempotent");
}
if (createdWork.silentExternalCommunication !== false) {
  throw new Error("Work conversion must declare no silent external communication");
}
const communicationsAfterWork = reloadedStack.communicationRuntime?.getCommunications?.()?.length
  ?? reloadedStack.communicationRuntime?.listCommunications?.()?.length
  ?? communicationsAfterEval;
if (communicationsAfterWork !== communicationsAfterEval) {
  throw new Error("Work conversion sent external communication");
}

await persistAffectedRuntimes({
  workspaceId: businessId,
  stack: reloadedStack,
  integrationPlatform: reloaded.integrationPlatform,
  kinds: createdWork.snapshotKinds,
  persistence: workspacePersistence,
});

step("Work receives canonical outcome → reevaluate resolves candidate");
const workId = createdWork.workItem.id;
reloadedStack.workRuntime.applyEvent({
  id: `evt_work_complete_${workId}`,
  timestampISO: BI_NOW,
  type: WORK_EVENT_TYPES.WORK_ITEM_STATUS_CHANGED,
  source: "pilot",
  payload: { workItemId: workId, status: "completed", completedAtISO: BI_NOW },
});
reloadedStack.interactionRuntime.applyEvent({
  id: `evt_int_outcome_${workId}`,
  timestampISO: BI_NOW,
  type: INTERACTION_EVENT_TYPES.INTERACTION_OUTCOME_RECORDED,
  source: "pilot",
  payload: {
    interactionId: `int_pilot_seed_${suffix}`,
    outcome: "completed",
    nextStep: null,
  },
});
reloadedStack.requestRuntime.applyEvent({
  id: `evt_req_assign_${requestId}`,
  timestampISO: BI_NOW,
  type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
  source: "pilot",
  payload: {
    requestId,
    patch: { assignedTeamMemberId: owner.id },
  },
});

await biService.evaluate({
  stack: reloadedStack,
  businessId,
  nowISO: BI_NOW,
  industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
  platformStore,
  actorUserId: owner.id,
});
const resolvedCandidate = reloadedStack.intelligenceCandidateRuntime.getCandidate(candidate.id);
const stillOpenUnassigned = reloadedStack.intelligenceCandidateRuntime.getOpenCandidates()
  .filter((entry) => String(entry.definitionId).includes("unassigned_request")
    && String(entry.deduplicationKey).includes(requestId));
if (stillOpenUnassigned.length) {
  throw new Error(`Unassigned candidate still open after condition clear: ${stillOpenUnassigned[0].status}`);
}
if (!resolvedCandidate || !["RESOLVED", "CONVERTED_TO_WORK"].includes(resolvedCandidate.status)) {
  throw new Error(`Expected resolved/converted candidate, got ${resolvedCandidate?.status}`);
}

await persistAffectedRuntimes({
  workspaceId: businessId,
  stack: reloadedStack,
  integrationPlatform: reloaded.integrationPlatform,
  kinds: [
    RUNTIME_SNAPSHOT_KINDS.REQUEST,
    RUNTIME_SNAPSHOT_KINDS.WORK,
    RUNTIME_SNAPSHOT_KINDS.INTERACTION,
    RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE,
  ],
  persistence: workspacePersistence,
});

step("Audit + memory cover full lifecycle; sign-in reload preserves state");
const audits = await platformStore.listAuditEvents({ limit: 500 });
const biAudits = audits.filter((row) => (
  String(row.businessId) === String(businessId)
  && String(row.action).startsWith("intelligence.")
));
const requiredActions = [
  "intelligence.observation_detected",
  "intelligence.candidate_detected",
  "intelligence.candidate_surfaced",
  "intelligence.candidate_converted_to_work",
];
for (const action of requiredActions) {
  if (!biAudits.some((row) => row.action === action)) {
    throw new Error(`Missing audit action ${action}`);
  }
}
if (biAudits.some((row) => {
  const meta = JSON.stringify(row.metadata ?? {});
  return /password|token|secret|Bearer /i.test(meta) || meta.length > 4000;
})) {
  throw new Error("Audit metadata appears to contain secrets or oversized sensitive payloads");
}
const timeline = buildBusinessMemoryTimeline({
  intelligenceCandidateRuntime: reloadedStack.intelligenceCandidateRuntime,
  workRuntime: reloadedStack.workRuntime,
  interactionRuntime: reloadedStack.interactionRuntime,
  approvalRuntime: reloadedStack.approvalRuntime,
  auditEvents: biAudits,
});
if (!timeline.events.length) throw new Error("Business memory timeline empty");

await authorizeBusinessAccess({
  userId: owner.id,
  businessId,
  requiredPermission: "business.manage",
});
const finalSnapshots = await loadRuntimeSnapshotsMap(businessId, workspacePersistence);
const signedIn = activateWorkspace({
  workspaceId: businessId,
  activation,
  nowISO: BI_NOW,
  runtimeSnapshots: finalSnapshots,
});
const preserved = signedIn.operatingStack.intelligenceCandidateRuntime.getCandidate(candidate.id);
if (!preserved) throw new Error("Candidate missing after simulated sign-in reload");
if (signedIn.operatingStack.intelligenceCandidateRuntime
  .getCandidates()
  .filter((entry) => entry.deduplicationKey === candidate.deduplicationKey).length !== 1) {
  throw new Error("Dedupe broken after sign-in reload");
}
const preservedWork = signedIn.operatingStack.workRuntime.getWorkItem?.(workId);
if (!preservedWork || preservedWork.status !== "completed") {
  throw new Error("Completed Work missing after sign-in reload");
}

const otherSnapshots = await loadRuntimeSnapshotsMap(otherBiz.business.id, workspacePersistence);
const otherIntel = otherSnapshots[RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE];
if (otherIntel?.candidates?.some?.((entry) => entry.id === candidate.id)) {
  throw new Error("Intelligence candidate leaked across tenants");
}

console.log("\nPilot Architect journey passed (database + product services).");
console.log(`  businessId: ${businessId}`);
console.log(`  architectSession: ${sessionId}`);
console.log(`  improveSession: ${improveSessionId}`);
console.log(`  intelligenceCandidateId: ${candidate.id}`);
console.log(`  intelligenceWorkId: ${workId}`);
console.log(`  ownerInviteDelivery: ${ownerInvite.delivery?.sent ? "sent" : ownerInvite.delivery?.reason ?? "not_sent"}`);
console.log(`  employeeInviteDelivery: ${employeeInvite.delivery?.sent ? "sent" : employeeInvite.delivery?.reason ?? "not_sent"}`);
console.log(`  storageRoot: ${storageRoot}`);
console.log("  NOTE: Live HTTPS/DNS for app.vtechdevelopment.com must still pass pilot:gates.");

await closePool();
