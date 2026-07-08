import { IMPORT_PLAN_ACTION_TYPES, IMPORT_ROW_OUTCOME_STATUSES } from "../ImportRunStatus.js";
import { createImportPlanAction } from "../ImportPlanAction.js";
import { normalizeIdentityText } from "./SubjectImportNormalizer.js";

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

function subjectPatchFor({ normalizedRow, matchedSubject }) {
  const patch = {};
  if (normalizedRow.displayName && String(matchedSubject.displayName) !== String(normalizedRow.displayName)) {
    patch.displayName = String(normalizedRow.displayName);
  }
  const nextAttributes = { ...(matchedSubject.keyAttributes ?? {}), ...(normalizedRow.keyAttributes ?? {}) };
  if (JSON.stringify(nextAttributes) !== JSON.stringify(matchedSubject.keyAttributes ?? {})) {
    patch.keyAttributes = nextAttributes;
  }
  const refs = appendUnique(matchedSubject.externalReferences, normalizedRow.externalReferences);
  if (JSON.stringify(refs) !== JSON.stringify(safeArray(matchedSubject.externalReferences).map(String))) {
    patch.externalReferences = refs;
  }
  return patch;
}

function exactPropertyInterestMatchesSubject(value, normalizedRow) {
  const needle = normalizeIdentityText(value);
  if (!needle) return false;
  return [
    normalizedRow.displayName,
    normalizedRow.address,
    normalizedRow.normalizedAddress,
    normalizedRow.externalSubjectId,
  ]
    .map(normalizeIdentityText)
    .filter(Boolean)
    .includes(needle);
}

function linkActionsForExactMatches({ normalizedRow, subjectId, canonicalSnapshot }) {
  const actions = [];
  for (const [partyId, profileRequest] of Object.entries(canonicalSnapshot?.importProfileRequestsByPartyId ?? {})) {
    const propertyOfInterest = profileRequest?.qualification?.propertyOfInterest;
    if (!exactPropertyInterestMatchesSubject(propertyOfInterest, normalizedRow)) continue;
    actions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.LINK_PARTY_TO_SUBJECT,
        payload: {
          partyId,
          subjectId,
          relationshipType: "INTERESTED_IN",
          evidence: {
            requestId: profileRequest.requestId,
            propertyOfInterest: String(propertyOfInterest),
            matchTier: "exact_property_interest",
          },
        },
      }),
    );
  }
  return actions;
}

export function buildSubjectImportPlanForRow({
  normalizedRow,
  identity,
  canonicalSnapshot,
  workspaceId,
} = {}) {
  const warnings = [];
  const errors = [];
  const plannedActions = [];

  if (identity?.reviewReason) {
    warnings.push(identity.reviewReason);
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.REVIEW,
        payload: {
          reason: identity.reviewReason,
          propertyOfInterest: normalizedRow?.propertyOfInterest ?? null,
          displayName: normalizedRow?.displayName ?? null,
        },
      }),
    );
    return {
      resolvedSubjectId: null,
      matchTier: identity.matchTier,
      outcomeStatus: IMPORT_ROW_OUTCOME_STATUSES.REVIEW,
      warnings,
      errors,
      plannedActions,
    };
  }

  if (!normalizedRow?.displayName) {
    errors.push("subject_display_name_required");
    return {
      resolvedSubjectId: identity?.subjectId ?? null,
      matchTier: identity?.matchTier ?? "unknown",
      outcomeStatus: IMPORT_ROW_OUTCOME_STATUSES.ERROR,
      warnings,
      errors,
      plannedActions: [],
    };
  }

  if (identity.isNew) {
    plannedActions.push(
      createImportPlanAction({
        type: IMPORT_PLAN_ACTION_TYPES.CREATE_SUBJECT,
        payload: {
          subject: {
            id: identity.subjectId,
            workspaceId: String(workspaceId ?? ""),
            subjectType: normalizedRow.subjectType,
            displayName: normalizedRow.displayName,
            status: "active",
            keyAttributes: normalizedRow.keyAttributes,
            externalReferences: normalizedRow.externalReferences,
          },
        },
      }),
    );
  } else {
    const patch = subjectPatchFor({ normalizedRow, matchedSubject: identity.matchedSubject });
    if (Object.keys(patch).length) {
      plannedActions.push(
        createImportPlanAction({
          type: IMPORT_PLAN_ACTION_TYPES.UPDATE_SUBJECT,
          payload: {
            subjectId: identity.subjectId,
            patch,
          },
        }),
      );
    }
  }

  plannedActions.push(
    ...linkActionsForExactMatches({
      normalizedRow,
      subjectId: identity.subjectId,
      canonicalSnapshot,
    }),
  );

  if (!plannedActions.length) {
    plannedActions.push(createImportPlanAction({ type: IMPORT_PLAN_ACTION_TYPES.SKIP, payload: { reason: "no_changes" } }));
    return {
      resolvedSubjectId: identity.subjectId,
      matchTier: identity.matchTier,
      outcomeStatus: IMPORT_ROW_OUTCOME_STATUSES.SKIPPED,
      warnings,
      errors,
      plannedActions,
    };
  }

  return {
    resolvedSubjectId: identity.subjectId,
    matchTier: identity.matchTier,
    outcomeStatus: IMPORT_ROW_OUTCOME_STATUSES.SUCCESS,
    warnings,
    errors,
    plannedActions,
  };
}
