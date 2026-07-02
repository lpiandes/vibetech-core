import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`RequestAttentionView: ${message}`);
}

export function createRequestAttentionView({ summary, items, metadata } = {}) {
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!Array.isArray(items)) fail("items required array.");
  const view = {
    summary,
    items: deepFreeze(
      items.map((x) => ({
        id: String(x?.id ?? ""),
        category: String(x?.category ?? ""),
        priority: String(x?.priority ?? ""),
        summary: String(x?.summary ?? ""),
        metadata: x?.metadata && typeof x?.metadata === "object" ? deepFreeze(x.metadata) : deepFreeze({}),
      })),
    ),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(view);
}

