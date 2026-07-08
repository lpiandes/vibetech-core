import { createImportPlanAction } from "./ImportPlanAction.js";
import { IMPORT_PLAN_ACTION_TYPES, IMPORT_MATCH_TIERS, IMPORT_ROW_OUTCOME_STATUSES } from "./ImportRunStatus.js";
import { shouldFillIfEmpty } from "./ImportMergePolicy.js";
import { validateQualificationImportFields } from "./validation/QualificationImportValidator.js";
import { planConsentFromRow } from "./validation/ConsentImportValidator.js";
import { validateRelationshipType } from "./validation/RelationshipImportValidator.js";

export function buildImportPlanForRow({
  normalizedRow,
  identity,
  canonicalSnapshot,
  installationResult,
  profile,
  sourceSystem,
  importRunId,
  lifecycleTransitions = [],
} = {}) {
  const plannedActions = [];
  const warnings = [];
  const errors = [];

  if (identity.identityConflict) {
    plannedActions.push(createImportPlanAction({ type: IMPORT_PLAN_ACTION_TYPES.REVIEW, payload: { reason: "identity_conflict" } }));
    return finalizePlan({ plannedActions, warnings, errors, identity });
  }

  if (identity.matchTier === IMPORT_MATCH_TIERS.NAME_SUGGESTED) {
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.REVIEW,
        payload: {
          reason: "name_suggested_match",
          suggestedPartyIds: identity.suggestedParties.map((p) => String(p.id)),
        },
      }),
    );
    return finalizePlan({ plannedActions, warnings, errors, identity });
  }

  const partyId = identity.partyId;
  const existingParty = canonicalSnapshot.parties.find((p) => String(p.id) === String(partyId));

  if (identity.isNew) {
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY,
        payload: {
          partyId,
          displayName: normalizedRow.displayName ?? "Contact",
          email: normalizedRow.email,
          phone: normalizedRow.phone,
          externalReference: identity.externalReference,
          metadata: buildPartyMetadata(normalizedRow),
        },
      }),
    );
  } else if (existingParty) {
    const patch = buildPartyPatch(existingParty, normalizedRow, identity);
    if (Object.keys(patch).length) {
      plannedActions.push(
        createImportPlanAction({
          type: IMPORT_PLAN_ACTION_TYPES.UPDATE_PARTY,
          payload: { partyId, patch },
        }),
      );
    } else {
      plannedActions.push(createImportPlanAction({ type: IMPORT_PLAN_ACTION_TYPES.SKIP, payload: { reason: "no_party_changes" } }));
    }
  }

  if (normalizedRow.relationshipType) {
    const relValidation = validateRelationshipType({
      relationshipType: normalizedRow.relationshipType,
      installationResult,
    });
    if (!relValidation.ok) {
      errors.push(...(relValidation.errors ?? []));
    } else if (partyId) {
      const active = canonicalSnapshot.activeRelationshipTypesByPartyId?.[partyId] ?? [];
      if (!active.includes(normalizedRow.relationshipType)) {
        if (normalizedRow.lifecycleFrom && normalizedRow.lifecycleTo) {
          plannedActions.push(
            createImportPlanAction({
              type: IMPORT_PLAN_ACTION_TYPES.PROMOTE_RELATIONSHIP,
              payload: {
                partyId,
                fromRelationshipType: normalizedRow.lifecycleFrom,
                toRelationshipType: normalizedRow.lifecycleTo,
              },
            }),
          );
        } else {
          plannedActions.push(
            createImportPlanAction({
              type: IMPORT_PLAN_ACTION_TYPES.ADD_RELATIONSHIP,
              payload: {
                partyId,
                relationshipType: normalizedRow.relationshipType,
              },
            }),
          );
        }
      }
    }
  }

  const qualResult = validateQualificationImportFields(
    normalizedRow.qualification ?? {},
    installationResult?.qualificationFieldSchemas ?? [],
  );
  warnings.push(...qualResult.warnings);
  if (Object.keys(qualResult.validated).length && partyId) {
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.RECORD_QUALIFICATION,
        payload: {
          partyId,
          requestId: `req_import_${sourceSystem}_${normalizedRow.externalContactId ?? normalizedRow.rowNumber}`,
          qualification: qualResult.validated,
          inboundAttribution: {
            sourceLabel: `${sourceSystem} import`,
            channel: "import",
            externalObjectId: normalizedRow.externalContactId ?? null,
          },
        },
      }),
    );
  }

  const consentPlan = planConsentFromRow({ normalizedRow, profile, sourceSystem });
  warnings.push(...consentPlan.warnings);
  for (const consent of consentPlan.planned) {
    if (!partyId) continue;
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT,
        payload: { partyId, consent },
      }),
    );
  }

  if (normalizedRow.notes && partyId) {
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.RECORD_NOTE,
        payload: {
          partyId,
          interactionId: `int_import_${sourceSystem}_${normalizedRow.externalContactId ?? normalizedRow.rowNumber}`,
          notes: normalizedRow.notes,
        },
      }),
    );
  }

  return finalizePlan({ plannedActions, warnings, errors, identity });
}

function buildPartyMetadata(normalizedRow) {
  const metadata = {};
  if (normalizedRow.leadSource) metadata.leadSource = normalizedRow.leadSource;
  if (normalizedRow.clientType) metadata.clientType = normalizedRow.clientType;
  if (normalizedRow.assignedAgentName) metadata.assignedAgentName = normalizedRow.assignedAgentName;
  if (normalizedRow.tags?.length) metadata.tags = normalizedRow.tags;
  if (normalizedRow.createdDate) metadata.sourceCreatedAt = normalizedRow.createdDate;
  if (normalizedRow.updatedDate) metadata.sourceUpdatedAt = normalizedRow.updatedDate;
  return metadata;
}

function buildPartyPatch(existingParty, normalizedRow, identity) {
  const patch = {};
  if (shouldFillIfEmpty(existingParty.displayName, normalizedRow.displayName)) {
    patch.displayName = normalizedRow.displayName;
  }

  const methods = new Set((existingParty.contactMethods ?? []).map(String));
  const additions = [];
  if (normalizedRow.email && !methods.has(normalizedRow.email)) additions.push(normalizedRow.email);
  if (normalizedRow.phone && !methods.has(normalizedRow.phone)) additions.push(normalizedRow.phone);
  if (additions.length) patch.contactMethodsAdd = additions;

  if (identity.externalReference && !(existingParty.externalReferences ?? []).includes(identity.externalReference)) {
    patch.externalReferencesAdd = [identity.externalReference];
  }

  const metadataPatch = buildPartyMetadata(normalizedRow);
  if (Object.keys(metadataPatch).length) patch.metadata = metadataPatch;

  return patch;
}

function finalizePlan({ plannedActions, warnings, errors, identity }) {
  let outcomeStatus = IMPORT_ROW_OUTCOME_STATUSES.SUCCESS;
  if (errors.length) outcomeStatus = IMPORT_ROW_OUTCOME_STATUSES.ERROR;
  else if (plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.REVIEW)) {
    outcomeStatus = IMPORT_ROW_OUTCOME_STATUSES.REVIEW;
  } else if (warnings.length) outcomeStatus = IMPORT_ROW_OUTCOME_STATUSES.WARNING;
  else if (plannedActions.every((a) => a.type === IMPORT_PLAN_ACTION_TYPES.SKIP)) {
    outcomeStatus = IMPORT_ROW_OUTCOME_STATUSES.SKIPPED;
  }

  return {
    plannedActions,
    warnings,
    errors,
    outcomeStatus,
    resolvedPartyId: identity.partyId,
    matchTier: identity.matchTier,
  };
}
