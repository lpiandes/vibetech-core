import { BUSINESS_PARTY_TYPES, createBusinessParty } from "./BusinessParty.js";
import { createBusinessRelationship } from "./BusinessRelationship.js";

function fail(message) {
  throw new Error(`BusinessGraphValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateBusinessGraphRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") fail("runtime required.");
  const s = runtime._state;
  if (!isPlainObject(s)) fail("runtime._state must be plain object.");
  if (!Array.isArray(s.parties)) fail("state.parties must be array.");
  if (!Array.isArray(s.relationships)) fail("state.relationships must be array.");
  if (s.parties.some((p) => !p || typeof p !== "object" || !Object.isFrozen(p))) {
    fail("state.parties must contain immutable objects.");
  }
  if (s.relationships.some((r) => !r || typeof r !== "object" || !Object.isFrozen(r))) {
    fail("state.relationships must contain immutable objects.");
  }
  return { ok: true };
}

export function validateBusinessParty(partyInput) {
  // Validate via the builder (which deepFreezes on success).
  if (!isPlainObject(partyInput)) fail("party required plain object.");
  const built = createBusinessParty(partyInput);
  if (!Object.isFrozen(built)) fail("party must be frozen.");
  return { ok: true };
}

export function validateBusinessRelationship(relationshipInput) {
  if (!isPlainObject(relationshipInput)) fail("relationship required plain object.");
  const built = createBusinessRelationship(relationshipInput);
  if (!Object.isFrozen(built)) fail("relationship must be frozen.");
  return { ok: true };
}
