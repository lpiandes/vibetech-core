import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import {
  ensurePartyRelationship,
  promotePartyRelationship,
  relationshipIdFor,
} from "../business-graph/partyRelationshipClassification.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { persistAffectedRuntimes } from "../persistence/PersistedMutationCoordinator.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { consentWouldWeakenExisting, strongerConsentStatus } from "./ImportMergePolicy.js";
import { deriveImportPlanActionId } from "./ImportPlanAction.js";
import { buildImportProvenanceEntry } from "./ImportProvenance.js";
import {
  IMPORT_PLAN_ACTION_TYPES,
  IMPORT_ROW_COMMIT_STATUSES,
  IMPORT_ROW_OUTCOME_STATUSES,
} from "./ImportRunStatus.js";
import {
  emptyCommitStats,
  incrementCommittedAction,
  incrementCommitStat,
} from "./ImportCommitResult.js";

function sanitizeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "_");
}

function nowOr(value) {
  return String(value ?? new Date().toISOString());
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function appendUnique(existing, additions) {
  const out = [...safeArray(existing).map(String)];
  for (const addition of safeArray(additions)) {
    const value = String(addition ?? "");
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function provenanceFor({ run, row, nowISO }) {
  return buildImportProvenanceEntry({
    sourceSystem: run.sourceSystem,
    externalId: row.externalId ?? row.rawNormalized?.externalContactId ?? "",
    importRunId: run.id,
    rowNumber: row.rowNumber,
    importedAt: nowISO,
  });
}

function metadataWithProvenance(metadata, provenance) {
  const prev = metadata && typeof metadata === "object" ? metadata : {};
  const existing = safeArray(prev.importProvenance);
  const key = JSON.stringify(provenance);
  const already = existing.some((entry) => JSON.stringify(entry) === key);
  return {
    ...prev,
    importProvenance: already ? existing : [...existing, provenance],
  };
}

function actionIdFor({ run, row, action, actionIndex }) {
  return (
    action?.actionId ??
    deriveImportPlanActionId({
      importRunId: run.id,
      rowNumber: row.rowNumber,
      actionIndex,
      actionType: action?.type,
    })
  );
}

function rowEligible(row, { allowReviewCommit }) {
  const status = String(row.outcomeStatus);
  if (status === IMPORT_ROW_OUTCOME_STATUSES.ERROR) return { ok: false, reason: "dry_run_error" };
  if (status === IMPORT_ROW_OUTCOME_STATUSES.REVIEW && !allowReviewCommit) {
    return { ok: false, reason: "review_requires_explicit_allowance" };
  }
  if (status === IMPORT_ROW_OUTCOME_STATUSES.SKIPPED) return { ok: false, reason: "dry_run_skipped" };
  return { ok: true };
}

function patchWouldChangeParty(party, patch) {
  if (!party) return true;
  if (patch.displayName && String(party.displayName) !== String(patch.displayName)) return true;
  for (const method of safeArray(patch.contactMethodsAdd)) {
    if (!safeArray(party.contactMethods).map(String).includes(String(method))) return true;
  }
  for (const ref of safeArray(patch.externalReferencesAdd)) {
    if (!safeArray(party.externalReferences).map(String).includes(String(ref))) return true;
  }
  const metadata = patch.metadata && typeof patch.metadata === "object" ? patch.metadata : {};
  for (const [key, value] of Object.entries(metadata)) {
    if (JSON.stringify(party.metadata?.[key]) !== JSON.stringify(value)) return true;
  }
  return false;
}

export class CrmImportCommitExecutor {
  constructor({ persistSnapshots = persistAffectedRuntimes } = {}) {
    this.persistSnapshots = persistSnapshots;
  }

  async execute({
    repository,
    businessId,
    run,
    stack,
    installationResult,
    userId = null,
    allowReviewCommit = false,
    nowISO = new Date().toISOString(),
    persistence,
  } = {}) {
    if (!repository) throw new Error("CrmImportCommitExecutor.execute requires repository.");
    if (!run) throw new Error("CrmImportCommitExecutor.execute requires run.");
    if (!stack) throw new Error("CrmImportCommitExecutor.execute requires stack.");

    const stats = emptyCommitStats();
    const rowSummaries = [];
    const rows = await repository.listAllRowResults({ importRunId: run.id, businessId });
    incrementCommitStat(stats, "totalRows", rows.length);

    for (const row of rows) {
      const result = await this.commitRow({
        repository,
        businessId,
        run,
        row,
        stack,
        installationResult,
        allowReviewCommit,
        nowISO,
        persistence,
      });
      rowSummaries.push(result);
      if (result.commitStatus === IMPORT_ROW_COMMIT_STATUSES.COMMITTED) {
        incrementCommitStat(stats, "committedRows");
        for (const actionType of result.committedActionTypes ?? []) {
          incrementCommittedAction(stats, actionType);
        }
      } else if (result.commitStatus === IMPORT_ROW_COMMIT_STATUSES.SKIPPED) {
        incrementCommitStat(stats, "skippedRows");
      } else if (result.commitStatus === IMPORT_ROW_COMMIT_STATUSES.FAILED) {
        incrementCommitStat(stats, "failedRows");
      }
    }

    return {
      stats,
      rows: rowSummaries,
      committedByUserId: userId ?? null,
    };
  }

  async commitRow({
    repository,
    businessId,
    run,
    row,
    stack,
    installationResult,
    allowReviewCommit,
    nowISO,
    persistence,
  }) {
    const eligibility = rowEligible(row, { allowReviewCommit });
    if (!eligibility.ok) {
      const skipped = {
        rowNumber: row.rowNumber,
        commitStatus: IMPORT_ROW_COMMIT_STATUSES.SKIPPED,
        reason: eligibility.reason,
        committedActionTypes: [],
      };
      await repository.updateRowCommitState({
        importRunId: run.id,
        businessId,
        rowNumber: row.rowNumber,
        commitStatus: IMPORT_ROW_COMMIT_STATUSES.SKIPPED,
        commitResult: skipped,
        commitError: null,
        committedAt: nowISO,
        incrementAttempts: true,
      });
      return skipped;
    }

    const touchedKinds = new Set();
    const committedActionTypes = [];

    try {
      const actions = safeArray(row.plannedActions);
      for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
        const action = actions[actionIndex];
        const actionId = actionIdFor({ run, row, action, actionIndex });
        const result = this.applyAction({
          action: { ...action, actionId },
          run,
          row,
          stack,
          installationResult,
          nowISO,
        });
        if (result?.kind) touchedKinds.add(result.kind);
        if (result?.committed) committedActionTypes.push(action.type);
      }

      const commitResult = {
        rowNumber: row.rowNumber,
        committedActionTypes,
        actionCount: actions.length,
      };
      await repository.updateRowCommitState({
        importRunId: run.id,
        businessId,
        rowNumber: row.rowNumber,
        commitStatus: IMPORT_ROW_COMMIT_STATUSES.COMMITTED,
        commitResult,
        commitError: null,
        committedAt: nowISO,
        incrementAttempts: true,
      });

      if (touchedKinds.size) {
        await this.persistSnapshots({
          workspaceId: businessId,
          stack,
          integrationPlatform: null,
          kinds: [...touchedKinds],
          persistence,
        });
      }

      return {
        rowNumber: row.rowNumber,
        commitStatus: IMPORT_ROW_COMMIT_STATUSES.COMMITTED,
        committedActionTypes,
      };
    } catch (err) {
      const commitError = {
        message: String(err?.message ?? err),
        code: err?.code ? String(err.code) : "COMMIT_ACTION_FAILED",
      };
      await repository.updateRowCommitState({
        importRunId: run.id,
        businessId,
        rowNumber: row.rowNumber,
        commitStatus: IMPORT_ROW_COMMIT_STATUSES.FAILED,
        commitResult: null,
        commitError,
        committedAt: null,
        incrementAttempts: true,
      });
      return {
        rowNumber: row.rowNumber,
        commitStatus: IMPORT_ROW_COMMIT_STATUSES.FAILED,
        error: commitError,
        committedActionTypes,
      };
    }
  }

  applyAction({ action, run, row, stack, installationResult, nowISO }) {
    switch (action.type) {
      case IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY:
        return this.createParty({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.UPDATE_PARTY:
        return this.updateParty({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.ADD_RELATIONSHIP:
        return this.addRelationship({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.PROMOTE_RELATIONSHIP:
        return this.promoteRelationship({ action, run, row, stack, installationResult, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.RECORD_QUALIFICATION:
        return this.recordQualification({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT:
        return this.recordConsent({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.RECORD_NOTE:
        return this.recordNote({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.SKIP:
      case IMPORT_PLAN_ACTION_TYPES.REVIEW:
        return { committed: false, kind: null };
      default:
        throw new Error(`Unsupported import commit action: ${String(action.type)}`);
    }
  }

  createParty({ action, run, row, stack, nowISO }) {
    const payload = action.payload ?? {};
    const partyId = String(payload.partyId ?? "");
    if (!partyId) throw new Error("CREATE_PARTY requires partyId.");
    if (stack.businessGraphRuntime.getParty(partyId)) return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };

    const contactMethods = [payload.email, payload.phone].filter(Boolean).map(String);
    const externalReferences = payload.externalReference ? [String(payload.externalReference)] : [];
    const provenance = provenanceFor({ run, row, nowISO });
    stack.businessGraphRuntime.applyEvent({
      id: `evt_import_party_created_${sanitizeId(action.actionId)}`,
      timestampISO: nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
      source: "crm_import_commit",
      payload: {
        party: {
          id: partyId,
          partyType: "PERSON",
          displayName: String(payload.displayName ?? "Contact"),
          status: "active",
          contactMethods,
          externalReferences,
          metadata: metadataWithProvenance(payload.metadata, provenance),
          createdAt: nowISO,
          updatedAt: nowISO,
        },
      },
    });
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };
  }

  updateParty({ action, run, row, stack, nowISO }) {
    const payload = action.payload ?? {};
    const partyId = String(payload.partyId ?? "");
    const party = stack.businessGraphRuntime.getParty(partyId);
    if (!party) throw new Error(`UPDATE_PARTY party not found: ${partyId}`);
    const patch = payload.patch ?? {};
    if (!patchWouldChangeParty(party, patch)) return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };

    const provenance = provenanceFor({ run, row, nowISO });
    const mergedPatch = {};
    if (patch.displayName) mergedPatch.displayName = String(patch.displayName);
    mergedPatch.contactMethods = appendUnique(party.contactMethods, patch.contactMethodsAdd);
    mergedPatch.externalReferences = appendUnique(party.externalReferences, patch.externalReferencesAdd);
    mergedPatch.metadata = metadataWithProvenance({ ...(party.metadata ?? {}), ...(patch.metadata ?? {}) }, provenance);

    stack.businessGraphRuntime.applyEvent({
      id: `evt_import_party_updated_${sanitizeId(action.actionId)}`,
      timestampISO: nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_UPDATED,
      source: "crm_import_commit",
      payload: { partyId, patch: mergedPatch },
    });
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };
  }

  addRelationship({ action, run, row, stack, nowISO }) {
    const payload = action.payload ?? {};
    const partyId = String(payload.partyId ?? "");
    const relationshipType = String(payload.relationshipType ?? "");
    const provenance = provenanceFor({ run, row, nowISO });
    const result = ensurePartyRelationship({
      stack,
      partyId,
      relationshipType,
      nowISO,
      metadata: { importProvenance: [provenance] },
    });
    if (!result.ok) throw new Error(result.message ?? result.reason ?? "ADD_RELATIONSHIP failed.");
    return { committed: !result.duplicate, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };
  }

  promoteRelationship({ action, run, row, stack, installationResult, nowISO }) {
    const payload = action.payload ?? {};
    const partyId = String(payload.partyId ?? "");
    const fromRelationshipType = String(payload.fromRelationshipType ?? "");
    const toRelationshipType = String(payload.toRelationshipType ?? "");
    const toRelId = relationshipIdFor(partyId, toRelationshipType);
    const fromRelId = relationshipIdFor(partyId, fromRelationshipType);
    const toRel = stack.businessGraphRuntime.getRelationship(toRelId);
    const fromRel = stack.businessGraphRuntime.getRelationship(fromRelId);
    if (toRel && String(toRel.status) === "active" && (!fromRel || String(fromRel.status) !== "active")) {
      return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };
    }
    const result = promotePartyRelationship({
      stack,
      partyId,
      fromRelationshipType,
      toRelationshipType,
      nowISO,
      lifecycleTransitions: installationResult?.lifecycleTransitions ?? [],
    });
    if (!result.ok) throw new Error(result.message ?? result.reason ?? "PROMOTE_RELATIONSHIP failed.");

    const provenance = provenanceFor({ run, row, nowISO });
    const promoted = stack.businessGraphRuntime.getRelationship(toRelId);
    if (promoted) {
      stack.businessGraphRuntime.applyEvent({
        id: `evt_import_relationship_updated_${sanitizeId(action.actionId)}`,
        timestampISO: nowISO,
        type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_UPDATED,
        source: "crm_import_commit",
        payload: {
          relationshipId: toRelId,
          patch: { metadata: metadataWithProvenance(promoted.metadata, provenance) },
        },
      });
    }
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };
  }

  recordQualification({ action, run, row, stack, nowISO }) {
    const payload = action.payload ?? {};
    const requestId = String(payload.requestId ?? "");
    const partyId = String(payload.partyId ?? "");
    if (!requestId || !partyId) throw new Error("RECORD_QUALIFICATION requires requestId and partyId.");
    const existing = stack.requestRuntime.getRequest(requestId);
    const provenance = provenanceFor({ run, row, nowISO });
    const metadata = {
      qualification: payload.qualification ?? {},
      importProvenance: [provenance],
      importOnly: true,
    };
    let committed = false;
    if (!existing) {
      stack.requestRuntime.applyEvent({
        id: `evt_import_request_received_${sanitizeId(action.actionId)}`,
        timestampISO: nowISO,
        type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
        source: "crm_import_commit",
        payload: {
          request: {
            id: requestId,
            title: "CRM import profile",
            description: "Imported CRM qualification profile.",
            requestType: "crm_import_profile",
            priority: "low",
            channel: "api",
            source: "crm_import",
            requester: partyId,
            receivedAt: nowISO,
            dueAt: null,
            assignedWorkId: null,
            assignedTeamMemberId: null,
            qualificationStatus: "imported",
            attachments: [],
            metadata,
            inboundAttribution: payload.inboundAttribution ?? null,
            subjectRefs: [],
          },
        },
      });
      committed = true;
    }
    const current = stack.requestRuntime.getRequest(requestId);
    if (
      current &&
      JSON.stringify(current.metadata?.qualification ?? {}) !== JSON.stringify(payload.qualification ?? {})
    ) {
      stack.requestRuntime.applyEvent({
        id: `evt_import_request_updated_${sanitizeId(action.actionId)}`,
        timestampISO: nowISO,
        type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
        source: "crm_import_commit",
        payload: {
          requestId,
          patch: {
            qualificationStatus: "imported",
            metadata,
            inboundAttribution: payload.inboundAttribution ?? null,
          },
        },
      });
      committed = true;
    }
    const afterUpdate = stack.requestRuntime.getRequest(requestId);
    if (afterUpdate && String(afterUpdate.status) !== "closed") {
      stack.requestRuntime.applyEvent({
        id: `evt_import_request_closed_${sanitizeId(action.actionId)}`,
        timestampISO: nowISO,
        type: REQUEST_EVENT_TYPES.REQUEST_CLOSED,
        source: "crm_import_commit",
        payload: { requestId },
      });
      committed = true;
    }
    return { committed, kind: RUNTIME_SNAPSHOT_KINDS.REQUEST };
  }

  recordConsent({ action, row, run, stack, nowISO }) {
    const payload = action.payload ?? {};
    const partyId = String(payload.partyId ?? "");
    const consent = payload.consent ?? {};
    const channel = String(consent.channel ?? "");
    const scope = String(consent.scope ?? "all");
    const plannedStatus = String(consent.status ?? "");
    const existing = (stack.communicationPreferenceRuntime.getPreferencesForParty(partyId) ?? []).find(
      (p) => String(p.channel) === channel && String(p.scope) === scope,
    );
    if (existing && consentWouldWeakenExisting(existing.status, plannedStatus)) {
      throw new Error(`RECORD_CONSENT would weaken existing ${channel} preference.`);
    }
    const nextStatus = existing ? strongerConsentStatus(existing.status, plannedStatus) : plannedStatus;
    if (existing && String(existing.status) === String(nextStatus)) {
      return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.COMMUNICATION_PREFERENCE };
    }
    const recordedAt = nowOr(consent.recordedAt ?? nowISO);
    stack.communicationPreferenceRuntime.applyEvent({
      id: `evt_import_preference_recorded_${sanitizeId(action.actionId)}`,
      timestampISO: recordedAt,
      type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
      source: "crm_import_commit",
      payload: {
        preference: {
          id: existing?.id ?? `pref_${sanitizeId(partyId)}_${sanitizeId(channel)}_${sanitizeId(scope)}`,
          partyId,
          workspaceId: String(run.businessId ?? ""),
          channel,
          scope,
          status: nextStatus,
          source: consent.source ?? `crm_import:${run.sourceSystem}`,
          recordedAt,
          externalReference: consent.externalReference ?? null,
        },
      },
    });
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.COMMUNICATION_PREFERENCE };
  }

  recordNote({ action, run, row, stack, nowISO }) {
    const payload = action.payload ?? {};
    const interactionId = String(payload.interactionId ?? "");
    const partyId = String(payload.partyId ?? "");
    if (!interactionId || !partyId) throw new Error("RECORD_NOTE requires interactionId and partyId.");
    if (stack.interactionRuntime.getInteraction(interactionId)) {
      return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.INTERACTION };
    }
    const provenance = provenanceFor({ run, row, nowISO });
    const noteId = `note_${sanitizeId(interactionId)}_${sanitizeId(action.actionId)}`;
    stack.interactionRuntime.applyEvent({
      id: `evt_import_interaction_recorded_${sanitizeId(action.actionId)}`,
      timestampISO: nowISO,
      type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
      source: "crm_import_commit",
      payload: {
        interaction: {
          id: interactionId,
          interactionType: "note",
          direction: "internal",
          channel: "api",
          occurredAt: nowISO,
          participants: [{ partyId, participantType: "primary" }],
          relatedObjects: [
            createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          ],
          ownerId: null,
          status: "active",
          summary: "Imported CRM note",
          notes: [
            {
              id: noteId,
              interactionId,
              authorId: "crm_import",
              timestampISO: nowISO,
              text: String(payload.notes ?? ""),
              relatedObjects: [],
              metadata: { importProvenance: provenance },
            },
          ],
          outcome: null,
          nextStep: null,
          followUpAt: null,
          source: "crm_import",
          externalReference: provenance.externalReference,
          metadata: metadataWithProvenance({}, provenance),
          createdAt: nowISO,
          updatedAt: nowISO,
        },
      },
    });
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.INTERACTION };
  }
}

export function createCrmImportCommitExecutor(options = {}) {
  return new CrmImportCommitExecutor(options);
}

export const crmImportCommitExecutor = createCrmImportCommitExecutor();
