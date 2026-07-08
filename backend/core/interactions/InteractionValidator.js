import { createInteraction } from "./Interaction.js";
import { createInteractionNote } from "./InteractionNote.js";

function fail(message) {
  throw new Error(`InteractionValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateInteractionRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") fail("runtime required.");
  const s = runtime._state;
  if (!isPlainObject(s)) fail("runtime._state must be plain object.");
  if (!Array.isArray(s.interactions)) fail("state.interactions must be array.");
  if (!Object.isFrozen(runtime._state)) fail("runtime._state must be frozen.");
  return { ok: true };
}

export function validateInteraction(interactionInput) {
  if (!isPlainObject(interactionInput)) fail("interaction required plain object.");
  const built = createInteraction(interactionInput);
  if (!Object.isFrozen(built)) fail("interaction must be frozen.");
  return { ok: true };
}

export function validateInteractionNote(noteInput) {
  if (!isPlainObject(noteInput)) fail("note required plain object.");
  const built = createInteractionNote(noteInput);
  if (!Object.isFrozen(built)) fail("note must be frozen.");
  return { ok: true };
}
