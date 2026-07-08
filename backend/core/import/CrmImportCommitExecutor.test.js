import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";
import { ensurePartyRelationship } from "../business-graph/partyRelationshipClassification.js";
import { CommunicationPreferenceRuntime } from "../communications/preferences/CommunicationPreferenceRuntime.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { InteractionRuntime } from "../interactions/InteractionRuntime.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { InMemoryWorkspacePersistence } from "../persistence/InMemoryWorkspacePersistence.js";
import { loadRuntimeSnapshotsMap } from "../persistence/createWorkspacePersistence.js";
import { RequestRuntime } from "../request/RequestRuntime.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { WorkRuntime } from "../work/WorkRuntime.js";
import { CanonicalStateReader } from "./CanonicalStateReader.js";
import { CrmImportCommitExecutor } from "./CrmImportCommitExecutor.js";
import { CrmImportDryRunExecutor } from "./CrmImportDryRunExecutor.js";
import { CrmImportOrchestrationService } from "./CrmImportOrchestrationService.js";
import { IMPORT_PLAN_ACTION_TYPES, IMPORT_RUN_STATUSES } from "./ImportRunStatus.js";

const NOW = "2026-07-08T14:00:00.000Z";

function buildStack() {
  return {
    businessGraphRuntime: new BusinessGraphRuntime(),
    requestRuntime: new RequestRuntime({ nowISO: NOW }),
    communicationPreferenceRuntime: new CommunicationPreferenceRuntime(),
    interactionRuntime: new InteractionRuntime(),
  };
}

function seedParty(stack, { id = "party_existing", email = "existing@example.com", displayName = "Existing Prospect" } = {}) {
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
        contactMethods: [email],
        externalReferences: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
  return id;
}

function createPartyAction({ partyId = "party_new", email = "new@example.com", displayName = "New Person", externalReference = "follow_up_boss:1" } = {}) {
  return {
    type: IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY,
    payload: {
      partyId,
      displayName,
      email,
      externalReference,
      metadata: {},
    },
  };
}

class MemoryCommitRepository {
  constructor(rows) {
    this.rows = rows.map((row) => ({ commitStatus: "pending", commitAttempts: 0, ...row }));
    this.updates = [];
  }

  async listAllRowResults() {
    return this.rows.map((row) => ({ ...row }));
  }

  async updateRowCommitState({ rowNumber, ...patch }) {
    const idx = this.rows.findIndex((row) => Number(row.rowNumber) === Number(rowNumber));
    if (idx === -1) return null;
    this.rows[idx] = {
      ...this.rows[idx],
      commitStatus: patch.commitStatus,
      commitResult: patch.commitResult ?? null,
      commitError: patch.commitError ?? null,
      committedAt: patch.committedAt ?? null,
      commitAttempts: Number(this.rows[idx].commitAttempts ?? 0) + (patch.incrementAttempts ? 1 : 0),
    };
    this.updates.push({ rowNumber, ...patch });
    return { ...this.rows[idx] };
  }
}

class MemoryRunRepository extends MemoryCommitRepository {
  constructor({ run, rows = [] }) {
    super(rows);
    this.run = { ...run };
    this.runUpdates = [];
  }

  async getRun(runId, businessId) {
    if (String(this.run.id) !== String(runId) || String(this.run.businessId) !== String(businessId)) return null;
    return { ...this.run };
  }

  async updateRun(_runId, _businessId, patch) {
    this.run = { ...this.run, ...patch };
    this.runUpdates.push(patch);
    return { ...this.run };
  }
}

function run() {
  return {
    id: "run_1",
    businessId: "ws_import_commit",
    sourceSystem: "follow_up_boss",
  };
}

test("CrmImportCommitExecutor commits old S1-2A actions without actionId and is retry-idempotent", async () => {
  const stack = buildStack();
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "100",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY,
          payload: {
            partyId: "party_jane_example_com",
            displayName: "Jane Example",
            email: "jane@example.com",
            externalReference: "follow_up_boss:100",
            metadata: { leadSource: "Referral" },
          },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.ADD_RELATIONSHIP,
          payload: { partyId: "party_jane_example_com", relationshipType: "BUYER" },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_QUALIFICATION,
          payload: {
            partyId: "party_jane_example_com",
            requestId: "req_import_follow_up_boss_100",
            qualification: { intent: "buy" },
            inboundAttribution: { sourceLabel: "follow_up_boss import", channel: "import", externalObjectId: "100" },
          },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT,
          payload: {
            partyId: "party_jane_example_com",
            consent: {
              channel: "email",
              scope: "all",
              status: "opt_in",
              source: "crm_import:follow_up_boss",
              recordedAt: NOW,
              externalReference: "follow_up_boss:100:email_consent",
            },
          },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_NOTE,
          payload: {
            partyId: "party_jane_example_com",
            interactionId: "int_import_follow_up_boss_100",
            notes: "Imported note.",
          },
        },
      ],
      rawNormalized: { externalContactId: "100" },
    },
  ]);
  const persisted = [];
  const executor = new CrmImportCommitExecutor({
    persistSnapshots: async ({ kinds }) => persisted.push(kinds),
  });

  await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
  });
  await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
  });

  assert.equal(stack.businessGraphRuntime.getParties().length, 1);
  assert.equal(stack.businessGraphRuntime.getRelationships().length, 1);
  assert.equal(stack.requestRuntime.getRequests().length, 1);
  assert.equal(stack.requestRuntime.getRequest("req_import_follow_up_boss_100").status, "closed");
  assert.equal(stack.requestRuntime.getRequest("req_import_follow_up_boss_100").requestType, "crm_import_profile");
  assert.equal(stack.communicationPreferenceRuntime.getPreferences().length, 1);
  assert.equal(stack.interactionRuntime.getInteractions().length, 1);
  assert.equal(stack.interactionRuntime.getInteractions()[0].outcome, null);
  assert.equal(stack.interactionRuntime.getInteractions()[0].followUpAt, null);
  assert.ok(persisted.some((kinds) => kinds.includes("businessGraph")));
  assert.ok(persisted.some((kinds) => kinds.includes("request")));
});

test("CREATE_PARTY and UPDATE_PARTY commit without duplicating an existing prospect", async () => {
  const stack = buildStack();
  const existingPartyId = seedParty(stack);
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "101",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.UPDATE_PARTY,
          payload: {
            partyId: existingPartyId,
            patch: {
              contactMethodsAdd: ["5551112222"],
              externalReferencesAdd: ["follow_up_boss:101"],
              metadata: { leadSource: "Referral" },
            },
          },
        },
      ],
      rawNormalized: { externalContactId: "101" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
  });

  assert.equal(stack.businessGraphRuntime.getParties().length, 1);
  const party = stack.businessGraphRuntime.getParty(existingPartyId);
  assert.ok(party.contactMethods.includes("5551112222"));
  assert.ok(party.externalReferences.includes("follow_up_boss:101"));
  assert.equal(party.metadata.leadSource, "Referral");
});

test("ADD_RELATIONSHIP preserves active PROSPECT while adding BUYER", async () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "PROSPECT", nowISO: NOW });
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "102",
      outcomeStatus: "success",
      plannedActions: [
        { type: IMPORT_PLAN_ACTION_TYPES.ADD_RELATIONSHIP, payload: { partyId, relationshipType: "BUYER" } },
      ],
      rawNormalized: { externalContactId: "102" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  await executor.execute({ repository, businessId: "ws_import_commit", run: run(), stack, installationResult: {}, nowISO: NOW });

  const activeTypes = stack.businessGraphRuntime
    .getRelationships()
    .filter((rel) => rel.status === "active")
    .map((rel) => rel.relationshipType)
    .sort();
  assert.deepEqual(activeTypes, ["BUYER", "PROSPECT"]);
});

test("PROMOTE_RELATIONSHIP ends only the explicit source relationship", async () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });
  ensurePartyRelationship({ stack, partyId, relationshipType: "INVESTOR", nowISO: NOW });
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "103",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.PROMOTE_RELATIONSHIP,
          payload: { partyId, fromRelationshipType: "BUYER", toRelationshipType: "PAST_BUYER" },
        },
      ],
      rawNormalized: { externalContactId: "103" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: { lifecycleTransitions: [{ from: "BUYER", to: "PAST_BUYER" }] },
    nowISO: NOW,
  });

  const byType = Object.fromEntries(stack.businessGraphRuntime.getRelationships().map((rel) => [rel.relationshipType, rel.status]));
  assert.equal(byType.BUYER, "ended");
  assert.equal(byType.INVESTOR, "active");
  assert.equal(byType.PAST_BUYER, "active");
});

test("RECORD_QUALIFICATION creates then closes deterministic crm_import_profile and updates on retry", async () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "104",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_QUALIFICATION,
          payload: {
            partyId,
            requestId: "req_import_follow_up_boss_104",
            qualification: { intent: "rent" },
          },
        },
      ],
      rawNormalized: { externalContactId: "104" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  await executor.execute({ repository, businessId: "ws_import_commit", run: run(), stack, installationResult: {}, nowISO: NOW });
  const request = stack.requestRuntime.getRequest("req_import_follow_up_boss_104");
  assert.equal(request.requestType, "crm_import_profile");
  assert.equal(request.status, "closed");
  assert.equal(request.metadata.importOnly, true);
  assert.deepEqual(request.metadata.qualification, { intent: "rent" });

  repository.rows[0].plannedActions[0].payload.qualification = { intent: "buy" };
  await executor.execute({ repository, businessId: "ws_import_commit", run: run(), stack, installationResult: {}, nowISO: NOW });
  assert.equal(stack.requestRuntime.getRequests().length, 1);
  assert.deepEqual(stack.requestRuntime.getRequest("req_import_follow_up_boss_104").metadata.qualification, { intent: "buy" });
});

test("explicit email opt-in and SMS opt-out commit with canonical preference identity", async () => {
  const stack = buildStack();
  const partyId = seedParty(stack);
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "105",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT,
          payload: {
            partyId,
            consent: { channel: "email", scope: "all", status: "opt_in", recordedAt: NOW },
          },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT,
          payload: {
            partyId,
            consent: { channel: "sms", scope: "all", status: "opt_out", recordedAt: NOW },
          },
        },
      ],
      rawNormalized: { externalContactId: "105" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  await executor.execute({ repository, businessId: "ws_import_commit", run: run(), stack, installationResult: {}, nowISO: NOW });

  const prefs = stack.communicationPreferenceRuntime.getPreferencesForParty(partyId);
  assert.equal(prefs.find((pref) => pref.channel === "email").status, "opt_in");
  assert.equal(prefs.find((pref) => pref.channel === "sms").status, "opt_out");
});

test("CrmImportCommitExecutor replays committed rows when canonical effects are missing", async () => {
  const stack = buildStack();
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "200",
      outcomeStatus: "success",
      commitStatus: "committed",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY,
          payload: {
            partyId: "party_replay_example_com",
            displayName: "Replay Example",
            email: "replay@example.com",
            externalReference: "follow_up_boss:200",
            metadata: {},
          },
        },
      ],
      rawNormalized: { externalContactId: "200" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
  });

  assert.ok(stack.businessGraphRuntime.getParty("party_replay_example_com"));
  assert.equal(repository.rows[0].commitStatus, "committed");
});

test("CrmImportCommitExecutor refuses to weaken existing opt-out consent", async () => {
  const stack = buildStack();
  stack.communicationPreferenceRuntime.applyEvent({
    id: "evt_existing_opt_out",
    timestampISO: NOW,
    type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
    source: "test",
    payload: {
      preference: {
        id: "pref_existing",
        partyId: "party_1",
        workspaceId: "ws_import_commit",
        channel: "email",
        scope: "all",
        status: "opt_out",
        source: "manual",
        recordedAt: NOW,
      },
    },
  });
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "300",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT,
          payload: {
            partyId: "party_1",
            consent: { channel: "email", scope: "all", status: "opt_in", recordedAt: NOW },
          },
        },
      ],
      rawNormalized: { externalContactId: "300" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  const result = await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
  });

  assert.equal(result.stats.failedRows, 1);
  assert.equal(stack.communicationPreferenceRuntime.getPreferences()[0].status, "opt_out");
});

test("error rows never commit and review rows require explicit allowance", async () => {
  const stack = buildStack();
  const rows = [
    {
      rowNumber: 1,
      externalId: "400",
      outcomeStatus: "error",
      plannedActions: [createPartyAction({ partyId: "party_error", email: "error@example.com" })],
      rawNormalized: { externalContactId: "400" },
    },
    {
      rowNumber: 2,
      externalId: "401",
      outcomeStatus: "review",
      plannedActions: [createPartyAction({ partyId: "party_review", email: "review@example.com" })],
      rawNormalized: { externalContactId: "401" },
    },
  ];
  const repository = new MemoryCommitRepository(rows);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  const first = await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
  });
  assert.equal(first.stats.skippedRows, 2);
  assert.equal(stack.businessGraphRuntime.getParties().length, 0);

  repository.rows[1].commitStatus = "pending";
  const second = await executor.execute({
    repository,
    businessId: "ws_import_commit",
    run: run(),
    stack,
    installationResult: {},
    allowReviewCommit: true,
    nowISO: NOW,
  });
  assert.equal(second.stats.committedRows, 1);
  assert.ok(stack.businessGraphRuntime.getParty("party_review"));
  assert.equal(stack.businessGraphRuntime.getParty("party_error"), null);
});

test("partial failure retries forward-only without duplicating already committed rows", async () => {
  const stack = buildStack();
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "500",
      outcomeStatus: "success",
      plannedActions: [createPartyAction({ partyId: "party_forward", email: "forward@example.com" })],
      rawNormalized: { externalContactId: "500" },
    },
    {
      rowNumber: 2,
      externalId: "501",
      outcomeStatus: "success",
      plannedActions: [
        {
          type: IMPORT_PLAN_ACTION_TYPES.UPDATE_PARTY,
          payload: { partyId: "party_late", patch: { contactMethodsAdd: ["late@example.com"] } },
        },
      ],
      rawNormalized: { externalContactId: "501" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });

  const first = await executor.execute({ repository, businessId: "ws_import_commit", run: run(), stack, installationResult: {}, nowISO: NOW });
  assert.equal(first.stats.committedRows, 1);
  assert.equal(first.stats.failedRows, 1);
  assert.equal(stack.businessGraphRuntime.getParties().length, 1);

  seedParty(stack, { id: "party_late", email: "late-original@example.com", displayName: "Late Party" });
  const second = await executor.execute({ repository, businessId: "ws_import_commit", run: run(), stack, installationResult: {}, nowISO: NOW });
  assert.equal(second.stats.committedRows, 2);
  assert.equal(second.stats.failedRows, 0);
  assert.equal(stack.businessGraphRuntime.getParties().length, 2);
  assert.ok(stack.businessGraphRuntime.getParty("party_late").contactMethods.includes("late@example.com"));
});

test("completed import survives restart with party relationship qualification consent and note", async () => {
  const workspaceId = "ws_import_commit";
  const persistence = new InMemoryWorkspacePersistence();
  const stack = buildStack();
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "600",
      outcomeStatus: "success",
      plannedActions: [
        createPartyAction({ partyId: "party_restart", email: "restart@example.com", externalReference: "follow_up_boss:600" }),
        { type: IMPORT_PLAN_ACTION_TYPES.ADD_RELATIONSHIP, payload: { partyId: "party_restart", relationshipType: "BUYER" } },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_QUALIFICATION,
          payload: { partyId: "party_restart", requestId: "req_import_follow_up_boss_600", qualification: { intent: "buy" } },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT,
          payload: { partyId: "party_restart", consent: { channel: "email", scope: "all", status: "opt_in", recordedAt: NOW } },
        },
        {
          type: IMPORT_PLAN_ACTION_TYPES.RECORD_NOTE,
          payload: { partyId: "party_restart", interactionId: "int_import_follow_up_boss_600", notes: "Durable note." },
        },
      ],
      rawNormalized: { externalContactId: "600" },
    },
  ]);
  const executor = new CrmImportCommitExecutor();

  await executor.execute({
    repository,
    businessId: workspaceId,
    run: run(),
    stack,
    installationResult: {},
    nowISO: NOW,
    persistence,
  });

  const snapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  const rehydrated = {
    businessGraphRuntime: new BusinessGraphRuntime({ seed: () => snapshots[RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH] }),
    requestRuntime: new RequestRuntime({ nowISO: NOW, seed: () => snapshots[RUNTIME_SNAPSHOT_KINDS.REQUEST] }),
    communicationPreferenceRuntime: new CommunicationPreferenceRuntime({
      seed: () => snapshots[RUNTIME_SNAPSHOT_KINDS.COMMUNICATION_PREFERENCE],
    }),
    interactionRuntime: new InteractionRuntime({ seed: () => snapshots[RUNTIME_SNAPSHOT_KINDS.INTERACTION] }),
  };

  assert.ok(rehydrated.businessGraphRuntime.getParty("party_restart"));
  assert.equal(rehydrated.businessGraphRuntime.getRelationships()[0].relationshipType, "BUYER");
  assert.equal(rehydrated.requestRuntime.getRequest("req_import_follow_up_boss_600").status, "closed");
  assert.equal(rehydrated.communicationPreferenceRuntime.getPreferencesForParty("party_restart")[0].status, "opt_in");
  assert.equal(rehydrated.interactionRuntime.getInteraction("int_import_follow_up_boss_600").notes[0].text, "Durable note.");
});

test("re-running dry run after commit resolves against newly committed canonical state", async () => {
  const stack = buildStack();
  const repository = new MemoryCommitRepository([
    {
      rowNumber: 1,
      externalId: "700",
      outcomeStatus: "success",
      plannedActions: [createPartyAction({ partyId: "party_dry_after", email: "dry-after@example.com", externalReference: "generic_csv:700" })],
      rawNormalized: { externalContactId: "700" },
    },
  ]);
  const executor = new CrmImportCommitExecutor({ persistSnapshots: async () => {} });
  await executor.execute({ repository, businessId: "ws_import_commit", run: { ...run(), sourceSystem: "generic_csv" }, stack, installationResult: {}, nowISO: NOW });

  const dryRun = new CrmImportDryRunExecutor().execute({
    parsedRows: [{ Id: "700", Email: "dry-after@example.com", Name: "Dry After" }],
    columnMap: { Id: "externalContactId", Email: "email", Name: "fullName" },
    profile: {},
    sourceSystem: "generic_csv",
    importRunId: "run_after_commit",
    canonicalSnapshot: new CanonicalStateReader({ stack }).readSnapshot(),
    installationResult: { qualificationFieldSchemas: [], relationshipTypes: [] },
  });

  assert.ok(!dryRun.rowResults[0].plannedActions.some((action) => action.type === IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY));
});

test("commit service enforces run ownership, dry-run completion, and retryable statuses", async () => {
  const stack = buildStack();
  const baseRun = { ...run(), status: IMPORT_RUN_STATUSES.UPLOADED, stats: {}, lastCommittedRow: 0 };
  const repository = new MemoryRunRepository({ run: baseRun, rows: [] });
  const service = new CrmImportOrchestrationService({
    repository,
    artifactStore: {},
    parser: {},
    dryRunExecutor: {},
    commitExecutor: { execute: async () => ({ stats: { totalRows: 0, committedRows: 0, skippedRows: 0, failedRows: 0 }, rows: [] }) },
  });

  await assert.rejects(
    () => service.commit({ businessId: "ws_import_commit", runId: "run_1", stack, installationResult: {} }),
    /completed dry run/,
  );
  await assert.rejects(
    () => service.commit({ businessId: "other_business", runId: "run_1", stack, installationResult: {} }),
    /Import run not found/,
  );

  for (const status of [
    IMPORT_RUN_STATUSES.DRY_RUN_COMPLETE,
    IMPORT_RUN_STATUSES.COMMIT_IN_PROGRESS,
    IMPORT_RUN_STATUSES.COMMITTED,
    IMPORT_RUN_STATUSES.COMMIT_FAILED,
    IMPORT_RUN_STATUSES.COMMIT_PARTIALLY_FAILED,
  ]) {
    repository.run = { ...baseRun, status };
    const result = await service.commit({ businessId: "ws_import_commit", runId: "run_1", stack, installationResult: {} });
    assert.equal(result.importRun.status, IMPORT_RUN_STATUSES.COMMITTED);
  }
});

test("commit route and executor have no unauthorized side-effect path", () => {
  const root = process.cwd();
  const route = readFileSync(
    join(root, "frontend/app/api/businesses/[businessId]/imports/[runId]/commit/route.ts"),
    "utf8",
  );
  assert.match(route, /PERMISSIONS\.INTEGRATIONS_MANAGE/);
  assert.match(route, /crmImportOrchestrationService\.commit/);
  assert.doesNotMatch(route, /dryRun\(|parser|readArtifactBuffer|uploadArtifact/);

  const executorSource = readFileSync(join(root, "backend/core/import/CrmImportCommitExecutor.js"), "utf8");
  assert.doesNotMatch(executorSource, /InboundBusinessOrchestration|WebhookIngress|OperatingLoop|RecordInteractionService|WorkRuntime|WorkPlatformEvent/);
});
