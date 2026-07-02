import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkStageView: ${message}`);
}

export function createWorkStageView({
  id,
  name,
  summary,
  status,
  sortOrder,
  itemCount,
  items,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!status || typeof status !== "string") fail("status required.");
  if (typeof sortOrder !== "number") fail("sortOrder required number.");
  if (typeof itemCount !== "number") fail("itemCount required number.");
  if (!Array.isArray(items)) fail("items must be array.");

  const view = {
    id,
    name,
    summary,
    status,
    sortOrder,
    itemCount,
    items: deepFreeze(items.map(String)),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

