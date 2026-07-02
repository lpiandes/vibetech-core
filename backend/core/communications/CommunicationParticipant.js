import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CommunicationParticipant: ${message}`);
}

export function createCommunicationParticipant({ id, type, metadata } = {}) {
  if (!id || typeof id !== "string") fail("id required string.");
  if (!type || typeof type !== "string") fail("type required string.");
  const participant = {
    id: String(id),
    type: String(type),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(participant);
}

