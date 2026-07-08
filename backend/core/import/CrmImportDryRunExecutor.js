import {
  detectCanonicalConflicts,
  detectConsentConflicts,
  detectIntraFileDuplicate,
  detectRelationshipConflicts,
} from "./ConflictDetector.js";
import { resolveIdentity } from "./IdentityResolver.js";
import { validateImportRow } from "./validation/ImportRowValidator.js";
import {
  mapSourceRowToCanonicalFields,
  buildNormalizedContactRow,
} from "./normalizers/ContactFieldNormalizer.js";
import { buildImportPlanForRow } from "./ImportPlanBuilder.js";
import {
  emptyDryRunStats,
  incrementStat,
  incrementActionStat,
  createImportDryRunResult,
} from "./ImportDryRunResult.js";
import { IMPORT_RUN_STATUSES, IMPORT_PLAN_ACTION_TYPES } from "./ImportRunStatus.js";
import { createImportPlanAction, deriveImportPlanActionId } from "./ImportPlanAction.js";

/**
 * Simulates import planning without canonical mutation.
 */
export class CrmImportDryRunExecutor {
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
    const seenExternalRefs = new Set();
    const seenEmails = new Set();
    const seenPhones = new Set();

    for (const sourceRow of parsedRows) {
      const rowNumber = rowResults.length + 1;
      const { canonical, unmapped } = mapSourceRowToCanonicalFields({
        sourceRow,
        columnMap,
        profile,
      });

      for (const [key, value] of Object.entries(profile?.qualificationFieldMap ?? {})) {
        if (sourceRow[key] !== undefined) canonical[value] = sourceRow[key];
      }

      const normalizedRow = buildNormalizedContactRow({
        canonical,
        sourceSystem,
        rowNumber,
      });

      incrementStat(stats, "totalRows");

      const rowValidation = validateImportRow({ normalizedRow });
      const intra = detectIntraFileDuplicate({
        normalizedRow,
        seenExternalRefs,
        seenEmails,
        seenPhones,
      });

      const identity = resolveIdentity({ normalizedRow, sourceSystem, canonicalSnapshot });
      const canonicalConflicts = detectCanonicalConflicts({ normalizedRow, identity, canonicalSnapshot });

      const plan = buildImportPlanForRow({
        normalizedRow,
        identity,
        canonicalSnapshot,
        installationResult,
        profile,
        sourceSystem,
        importRunId,
        lifecycleTransitions: installationResult?.lifecycleTransitions ?? [],
      });

      const consentConflicts = detectConsentConflicts({
        normalizedRow,
        partyId: identity.partyId,
        canonicalSnapshot,
        plannedConsents: plan.plannedActions
          .filter((a) => a.type === IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT)
          .map((a) => a.payload.consent),
      });

      const relConflicts = detectRelationshipConflicts({
        relationshipType: normalizedRow.relationshipType,
        partyId: identity.partyId,
        canonicalSnapshot,
        lifecycleTransitions: installationResult?.lifecycleTransitions ?? [],
        lifecycleFrom: normalizedRow.lifecycleFrom,
        lifecycleTo: normalizedRow.lifecycleTo,
      });

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

      const warnings = [
        ...rowValidation.warnings,
        ...intra.warnings,
        ...canonicalConflicts.warnings,
        ...plan.warnings,
        ...consentConflicts.warnings,
        ...relConflicts.warnings,
      ];
      const errors = [
        ...rowValidation.errors,
        ...intra.errors,
        ...canonicalConflicts.errors,
        ...plan.errors,
        ...consentConflicts.errors,
        ...relConflicts.errors,
      ];

      let outcomeStatus = plan.outcomeStatus;
      if (errors.length) outcomeStatus = "error";
      else if (outcomeStatus === "review") incrementStat(stats, "reviewRequired");
      else if (outcomeStatus === "warning") incrementStat(stats, "warnings");
      else if (outcomeStatus === "skipped") incrementStat(stats, "wouldSkip");
      else if (plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY)) {
        incrementStat(stats, "wouldCreate");
      } else if (plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.UPDATE_PARTY)) {
        incrementStat(stats, "wouldUpdate");
      } else {
        incrementStat(stats, "wouldSkip");
      }

      if (errors.length) incrementStat(stats, "errors");
      if (warnings.length && !errors.length && outcomeStatus !== "review") incrementStat(stats, "warnings");

      for (const action of plannedActions) {
        incrementActionStat(stats, action.type);
      }

      rowResults.push({
        rowNumber,
        externalId: normalizedRow.externalContactId,
        resolvedPartyId: plan.resolvedPartyId,
        matchTier: plan.matchTier,
        plannedActions: plannedActions,
        outcomeStatus,
        warnings,
        errors,
        rawNormalized: normalizedRow,
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
