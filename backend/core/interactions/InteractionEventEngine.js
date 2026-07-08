import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { INTERACTION_EVENT_TYPES, SUPPORTED_INTERACTION_EVENT_TYPES } from "./InteractionEventTypes.js";

import { createInteraction } from "./Interaction.js";
import { createInteractionNote } from "./InteractionNote.js";

export class InteractionEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("InteractionEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("InteractionEventEngine: event must be object.");
    if (!event.id || typeof event.id !== "string") throw new Error("InteractionEventEngine: event.id required.");
    if (!event.timestampISO || typeof event.timestampISO !== "string") throw new Error("InteractionEventEngine: event.timestampISO required.");
    if (!event.type || typeof event.type !== "string") throw new Error("InteractionEventEngine: event.type required.");
    if (!event.source || typeof event.source !== "string") throw new Error("InteractionEventEngine: event.source required.");
    if (!event.payload || typeof event.payload !== "object") throw new Error("InteractionEventEngine: event.payload required.");

    if (!SUPPORTED_INTERACTION_EVENT_TYPES.includes(event.type)) {
      throw new Error(`InteractionEventEngine: Unsupported event type: ${event.type}`);
    }

    const prev = this.runtime._state;
    const interactions = [...(prev.interactions ?? [])];
    const payload = event.payload;

    switch (event.type) {
      case INTERACTION_EVENT_TYPES.INTERACTION_RECORDED: {
        const interaction = payload.interaction;
        const built = createInteraction(interaction);
        if (interactions.some((i) => String(i.id) === String(built.id))) {
          throw new Error(`INTERACTION_RECORDED: interaction already exists: ${String(built.id)}`);
        }
        interactions.push(built);
        break;
      }

      case INTERACTION_EVENT_TYPES.INTERACTION_NOTE_ADDED: {
        const note = payload.note;
        const built = createInteractionNote(note);
        const idx = interactions.findIndex((i) => String(i.id) === String(built.interactionId));
        if (idx === -1) throw new Error(`INTERACTION_NOTE_ADDED: interaction does not exist: ${String(built.interactionId)}`);

        const prevInteraction = interactions[idx];
        const nextNotes = [...(prevInteraction.notes ?? []), built];
        interactions[idx] = createInteraction({
          ...prevInteraction,
          notes: nextNotes,
          updatedAt: event.timestampISO,
        });
        break;
      }

      case INTERACTION_EVENT_TYPES.INTERACTION_OUTCOME_RECORDED: {
        const { interactionId, outcome, nextStep = null, followUpAt = null } = payload;
        if (!interactionId) throw new Error("INTERACTION_OUTCOME_RECORDED: interactionId required.");
        const idx = interactions.findIndex((i) => String(i.id) === String(interactionId));
        if (idx === -1) throw new Error(`INTERACTION_OUTCOME_RECORDED: interaction does not exist: ${String(interactionId)}`);
        const prevInteraction = interactions[idx];
        interactions[idx] = createInteraction({
          ...prevInteraction,
          outcome: outcome ?? prevInteraction.outcome,
          nextStep: nextStep === undefined ? prevInteraction.nextStep : nextStep,
          followUpAt: followUpAt === undefined ? prevInteraction.followUpAt : followUpAt,
          updatedAt: event.timestampISO,
        });
        break;
      }

      case INTERACTION_EVENT_TYPES.INTERACTION_FOLLOW_UP_SCHEDULED: {
        const { interactionId, followUpAt } = payload;
        if (!interactionId) throw new Error("INTERACTION_FOLLOW_UP_SCHEDULED: interactionId required.");
        const idx = interactions.findIndex((i) => String(i.id) === String(interactionId));
        if (idx === -1) throw new Error(`INTERACTION_FOLLOW_UP_SCHEDULED: interaction does not exist: ${String(interactionId)}`);
        const prevInteraction = interactions[idx];
        interactions[idx] = createInteraction({
          ...prevInteraction,
          followUpAt: followUpAt ?? prevInteraction.followUpAt,
          updatedAt: event.timestampISO,
        });
        break;
      }

      case INTERACTION_EVENT_TYPES.INTERACTION_RELATED_OBJECTS_UPDATED: {
        const { interactionId, relatedObjects } = payload;
        if (!interactionId) throw new Error("INTERACTION_RELATED_OBJECTS_UPDATED: interactionId required.");
        if (!Array.isArray(relatedObjects)) {
          throw new Error("INTERACTION_RELATED_OBJECTS_UPDATED: relatedObjects must be array.");
        }
        const idx = interactions.findIndex((i) => String(i.id) === String(interactionId));
        if (idx === -1) throw new Error(`INTERACTION_RELATED_OBJECTS_UPDATED: interaction does not exist: ${String(interactionId)}`);
        const prevInteraction = interactions[idx];
        interactions[idx] = createInteraction({
          ...prevInteraction,
          relatedObjects,
          updatedAt: event.timestampISO,
        });
        break;
      }

      default:
        throw new Error(`InteractionEventEngine: unhandled event type: ${event.type}`);
    }

    this.runtime._state = deepFreeze({
      ...prev,
      interactions: deepFreeze(interactions),
      metrics: deepFreeze({
        interactionCount: interactions.length,
      }),
    });
  }
}
