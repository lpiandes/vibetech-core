import { createInteraction } from "./Interaction.js";
import { createInteractionNote } from "./InteractionNote.js";

import { INTERACTION_EVENT_TYPES } from "./InteractionEventTypes.js";

/**
 * Records a canonical business interaction (meaning + note + outcome + follow-up)
 * and publishes supported PlatformEvents.
 *
 * - InteractionRuntime owns state (applyEvent only)
 * - Platform publisher owns publication
 * - This service owns the orchestration sequence
 */
export class RecordInteractionService {
  constructor({ interactionPlatformEventPublisher } = {}) {
    this.interactionPlatformEventPublisher = interactionPlatformEventPublisher;
  }

  execute({
    interactionRuntime,
    interactionInput,
    noteText,
    noteAuthorId,
    noteTimestampISO,
    outcome,
    nextStep,
    followUpAt,
    nowISO,
    metadata,
  } = {}) {
    if (!interactionRuntime) throw new Error("RecordInteractionService.execute requires interactionRuntime.");
    if (!interactionInput?.id) throw new Error("RecordInteractionService.execute requires interactionInput.id.");
    if (!this.interactionPlatformEventPublisher) throw new Error("RecordInteractionService requires interactionPlatformEventPublisher.");

    const interactionId = String(interactionInput.id);
    const occurredAtISO = String(interactionInput.occurredAt ?? nowISO ?? "2026-07-01T00:00:00.000Z");
    const createdAtISO = String(interactionInput.createdAt ?? nowISO ?? "2026-07-01T00:00:00.000Z");

    const interaction = createInteraction({
      ...interactionInput,
      id: interactionId,
      occurredAt: occurredAtISO,
      createdAt: createdAtISO,
      updatedAt: createdAtISO,
      status: interactionInput.status ?? "active",
      summary: interactionInput.summary ?? "",
      notes: interactionInput.notes ?? [],
    });

    // 1) Interaction recorded
    interactionRuntime.applyEvent({
      id: `evt_interaction_recorded_${interactionId}_${occurredAtISO}`,
      timestampISO: occurredAtISO,
      type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
      source: "record_interaction_service",
      payload: { interaction },
    });

    this.interactionPlatformEventPublisher.publishInteractionRecorded({
      interaction,
      recordedAtISO: occurredAtISO,
      metadata,
    });

    // 2) Note added (first-class canonical fact)
    if (noteText !== undefined && noteText !== null) {
      const noteId = `note_${interactionId}_${String(noteTimestampISO ?? occurredAtISO).replace(/[^a-zA-Z0-9]/g, "_")}`;
      const note = createInteractionNote({
        id: noteId,
        interactionId,
        authorId: noteAuthorId ?? interactionInput.ownerId ?? "tm_unknown",
        timestampISO: String(noteTimestampISO ?? occurredAtISO),
        text: String(noteText),
        relatedObjects: interactionInput.relatedObjects ?? [],
        metadata: {},
      });

      interactionRuntime.applyEvent({
        id: `evt_interaction_note_added_${noteId}`,
        timestampISO: String(note.timestampISO),
        type: INTERACTION_EVENT_TYPES.INTERACTION_NOTE_ADDED,
        source: "record_interaction_service",
        payload: { note },
      });
    }

    // 3) Outcome recorded
    if (outcome !== undefined && outcome !== null) {
      interactionRuntime.applyEvent({
        id: `evt_interaction_outcome_${interactionId}_${occurredAtISO}`,
        timestampISO: occurredAtISO,
        type: INTERACTION_EVENT_TYPES.INTERACTION_OUTCOME_RECORDED,
        source: "record_interaction_service",
        payload: {
          interactionId,
          outcome: String(outcome),
          nextStep: nextStep === undefined ? null : String(nextStep),
          followUpAt: followUpAt === undefined ? null : String(followUpAt),
        },
      });

      this.interactionPlatformEventPublisher.publishInteractionOutcomeRecorded({
        interactionId,
        outcome: String(outcome),
        nextStep: nextStep === undefined ? null : String(nextStep),
        followUpAt: followUpAt === undefined ? null : String(followUpAt),
        occurredAtISO: occurredAtISO,
        metadata,
      });
    }

    // 4) Follow-up scheduled
    if (followUpAt !== undefined && followUpAt !== null) {
      interactionRuntime.applyEvent({
        id: `evt_interaction_followup_${interactionId}_${String(followUpAt)}`,
        timestampISO: occurredAtISO,
        type: INTERACTION_EVENT_TYPES.INTERACTION_FOLLOW_UP_SCHEDULED,
        source: "record_interaction_service",
        payload: {
          interactionId,
          followUpAt: String(followUpAt),
        },
      });

      this.interactionPlatformEventPublisher.publishFollowUpScheduled({
        interactionId,
        followUpAtISO: String(followUpAt),
        occurredAtISO: occurredAtISO,
        metadata,
      });
    }

    return interactionRuntime.getInteraction(interactionId);
  }
}
