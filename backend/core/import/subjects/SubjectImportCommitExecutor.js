import { BUSINESS_SUBJECT_EVENT_TYPES } from "../../business-subject/BusinessSubjectEventTypes.js";
import { ensurePartySubjectRelationship } from "../../business-graph/partySubjectRelationship.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import { persistAffectedRuntimes } from "../../persistence/PersistedMutationCoordinator.js";
import { buildImportProvenanceEntry } from "../ImportProvenance.js";
import { deriveImportPlanActionId } from "../ImportPlanAction.js";
import {
  IMPORT_PLAN_ACTION_TYPES,
  IMPORT_ROW_COMMIT_STATUSES,
  IMPORT_ROW_OUTCOME_STATUSES,
} from "../ImportRunStatus.js";
import { emptyCommitStats, incrementCommittedAction, incrementCommitStat } from "../ImportCommitResult.js";

function sanitizeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "_");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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

function provenanceFor({ run, row, nowISO }) {
  return buildImportProvenanceEntry({
    sourceSystem: run.sourceSystem,
    externalId: row.externalId ?? row.rawNormalized?.externalSubjectId ?? "",
    importRunId: run.id,
    rowNumber: row.rowNumber,
    importedAt: nowISO,
  });
}

function mergeSubjectPatch(subject, patch) {
  const merged = {};
  if (patch.displayName) merged.displayName = String(patch.displayName);
  if (patch.keyAttributes && typeof patch.keyAttributes === "object") {
    merged.keyAttributes = { ...(subject.keyAttributes ?? {}), ...patch.keyAttributes };
  }
  if (Array.isArray(patch.externalReferences)) {
    const refs = [...safeArray(subject.externalReferences).map(String)];
    for (const ref of patch.externalReferences) {
      const value = String(ref ?? "");
      if (value && !refs.includes(value)) refs.push(value);
    }
    merged.externalReferences = refs;
  }
  return merged;
}

function patchWouldChangeSubject(subject, patch) {
  const merged = mergeSubjectPatch(subject, patch);
  if (merged.displayName && String(subject.displayName) !== merged.displayName) return true;
  if (merged.keyAttributes && JSON.stringify(subject.keyAttributes ?? {}) !== JSON.stringify(merged.keyAttributes)) return true;
  if (merged.externalReferences && JSON.stringify(subject.externalReferences ?? []) !== JSON.stringify(merged.externalReferences)) return true;
  return false;
}

export class SubjectImportCommitExecutor {
  constructor({ persistSnapshots = persistAffectedRuntimes } = {}) {
    this.persistSnapshots = persistSnapshots;
  }

  async execute({
    repository,
    businessId,
    run,
    stack,
    allowReviewCommit = false,
    nowISO = new Date().toISOString(),
    persistence,
  } = {}) {
    if (!repository) throw new Error("SubjectImportCommitExecutor.execute requires repository.");
    if (!run) throw new Error("SubjectImportCommitExecutor.execute requires run.");
    if (!stack) throw new Error("SubjectImportCommitExecutor.execute requires stack.");

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
        allowReviewCommit,
        nowISO,
        persistence,
      });
      rowSummaries.push(result);
      if (result.commitStatus === IMPORT_ROW_COMMIT_STATUSES.COMMITTED) {
        incrementCommitStat(stats, "committedRows");
        for (const actionType of result.committedActionTypes ?? []) incrementCommittedAction(stats, actionType);
      } else if (result.commitStatus === IMPORT_ROW_COMMIT_STATUSES.SKIPPED) incrementCommitStat(stats, "skippedRows");
      else if (result.commitStatus === IMPORT_ROW_COMMIT_STATUSES.FAILED) incrementCommitStat(stats, "failedRows");
    }

    return { stats, rows: rowSummaries };
  }

  async commitRow({ repository, businessId, run, row, stack, allowReviewCommit, nowISO, persistence }) {
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
        const result = this.applyAction({ action: { ...action, actionId }, run, row, stack, nowISO });
        if (result?.kind) touchedKinds.add(result.kind);
        if (result?.committed) committedActionTypes.push(action.type);
      }

      const commitResult = { rowNumber: row.rowNumber, committedActionTypes, actionCount: actions.length };
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

      return { rowNumber: row.rowNumber, commitStatus: IMPORT_ROW_COMMIT_STATUSES.COMMITTED, committedActionTypes };
    } catch (err) {
      const commitError = {
        message: String(err?.message ?? err),
        code: err?.code ? String(err.code) : "SUBJECT_COMMIT_ACTION_FAILED",
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

  applyAction({ action, run, row, stack, nowISO }) {
    switch (action.type) {
      case IMPORT_PLAN_ACTION_TYPES.CREATE_SUBJECT:
        return this.createSubject({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.UPDATE_SUBJECT:
        return this.updateSubject({ action, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.LINK_PARTY_TO_SUBJECT:
        return this.linkPartyToSubject({ action, run, row, stack, nowISO });
      case IMPORT_PLAN_ACTION_TYPES.SKIP:
      case IMPORT_PLAN_ACTION_TYPES.REVIEW:
        return { committed: false, kind: null };
      default:
        throw new Error(`Unsupported subject import action: ${String(action.type)}`);
    }
  }

  createSubject({ action, run, row, stack, nowISO }) {
    const subject = action.payload?.subject ?? {};
    const subjectId = String(subject.id ?? "");
    if (!subjectId) throw new Error("CREATE_SUBJECT requires subject.id.");
    if (stack.businessSubjectRuntime.getSubject(subjectId)) {
      return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT };
    }
    stack.businessSubjectRuntime.applyEvent({
      id: `evt_import_subject_created_${sanitizeId(action.actionId)}`,
      timestampISO: nowISO,
      type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
      source: "subject_import_commit",
      payload: {
        subject: {
          ...subject,
          createdAt: nowISO,
          updatedAt: nowISO,
        },
      },
    });
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT };
  }

  updateSubject({ action, stack, nowISO }) {
    const subjectId = String(action.payload?.subjectId ?? "");
    const subject = stack.businessSubjectRuntime.getSubject(subjectId);
    if (!subject) throw new Error(`UPDATE_SUBJECT subject not found: ${subjectId}`);
    const patch = action.payload?.patch ?? {};
    if (!patchWouldChangeSubject(subject, patch)) return { committed: false, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT };
    stack.businessSubjectRuntime.applyEvent({
      id: `evt_import_subject_updated_${sanitizeId(action.actionId)}`,
      timestampISO: nowISO,
      type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_UPDATED,
      source: "subject_import_commit",
      payload: { subjectId, patch: mergeSubjectPatch(subject, patch) },
    });
    return { committed: true, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT };
  }

  linkPartyToSubject({ action, run, row, stack, nowISO }) {
    const payload = action.payload ?? {};
    const provenance = provenanceFor({ run, row, nowISO });
    const result = ensurePartySubjectRelationship({
      stack,
      partyId: payload.partyId,
      subjectId: payload.subjectId,
      relationshipType: payload.relationshipType ?? "INTERESTED_IN",
      nowISO,
      source: "subject_import_commit",
      metadata: {
        importProvenance: [provenance],
        evidence: payload.evidence ?? null,
      },
    });
    if (!result.ok) throw new Error(result.message ?? result.reason ?? "LINK_PARTY_TO_SUBJECT failed.");
    return { committed: !result.duplicate, kind: RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH };
  }
}
