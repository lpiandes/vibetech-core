import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createMissionControlSection({
  id,
  title,
  summary,
  priority,
  status,
  cards,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("MissionControlSection: id required.");
  if (!title || typeof title !== "string") throw new Error("MissionControlSection: title required.");
  if (!summary || typeof summary !== "string") throw new Error("MissionControlSection: summary required.");

  const obj = {
    id,
    title,
    summary,
    priority: priority ? String(priority) : "later",
    status: status ? String(status) : "open",
    cards: Array.isArray(cards) ? deepFreeze(cards) : deepFreeze([]),
    actions: Array.isArray(actions) ? deepFreeze(actions.map(String)) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(obj);
}

