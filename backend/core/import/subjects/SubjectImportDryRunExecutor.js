import {
  emptyDryRunStats,
  incrementStat,
  incrementActionStat,
  createImportDryRunResult,
} from "../ImportDryRunResult.js";
import { createImportPlanAction, deriveImportPlanActionId } from "../ImportPlanAction.js";
import { IMPORT_RUN_STATUSES, IMPORT_PLAN_ACTION_TYPES } from "../ImportRunStatus.js";
import { mapSourceRowToSubjectFields, buildNormalizedSubjectRow } from "./SubjectImportNormalizer.js";
import { resolveSubjectIdentity } from "./SubjectIdentityResolver.js";
import { buildSubjectImportPlanForRow } from "./SubjectImportPlanBuilder.js";

function duplicateIdentityKey(normalizedRow) {
  if (normalizedRow.externalReference) return `external:${normalizedRow.externalReference}`;
  if (normalizedRow.normalizedAddress) return `address:${normalizedRow.normalizedAddress}`;
  return null;
}

export class SubjectImportDryRunExecutor {
  execute({
    parsedRows,
    columnMap,
    profile,
    sourceSystem,
    importRunId,
    canonicalSnapshot,
    installationResult,
  } = {}) {
    const stats = emptyDryRunStats();
    const rowResults = [];
    const seenIdentityKeys = new Set();
    const workspaceId = String(
      installationResult?.workspaceId ??
        installationResult?.businessId ??
        canonicalSnapshot?.workspaceId ??
        "",
    );

    for (const sourceRow of parsedRows ?? []) {
      const rowNumber = rowResults.length + 1;
      const { canonical, unmapped } = mapSourceRowToSubjectFields({ sourceRow, columnMap, profile });
      const normalizedRow = buildNormalizedSubjectRow({ canonical, sourceSystem, rowNumber, profile });
      const warnings = [];
      const errors = [];
      incrementStat(stats, "totalRows");

      const identityKey = duplicateIdentityKey(normalizedRow);
      if (identityKey && seenIdentityKeys.has(identityKey)) warnings.push("duplicate_subject_identity_in_file");
      if (identityKey) seenIdentityKeys.add(identityKey);

      const identity = warnings.includes("duplicate_subject_identity_in_file")
        ? {
            subjectId: null,
            matchTier: "conflict",
            isNew: false,
            matchedSubject: null,
            identityConflict: true,
            conflictingSubjectIds: [],
            reviewReason: "duplicate_subject_identity_in_file",
          }
        : resolveSubjectIdentity({ normalizedRow, canonicalSnapshot, workspaceId, sourceSystem });

      const plan = buildSubjectImportPlanForRow({
        normalizedRow,
        identity,
        canonicalSnapshot,
        workspaceId,
      });

      warnings.push(...plan.warnings);
      errors.push(...plan.errors);

      const plannedActions = plan.plannedActions.map((action, actionIndex) =>
        action?.actionId
          ? action
          : createImportPlanAction({
              type: action.type,
              payload: action.payload,
              actionId: deriveImportPlanActionId({
                importRunId,
                rowNumber,
                actionIndex,
                actionType: action.type,
              }),
            }),
      );

      let outcomeStatus = plan.outcomeStatus;
      if (errors.length) outcomeStatus = "error";
      else if (outcomeStatus === "review") incrementStat(stats, "reviewRequired");
      else if (outcomeStatus === "warning") incrementStat(stats, "warnings");
      else if (outcomeStatus === "skipped") incrementStat(stats, "wouldSkip");
      else if (plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.CREATE_SUBJECT)) {
        incrementStat(stats, "wouldCreate");
      } else if (plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.UPDATE_SUBJECT)) {
        incrementStat(stats, "wouldUpdate");
      } else {
        incrementStat(stats, "wouldSkip");
      }

      if (errors.length) incrementStat(stats, "errors");
      if (warnings.length && !errors.length && outcomeStatus !== "review") incrementStat(stats, "warnings");
      for (const action of plannedActions) incrementActionStat(stats, action.type);

      rowResults.push({
        rowNumber,
        externalId: normalizedRow.externalSubjectId ?? normalizedRow.normalizedAddress ?? null,
        resolvedPartyId: null,
        matchTier: plan.matchTier,
        plannedActions,
        outcomeStatus,
        warnings,
        errors,
        rawNormalized: {
          ...normalizedRow,
          resolvedSubjectId: plan.resolvedSubjectId,
          unresolvedReason: identity.reviewReason ?? null,
        },
        rawUnmapped: unmapped,
      });
    }

    const planSummary = {
      byMatchTier: rowResults.reduce((acc, row) => {
        const tier = row.matchTier ?? "unknown";
        acc[tier] = Number(acc[tier] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return {
      dryRunResult: createImportDryRunResult({
        importRunId,
        status: IMPORT_RUN_STATUSES.DRY_RUN_COMPLETE,
        stats,
        planSummary,
      }),
      rowResults,
    };
  }
}
