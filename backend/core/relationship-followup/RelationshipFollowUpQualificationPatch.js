import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { validateQualificationImportFields } from "../import/validation/QualificationImportValidator.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function refsRequestId(relatedObjects) {
  for (const ref of safeArray(relatedObjects)) {
    if (String(ref?.entityType) === "Request" && ref?.entityId) return String(ref.entityId);
    if (ref?.requestId) return String(ref.requestId);
  }
  return null;
}

export function applyRelationshipFollowUpQualificationPatch({
  requestRuntime,
  relatedObjects,
  qualificationUpdates,
  qualificationFieldSchemas,
  workId,
  outcomeId,
  actorId,
  nowISO,
} = {}) {
  const updates = isPlainObject(qualificationUpdates) ? qualificationUpdates : {};
  if (Object.keys(updates).length === 0) {
    return deepFreeze({ applied: false, requestId: null, warnings: [], validated: {}, snapshotKind: null });
  }

  const requestId = refsRequestId(relatedObjects);
  const request = requestId ? requestRuntime?.getRequest?.(requestId) : null;
  if (!request) {
    return deepFreeze({
      applied: false,
      requestId,
      warnings: ["No related request was available for canonical qualification update."],
      validated: {},
      snapshotKind: null,
    });
  }

  const validation = validateQualificationImportFields(updates, qualificationFieldSchemas);
  const validated = validation.validated ?? {};
  const warnings = safeArray(validation.warnings).map((warning) => String(warning?.message ?? warning?.code ?? warning));

  if (Object.keys(validated).length === 0) {
    return deepFreeze({ applied: false, requestId: String(request.id), warnings, validated: {}, snapshotKind: null });
  }

  const previousMetadata = isPlainObject(request.metadata) ? request.metadata : {};
  const previousQualification = isPlainObject(previousMetadata.qualification) ? previousMetadata.qualification : {};
  const provenance = safeArray(previousMetadata.qualificationProvenance);
  const alreadyApplied = provenance.some(
    (entry) =>
      String(entry?.source) === "relationship_followup_resolution" &&
      String(entry?.workId) === String(workId) &&
      String(entry?.outcomeId) === String(outcomeId),
  );
  if (alreadyApplied) {
    return deepFreeze({
      applied: false,
      requestId: String(request.id),
      warnings,
      validated: deepFreeze(validated),
      snapshotKind: null,
      idempotent: true,
    });
  }

  const nextQualification = { ...previousQualification, ...validated };
  const nextMetadata = {
    ...previousMetadata,
    qualification: nextQualification,
    qualificationProvenance: [
      ...provenance,
      {
        source: "relationship_followup_resolution",
        workId: String(workId),
        outcomeId: String(outcomeId),
        actorId: actorId ? String(actorId) : null,
        updatedAt: String(nowISO),
        fields: Object.keys(validated).sort(),
      },
    ],
  };

  requestRuntime.applyEvent({
    id: `evt_request_qualification_patch_${String(request.id)}_${String(workId)}`,
    timestampISO: String(nowISO),
    type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
    source: "relationship_followup_resolution",
    payload: {
      requestId: String(request.id),
      patch: { metadata: nextMetadata },
    },
  });

  return deepFreeze({
    applied: true,
    requestId: String(request.id),
    warnings,
    validated: deepFreeze(validated),
    snapshotKind: "request",
  });
}
