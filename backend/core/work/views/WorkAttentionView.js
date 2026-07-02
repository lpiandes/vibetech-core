import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkAttentionView: ${message}`);
}

export function createWorkAttentionView({ summary, items, metadata } = {}) {
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!Array.isArray(items)) fail("items required.");

  const view = {
    summary,
    items: deepFreeze(items.map((i) => deepFreeze({ ...i }))),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

