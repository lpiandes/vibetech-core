import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`TeamAttentionView: ${message}`);
}

export function createTeamAttentionView({
  summary,
  items,
  metadata,
} = {}) {
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!Array.isArray(items)) fail("items required.");

  const view = {
    summary,
    items: deepFreeze(items),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

