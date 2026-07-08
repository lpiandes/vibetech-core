import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_GRAPH_EVENT_TYPES } from "../../business-graph/BusinessGraphEventTypes.js";
import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { ensurePartyRelationship } from "../../business-graph/partyRelationshipClassification.js";
import { ensurePartySubjectRelationship } from "../../business-graph/partySubjectRelationship.js";
import { BusinessSubjectRuntime } from "../../business-subject/BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../../business-subject/BusinessSubjectEventTypes.js";
import { buildSubjectPortfolioProjection } from "../../business-subject/views/buildSubjectPortfolioProjection.js";
import { CommunicationRuntime } from "../../communications/CommunicationRuntime.js";
import { CommunicationPreferenceRuntime } from "../../communications/preferences/CommunicationPreferenceRuntime.js";
import { buildEngagementPartyIndex } from "../../engagement/EngagementPartyIndexBuilder.js";
import { InteractionRuntime } from "../../interactions/InteractionRuntime.js";
import { InMemoryWorkspacePersistence } from "../../persistence/InMemoryWorkspacePersistence.js";
import { loadRuntimeSnapshotsMap } from "../../persistence/createWorkspacePersistence.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../../references/EntityRef.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { WorkViewAdapter } from "../../work/views/WorkViewAdapter.js";
import { TeamRuntime } from "../../team/TeamRuntime.js";
import { createSeededCompanyRuntime } from "../../company/fixtures/createSeededCompanyRuntime.js";
import { buildRelationshipFollowUpEvidence } from "../../relationship-followup/RelationshipFollowUpEvidence.js";
import { CanonicalStateReader } from "../CanonicalStateReader.js";
import { CrmImportOrchestrationService } from "../CrmImportOrchestrationService.js";
import { CsvImportParser } from "../parsers/CsvImportParser.js";
import { SubjectImportDryRunExecutor } from "./SubjectImportDryRunExecutor.js";
import { SubjectImportCommitExecutor } from "./SubjectImportCommitExecutor.js";
import { IMPORT_PLAN_ACTION_TYPES, IMPORT_RUN_STATUSES } from "../ImportRunStatus.js";
import { MCBRIDE_SUBJECT_IMPORT_PROFILES } from "../../../../industries/property-management/config/mcbrideSubjectImportProfiles.js";

const NOW = "2026-07-08T14:00:00.000Z";
const BUSINESS_ID = "ws_subject_import";
const PROFILE = MCBRIDE_SUBJECT_IMPORT_PROFILES[0];

function buildStack({ seed = null } = {}) {
  return {
    businessGraphRuntime: new BusinessGraphRuntime({ seed: seed?.businessGraph ? () => seed.businessGraph : undefined }),
    businessSubjectRuntime: new BusinessSubjectRuntime({ seed: seed?.businessSubject ? () => seed.businessSubject : undefined }),
    requestRuntime: new RequestRuntime({ seed: seed?.request ? () => seed.request : undefined, nowISO: NOW }),
    workRuntime: new WorkRuntime({ seed: seed?.work ? () => seed.work : undefined, nowISO: NOW }),
    interactionRuntime: new InteractionRuntime({ seed: seed?.interaction ? () => seed.interaction : undefined }),
    communicationRuntime: new CommunicationRuntime({ seed: seed?.communication ? () => seed.communication : undefined }),
    communicationPreferenceRuntime: new CommunicationPreferenceRuntime({
      seed: seed?.communicationPreference ? () => seed.communicationPreference : undefined,
    }),
  };
}

function seedParty(stack, { id = "party_buyer", displayName = "Buyer One" } = {}) {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_seed_party_${id}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: {
        id,
        partyType: "PERSON",
        displayName,
        status: "active",
        contactMethods: ["buyer@example.com"],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  ensurePartyRelationship({ stack, partyId: id, relationshipType: "PROSPECT", nowISO: NOW });
  return id;
}

function seedImportProfileRequest(stack, { partyId, propertyOfInterest }) {
  stack.requestRuntime.applyEvent({
    id: `evt_req_${partyId}`,
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: {
      request: {
        id: `req_import_${partyId}`,
        title: "CRM import profile",
        description: "Imported profile",
        requestType: "crm_import_profile",
        priority: "low",
        channel: "api",
        source: "crm_import",
        requester: partyId,
        receivedAt: NOW,
        dueAt: null,
        assignedWorkId: null,
        assignedTeamMemberId: null,
        qualificationStatus: "imported",
        attachments: [],
        metadata: { qualification: { propertyOfInterest } },
        inboundAttribution: null,
        subjectRefs: [],
      },
    },
  });
}

function seedSubject(stack, { id, address = "742 Harbor Lane", displayName = "742 Harbor Lane", externalReferences = [] }) {
  stack.businessSubjectRuntime.applyEvent({
    id: `evt_seed_subject_${id}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: {
        id,
        workspaceId: BUSINESS_ID,
        subjectType: "listing",
        displayName,
        status: "active",
        keyAttributes: { address, city: "Miami", state: "FL", postalCode: "33139" },
        externalReferences,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return id;
}

function snapshot(stack) {
  return new CanonicalStateReader({ stack }).readSnapshot();
}

function dryRunRows({ stack, rows }) {
  return new SubjectImportDryRunExecutor().execute({
    parsedRows: rows,
    columnMap: PROFILE.columnMap,
    profile: PROFILE,
    sourceSystem: PROFILE.sourceSystem,
    importRunId: "run_subject_1",
    canonicalSnapshot: snapshot(stack),
    installationResult: { workspaceId: BUSINESS_ID },
  });
}

class MemoryCommitRepository {
  constructor(rows) {
    this.rows = rows.map((row) => ({ commitStatus: "pending", commitAttempts: 0, ...row }));
  }

  async listAllRowResults() {
    return this.rows.map((row) => ({ ...row }));
  }

  async updateRowCommitState({ rowNumber, ...patch }) {
    const idx = this.rows.findIndex((row) => Number(row.rowNumber) === Number(rowNumber));
    assert.notEqual(idx, -1);
    this.rows[idx] = {
      ...this.rows[idx],
      commitStatus: patch.commitStatus,
      commitResult: patch.commitResult ?? null,
      commitError: patch.commitError ?? null,
      committedAt: patch.committedAt ?? null,
      commitAttempts: Number(this.rows[idx].commitAttempts ?? 0) + (patch.incrementAttempts ? 1 : 0),
    };
    return { ...this.rows[idx] };
  }
}

class MemoryImportRunRepository {
  constructor() {
    this.runs = new Map();
    this.artifacts = new Map();
    this.rowResults = new Map();
  }

  async createRun({ businessId, artifactId, sourceSystem, contentHash, status, profileId }) {
    const run = {
      id: "run_memory_subject",
      businessId,
      artifactId,
      sourceSystem,
      contentHash,
      status,
      profileId,
      stats: {},
      planSummary: {},
      columnMapping: null,
      lastCommittedRow: 0,
    };
    this.runs.set(`${businessId}:${run.id}`, run);
    this.artifacts.set(`${businessId}:${artifactId}`, { id: artifactId, businessId });
    return { ...run };
  }

  async getRun(runId, businessId) {
    const run = this.runs.get(`${businessId}:${runId}`);
    return run ? { ...run } : null;
  }

  async updateRun(runId, businessId, patch) {
    const key = `${businessId}:${runId}`;
    const run = { ...this.runs.get(key), ...patch };
    this.runs.set(key, run);
    return { ...run };
  }

  async getArtifact(artifactId, businessId) {
    return this.artifacts.get(`${businessId}:${artifactId}`) ?? null;
  }

  async listAllRowResults() {
    return [];
  }

  async upsertRowResults(importRunId, rowResults) {
    this.rowResults.set(importRunId, rowResults.map((row) => ({ ...row })));
  }

  async listRowResults({ importRunId, page = 1, pageSize = 50, status = null } = {}) {
    const rows = (this.rowResults.get(importRunId) ?? []).filter((row) =>
      status ? String(row.outcomeStatus) === String(status) : true,
    );
    const start = (Number(page) - 1) * Number(pageSize);
    return {
      rows: rows.slice(start, start + Number(pageSize)).map((row) => ({ ...row })),
      page: Number(page),
      pageSize: Number(pageSize),
      totalRows: rows.length,
    };
  }
}

test("property/listing CSV inspect/map/dry-run plans trusted subject create and exact interest linkage", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  seedImportProfileRequest(stack, { partyId, propertyOfInterest: "742 Harbor Lane" });

  const result = dryRunRows({
    stack,
    rows: [
      {
        "Property ID": "prop-742",
        "Property Name": "742 Harbor Lane",
        Address: "742 Harbor Lane",
        City: "Miami",
        State: "FL",
        Zip: "33139",
      },
    ],
  });

  assert.equal(result.dryRunResult.stats.totalRows, 1);
  assert.equal(result.rowResults[0].outcomeStatus, "success");
  assert.ok(result.rowResults[0].plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.CREATE_SUBJECT));
  assert.ok(result.rowResults[0].plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.LINK_PARTY_TO_SUBJECT));
});

test("property/listing CSV service flow inspects, maps, dry-runs, and reports through import_runs", async () => {
  const stack = buildStack();
  const repository = new MemoryImportRunRepository();
  const csv = Buffer.from("Property ID,Property Name,Address,City,State,Zip\nprop-742,742 Harbor Lane,742 Harbor Lane,Miami,FL,33139\n");
  const service = new CrmImportOrchestrationService({
    repository,
    artifactStore: {
      async uploadArtifact() {
        return {
          artifact: {
            id: "artifact_properties",
            originalFilename: "properties.csv",
            mimeType: "text/csv",
            createdAt: NOW,
          },
          contentHash: "hash_properties",
        };
      },
      async readArtifactBuffer() {
        return csv;
      },
    },
    parser: new CsvImportParser(),
  });
  const installationResult = { importProfiles: [PROFILE], workspaceId: BUSINESS_ID };

  const uploaded = await service.upload({
    businessId: BUSINESS_ID,
    userId: null,
    buffer: csv,
    filename: "properties.csv",
    mimeType: "text/csv",
    sourceSystem: PROFILE.sourceSystem,
    installationResult,
  });
  const inspected = await service.inspect({ businessId: BUSINESS_ID, runId: uploaded.importRun.id, installationResult });
  await service.mapColumns({
    businessId: BUSINESS_ID,
    runId: uploaded.importRun.id,
    profileId: PROFILE.profileId,
    columnMapping: inspected.detectedProfile.suggestedColumnMap,
    installationResult,
  });
  const dryRun = await service.dryRun({
    businessId: BUSINESS_ID,
    runId: uploaded.importRun.id,
    stack,
    installationResult,
  });
  const report = await service.getReport({ businessId: BUSINESS_ID, runId: uploaded.importRun.id });

  assert.equal(inspected.rowCount, 1);
  assert.equal(dryRun.dryRun.status, IMPORT_RUN_STATUSES.DRY_RUN_COMPLETE);
  assert.equal(report.totalRows, 1);
  assert.ok(report.rows[0].plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.CREATE_SUBJECT));
  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 0);
});

test("subject identity resolution dedups external references and normalized address, and conflicts go to review", () => {
  const stack = buildStack();
  seedSubject(stack, {
    id: "subj_existing_ext",
    externalReferences: [`${PROFILE.sourceSystem}:prop-742`],
  });
  seedSubject(stack, { id: "subj_existing_addr", address: "900 Bay Road", displayName: "900 Bay Road" });

  const external = dryRunRows({
    stack,
    rows: [{ "Property ID": "prop-742", "Property Name": "742 Harbor Lane", Address: "742 Harbor Lane" }],
  }).rowResults[0];
  const address = dryRunRows({
    stack,
    rows: [{ "Property Name": "900 Bay Road", Address: "900 Bay Rd", City: "Miami", State: "FL", Zip: "33139" }],
  }).rowResults[0];
  const conflict = dryRunRows({
    stack,
    rows: [{ "Property ID": "prop-742", "Property Name": "900 Bay Road", Address: "900 Bay Rd", City: "Miami", State: "FL", Zip: "33139" }],
  }).rowResults[0];

  assert.notEqual(external.matchTier, "new");
  assert.notEqual(address.matchTier, "new");
  assert.equal(conflict.outcomeStatus, "review");
  assert.ok(conflict.warnings.includes("conflicting_subject_identity"));
});

test("ambiguous, vague, or unmatched propertyOfInterest evidence never creates a subject", () => {
  const stack = buildStack();
  const vague = dryRunRows({
    stack,
    rows: [{ "Property Name": "Beach house maybe", "Property of Interest": "Beach house maybe" }],
  }).rowResults[0];

  assert.equal(vague.outcomeStatus, "review");
  assert.ok(vague.plannedActions.every((a) => a.type !== IMPORT_PLAN_ACTION_TYPES.CREATE_SUBJECT));
  assert.ok(vague.rawNormalized.unresolvedReason);
});

test("subject commit creates BusinessSubject, links Party to Subject, retries idempotently, and persists restart snapshots", async () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  seedImportProfileRequest(stack, { partyId, propertyOfInterest: "742 Harbor Lane" });
  const dryRun = dryRunRows({
    stack,
    rows: [{ "Property ID": "prop-742", "Property Name": "742 Harbor Lane", Address: "742 Harbor Lane" }],
  });
  const repository = new MemoryCommitRepository(dryRun.rowResults);
  const persistence = new InMemoryWorkspacePersistence();
  const executor = new SubjectImportCommitExecutor();
  const run = {
    id: "run_subject_1",
    businessId: BUSINESS_ID,
    sourceSystem: PROFILE.sourceSystem,
    profileId: PROFILE.profileId,
  };

  await executor.execute({ repository, businessId: BUSINESS_ID, run, stack, nowISO: NOW, persistence });
  await executor.execute({ repository, businessId: BUSINESS_ID, run, stack, nowISO: NOW, persistence });

  assert.equal(stack.businessSubjectRuntime.getSubjects().length, 1);
  assert.equal(stack.businessGraphRuntime.getRelationships().filter((r) => r.relationshipType === "INTERESTED_IN").length, 1);
  assert.equal(stack.workRuntime.getWorkItems().length, 0);
  assert.equal(stack.communicationRuntime.getMessages().length, 0);

  const saved = await loadRuntimeSnapshotsMap(BUSINESS_ID, persistence);
  const restarted = buildStack({ seed: saved });
  assert.equal(restarted.businessSubjectRuntime.getSubjects().length, 1);
  assert.equal(restarted.businessGraphRuntime.getRelationships().filter((r) => r.relationshipType === "INTERESTED_IN").length, 1);
});

test("existing Party-to-Subject linkage helper is idempotent", () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  const subjectId = seedSubject(stack, { id: "subj_linked" });

  const first = ensurePartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });
  const second = ensurePartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });

  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(stack.businessGraphRuntime.getRelationships().filter((r) => r.relationshipType === "INTERESTED_IN").length, 1);
});

test("Properties and People projections show canonical property linkage and follow-up evidence prefers linked subject", () => {
  const stack = buildStack();
  const partyId = seedParty(stack, { displayName: "Linked Buyer" });
  const subjectId = seedSubject(stack, { id: "subj_projection", displayName: "742 Harbor Lane" });
  seedImportProfileRequest(stack, { partyId, propertyOfInterest: "Beach house maybe" });
  ensurePartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });

  const portfolio = buildSubjectPortfolioProjection({
    ctx: stack,
    subjectTypes: ["listing"],
    nowISO: NOW,
    presentation: { portfolioInquiryRequestTypes: ["PROSPECT_INQUIRY"] },
  });
  const people = buildEngagementPartyIndex({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    businessId: BUSINESS_ID,
    nowISO: NOW,
  });
  const rel = stack.businessGraphRuntime
    .getRelationships()
    .find((r) => r.relationshipType === "PROSPECT" && String(r.status) === "active");
  const evidence = buildRelationshipFollowUpEvidence({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    relationshipTypes: [{ type: "PROSPECT", label: "Prospect" }],
    party: stack.businessGraphRuntime.getParty(partyId),
    relationship: rel,
    rule: { id: "rule", targetWork: { workType: "prospect_follow_up" } },
    nowISO: NOW,
  });

  assert.equal(portfolio.subjects[0].interestedCount, 1);
  assert.equal(people.parties[0].primarySubjectName, "742 Harbor Lane");
  assert.equal(evidence.propertyInterest.source, "subject_linkage");
  assert.equal(evidence.propertyInterest.rawQualificationValue, "Beach house maybe");
});

test("old relationship follow-up Work gains property display context without mutating Work", () => {
  const stack = buildStack();
  const partyId = seedParty(stack, { displayName: "Work Buyer" });
  const subjectId = seedSubject(stack, { id: "subj_work", displayName: "742 Harbor Lane" });
  ensurePartySubjectRelationship({ stack, partyId, subjectId, nowISO: NOW });
  stack.workRuntime.applyEvent({
    id: "evt_work_old",
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: {
      workItem: {
        id: "work_old_followup",
        title: "Prospect follow-up",
        description: "Follow up",
        workType: "prospect_follow_up",
        status: "in_progress",
        priority: "medium",
        stageId: "stage_follow_up",
        queueId: "queue_follow_up",
        assignedTo: "unassigned",
        requestedBy: partyId,
        source: "manual",
        dueAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        relatedObjects: [createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId })],
        requirements: [],
        metadata: {},
      },
    },
  });
  const before = JSON.stringify(stack.workRuntime.getWorkItems()[0]);
  const vm = new WorkViewAdapter({ nowISO: NOW }).translate({
    workRuntime: stack.workRuntime,
    teamRuntime: new TeamRuntime({ nowISO: NOW }),
    companyRuntime: createSeededCompanyRuntime(),
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    requestRuntime: stack.requestRuntime,
    businessId: BUSINESS_ID,
  });

  assert.equal(vm.items[0].metadata.display.subjectName, "742 Harbor Lane");
  assert.equal(JSON.stringify(stack.workRuntime.getWorkItems()[0]), before);
});

test("foreign business cannot access or commit a subject import run through shared import persistence", async () => {
  const repository = new MemoryImportRunRepository();
  const service = new CrmImportOrchestrationService({
    repository,
    artifactStore: {
      async uploadArtifact() {
        return {
          artifact: { id: "artifact_subject", originalFilename: "properties.csv", mimeType: "text/csv", createdAt: NOW },
          contentHash: "hash",
        };
      },
      async readArtifactBuffer() {
        return Buffer.from("Property ID,Property Name,Address\nprop-1,One,1 Main St\n");
      },
    },
    parser: new CsvImportParser(),
  });
  const installationResult = { importProfiles: [PROFILE], workspaceId: BUSINESS_ID };
  const uploaded = await service.upload({
    businessId: BUSINESS_ID,
    userId: null,
    buffer: Buffer.from(""),
    filename: "properties.csv",
    mimeType: "text/csv",
    sourceSystem: PROFILE.sourceSystem,
    installationResult,
  });

  await assert.rejects(() => service.getRun("foreign_business", uploaded.importRun.id), /not found/i);
  await assert.rejects(
    () => service.commit({ businessId: "foreign_business", runId: uploaded.importRun.id, stack: buildStack(), installationResult }),
    /not found/i,
  );
});
