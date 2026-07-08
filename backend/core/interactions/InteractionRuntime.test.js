import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { InteractionRuntime } from "./InteractionRuntime.js";
import { INTERACTION_EVENT_TYPES } from "./InteractionEventTypes.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:15:00.000Z";
const NOW2 = "2026-07-01T00:30:00.000Z";

test("InteractionRuntime: interaction recorded + note preserved + outcome + follow-up scheduled", () => {
  const rt = new InteractionRuntime();

  const interactionId = "int_1";
  rt.applyEvent({
    id: "evt_interaction_recorded_1",
    timestampISO: NOW0,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RECORDED,
    source: "test",
    payload: {
      interaction: {
        id: interactionId,
        interactionType: "call",
        direction: "outbound",
        channel: "phone",
        occurredAt: NOW0,
        participants: [{ partyId: "party_1", participantType: "PERSON" }],
        relatedObjects: [{ workItemId: "work_1" }],
        ownerId: "tm_1",
        status: "active",
        summary: "Deterministic summary",
        createdAt: NOW0,
        updatedAt: NOW0,
      },
    },
  });

  const interaction = rt.getInteraction(interactionId);
  assert.ok(interaction);
  assert.ok(Object.isFrozen(interaction));
  assert.equal(rt.getInteractions().length, 1);

  const noteText = "Spoke with the customer. They need more time. Follow up Friday afternoon.";
  rt.applyEvent({
    id: "evt_interaction_note_added_1",
    timestampISO: NOW1,
    type: INTERACTION_EVENT_TYPES.INTERACTION_NOTE_ADDED,
    source: "test",
    payload: {
      note: {
        id: "note_1",
        interactionId,
        authorId: "tm_1",
        timestampISO: NOW1,
        text: noteText,
        relatedObjects: [{ communicationMessageId: "cm_1" }],
        metadata: { original: true },
      },
    },
  });

  const afterNote = rt.getInteraction(interactionId);
  assert.ok(afterNote.notes?.length === 1);
  assert.equal(afterNote.notes[0].text, noteText);

  rt.applyEvent({
    id: "evt_interaction_outcome_1",
    timestampISO: NOW2,
    type: INTERACTION_EVENT_TYPES.INTERACTION_OUTCOME_RECORDED,
    source: "test",
    payload: {
      interactionId,
      outcome: "follow_up_required",
      nextStep: "call_back",
      followUpAt: "2026-07-03T15:00:00.000Z",
    },
  });

  const afterOutcome = rt.getInteraction(interactionId);
  assert.equal(afterOutcome.outcome, "follow_up_required");
  assert.equal(afterOutcome.nextStep, "call_back");

  rt.applyEvent({
    id: "evt_interaction_followup_1",
    timestampISO: NOW2,
    type: INTERACTION_EVENT_TYPES.INTERACTION_FOLLOW_UP_SCHEDULED,
    source: "test",
    payload: {
      interactionId,
      followUpAt: "2026-07-03T15:00:00.000Z",
    },
  });

  const afterFollowUp = rt.getInteraction(interactionId);
  assert.equal(afterFollowUp.followUpAt, "2026-07-03T15:00:00.000Z");
  assert.ok(Object.isFrozen(rt._state));
});

test("InteractionRuntime does not import platform event system", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const contents = readFileSync(join(here, "InteractionRuntime.js"), "utf8");
  assert.equal(contents.includes("PlatformEvent"), false);
  assert.equal(contents.includes("events/publishing"), false);
});
