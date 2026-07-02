import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCommunicationParticipantView({ id, type, name, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    type: String(type ?? "unknown"),
    name: name === null || name === undefined ? null : String(name),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

