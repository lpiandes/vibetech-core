import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`RequestQueueView: ${message}`);
}

export function createRequestQueueView({
  id,
  name,
  summary,
  type,
  priority,
  itemCount,
  items,
  status,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!type || typeof type !== "string") fail("type required.");
  if (!priority || typeof priority !== "string") fail("priority required.");
  if (typeof itemCount !== "number") fail("itemCount required number.");
  if (!Array.isArray(items)) fail("items required array.");
  if (!status || typeof status !== "string") fail("status required.");
  if (!Array.isArray(actions)) fail("actions required array.");

  const view = {
    id,
    name,
    summary,
    type,
    priority,
    itemCount,
    items: deepFreeze(items.map(String)),
    status,
    actions: deepFreeze(actions),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(view);
}

