import { createHash } from "node:crypto";

import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { createInteraction } from "../interactions/Interaction.js";
import { createInteractionNote } from "../interactions/InteractionNote.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

import { workMatchesRelationshipFollowUp } from "./RelationshipFollowUpEvidence.js";
import { validateRelationshipFollowUpOutcomeSelection } from "./RelationshipFollowUpOutcomeContract.js";
import { applyRelationshipFollowUpQualificationPatch } from "./RelationshipFollowUpQualificationPatch.js";

function fail(message) {
  throw new Error(`RelationshipFollowUpResolutionService: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function terminalStatus(status) {
  return ["completed", "cancelled", "failed", "rejected"].includes(String(status));
}

function hashComponent(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function deterministicInteractionId(workId) {
  return `int_relationship_followup_${hashComponent(workId)}`;
}

function relationshipFollowUpMetadata(work) {
  return isPlainObject(work?.metadata?.relationshipFollowUp) ? work.metadata.relationshipFollowUp : null;
}

function refsForWork(work, meta) {
  const refs = [...safeArray(work?.relatedObjects)];
  if (!refs.some((ref) => String(ref?.entityType) === ENTITY_TYPES.PARTY) && work?.requestedBy) {
    refs.unshift(createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: String(work.requestedBy) }));
  }
  return refs.map((ref) => ({ ...ref, relationshipFollowUp: undefined })).concat([
    {
      relationshipFollowUp: {
        candidateId: String(meta.candidateId),
        relationshipType: String(meta.relationshipType),
        ruleId: String(meta.ruleId),
        reasonCode: String(meta.reasonCode ?? ""),
      },
    },
  ]);
}

function primaryPartyId(work) {
  for (const ref of safeArray(work?.relatedObjects)) {
    if (String(ref?.entityType) === ENTITY_TYPES.PARTY && ref?.entityId) return String(ref.entityId);
    if (ref?.partyId) return String(ref.partyId);
  }
  return work?.requestedBy ? String(work.requestedBy) : "";
}

function interactionMatchesResolution(interaction, { workId, outcomeId } = {}) {
  if (!interaction) return false;
  if (String(interaction.outcome ?? "") !== String(outcomeId)) return false;
  return safeArray(interaction.relatedObjects).some(
    (ref) =>
      (String(ref?.entityType) === ENTITY_TYPES.WORK && String(ref?.entityId) === String(workId)) ||
      String(ref?.workItemId ?? "") === String(workId),
  );
}

function conflictingInteraction(interaction, { outcomeId } = {}) {
  if (!interaction?.outcome) return false;
  return String(interaction.outcome) !== String(outcomeId);
}

function buildInteraction({ work, meta, outcome, outcomeId, note, nextFollowUpAt, actorId, nowISO, qualificationPatchResult } = {}) {
  const interactionId = deterministicInteractionId(work.id);
  const partyId = primaryPartyId(work);
  const relatedObjects = refsForWork(work, meta).concat([createEntityRef({ entityType: ENTITY_TYPES.WORK, entityId: String(work.id) })]);
  return createInteraction({
    id: interactionId,
    interactionType: "relationship_follow_up",
    direction: "outbound",
    channel: "manual",
    occurredAt: String(nowISO),
    participants: [{ partyId, participantType: "primary" }],
    relatedObjects,
    ownerId: actorId ? String(actorId) : null,
    status: "active",
    summary: `Relationship follow-up outcome: ${String(outcomeId)}`,
    notes: [],
    outcome: String(outcomeId),
    nextStep: outcomeId === "follow_up_later" ? "follow_up_later" : null,
    followUpAt: nextFollowUpAt ? String(nextFollowUpAt) : null,
    source: "relationship_followup_resolution",
    externalReference: `relationship_followup_resolution:${String(work.id)}`,
    metadata: {
      relationshipFollowUp: {
        candidateId: String(meta.candidateId),
        relationshipType: String(meta.relationshipType),
        ruleId: String(meta.ruleId),
        reasonCode: String(meta.reasonCode ?? ""),
        workId: String(work.id),
        outcomeId: String(outcomeId),
        activitySemantics: outcome?.activitySemantics ?? {},
        candidateEffect: outcome?.candidateEffect ?? null,
      },
      qualificationPatch: qualificationPatchResult ?? null,
    },
    createdAt: String(nowISO),
    updatedAt: String(nowISO),
  });
}

export class RelationshipFollowUpResolutionService {
  execute({
    stack,
    installationResult,
    workId,
    outcomeId,
    note,
    nextFollowUpAt,
    qualificationUpdates,
    actorId,
    nowISO,
  } = {}) {
    if (!stack) fail("stack required.");
    if (!stack.workRuntime) fail("stack.workRuntime required.");
    if (!stack.interactionRuntime) fail("stack.interactionRuntime required.");
    if (!workId) fail("workId required.");
    if (!outcomeId) fail("outcomeId required.");

    const timestampISO = String(nowISO ?? stack.nowISO ?? "2026-07-01T00:00:00.000Z");
    const work = stack.workRuntime.getWorkItem(String(workId));
    if (!work) return { ok: false, reason: "work_not_found", status: "failed", errors: ["Work item was not found."] };

    const meta = relationshipFollowUpMetadata(work);
    if (!meta?.candidateId || !meta?.relationshipType || !meta?.ruleId) {
      return { ok: false, reason: "not_relationship_followup_work", status: "failed", errors: ["Work is not relationship follow-up work."] };
    }

    if (terminalStatus(work.status) && String(work.status) !== "completed") {
      return { ok: false, reason: "terminal_work", status: "failed", errors: ["Work is already terminal and cannot be resolved."] };
    }

    const outcomeValidation = validateRelationshipFollowUpOutcomeSelection({
      outcomes: installationResult?.relationshipFollowUpOutcomes ?? [],
      outcomeId,
      relationshipType: meta.relationshipType,
      note,
      nextFollowUpAt,
      qualificationUpdates,
    });
    if (!outcomeValidation.ok) {
      return { ok: false, reason: "invalid_outcome", status: "failed", errors: outcomeValidation.errors };
    }

    if (!workMatchesRelationshipFollowUp({
      work,
      candidateId: meta.candidateId,
      partyId: primaryPartyId(work),
      relationshipType: meta.relationshipType,
      ruleId: meta.ruleId,
      targetWorkType: work.workType,
    })) {
      return { ok: false, reason: "invalid_relationship_followup_work", status: "failed", errors: ["Work metadata does not match relationship follow-up evidence."] };
    }

    const interactionId = deterministicInteractionId(work.id);
    const existingInteraction = stack.interactionRuntime.getInteraction(interactionId);
    if (conflictingInteraction(existingInteraction, { outcomeId })) {
      return { ok: false, reason: "conflicting_resolution", status: "failed", errors: ["Work already has a different recorded outcome."] };
    }

    const snapshotKinds = new Set();
    let qualificationPatchResult = { applied: false, requestId: null, warnings: [], validated: {} };
    if (!existingInteraction && outcomeValidation.outcome?.allowsQualificationUpdates && qualificationUpdates && Object.keys(qualificationUpdates).length) {
      try {
        qualificationPatchResult = applyRelationshipFollowUpQualificationPatch({
          requestRuntime: stack.requestRuntime,
          relatedObjects: work.relatedObjects,
          qualificationUpdates,
          qualificationFieldSchemas: installationResult?.qualificationFieldSchemas ?? [],
          workId: work.id,
          outcomeId,
          actorId,
          nowISO: timestampISO,
        });
        if (qualificationPatchResult.applied) snapshotKinds.add(RUNTIME_SNAPSHOT_KINDS.REQUEST);
      } catch (err) {
        qualificationPatchResult = {
          applied: false,
          requestId: null,
          warnings: [`Qualification update was stored as interaction metadata only: ${String(err?.message ?? err)}`],
          validated: {},
        };
      }
    }

    if (!existingInteraction) {
      const interaction = buildInteraction({
        work,
        meta,
        outcome: outcomeValidation.outcome,
        outcomeId,
        note,
        nextFollowUpAt,
        actorId,
        nowISO: timestampISO,
        qualificationPatchResult,
      });
      stack.interactionRuntime.applyEvent({
        id: `evt_interaction_recorded_${interactionId}_${timestampISO}`,
        timestampISO,
        type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
        source: "relationship_followup_resolution",
        payload: { interaction },
      });

      const trimmedNote = String(note ?? "").trim();
      if (trimmedNote) {
        const noteId = `note_${interactionId}_${hashComponent(trimmedNote)}`;
        stack.interactionRuntime.applyEvent({
          id: `evt_interaction_note_added_${noteId}`,
          timestampISO,
          type: INTERACTION_EVENT_TYPES.INTERACTION_NOTE_ADDED,
          source: "relationship_followup_resolution",
          payload: {
            note: createInteractionNote({
              id: noteId,
              interactionId,
              authorId: actorId ? String(actorId) : "tm_unknown",
              timestampISO,
              text: trimmedNote,
              relatedObjects: interaction.relatedObjects,
              metadata: { relationshipFollowUp: { workId: String(work.id), outcomeId: String(outcomeId) } },
            }),
          },
        });
      }
      snapshotKinds.add(RUNTIME_SNAPSHOT_KINDS.INTERACTION);
    } else if (!interactionMatchesResolution(existingInteraction, { workId, outcomeId })) {
      return { ok: false, reason: "conflicting_resolution", status: "failed", errors: ["Existing interaction does not match this resolution."] };
    }

    const latestWork = stack.workRuntime.getWorkItem(String(workId));
    if (String(latestWork?.status) !== "completed") {
      stack.workRuntime.applyEvent({
        id: `evt_relationship_followup_work_completed_${String(workId)}`,
        timestampISO,
        type: WORK_EVENT_TYPES.WORK_ITEM_COMPLETED,
        source: "relationship_followup_resolution",
        payload: { workItemId: String(workId), completedAtISO: timestampISO },
      });
      snapshotKinds.add(RUNTIME_SNAPSHOT_KINDS.WORK);
    }

    return {
      ok: true,
      reason: null,
      status: "resolved",
      workId: String(workId),
      interactionId,
      outcomeId: String(outcomeId),
      idempotent: Boolean(existingInteraction && String(latestWork?.status) === "completed"),
      qualificationPatch: qualificationPatchResult,
      snapshotKinds: [...snapshotKinds],
      warnings: safeArray(qualificationPatchResult.warnings),
    };
  }
}

export function relationshipFollowUpResolutionInteractionId(workId) {
  return deterministicInteractionId(workId);
}
