import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`RequestViewModel: ${message}`);
}

export function createRequestViewModel({
  viewId,
  companyId,
  generatedAt,
  summary,
  queues,
  items,
  attention,
  recommendedActions,
  metrics,
  metadata,
} = {}) {
  if (!viewId || typeof viewId !== "string") fail("viewId required.");
  if (!companyId || typeof companyId !== "string") fail("companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required.");
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!Array.isArray(queues)) fail("queues required array.");
  if (!Array.isArray(items)) fail("items required array.");
  if (!attention || typeof attention !== "object") fail("attention required.");
  if (!Array.isArray(recommendedActions)) fail("recommendedActions required array.");
  if (!metrics || typeof metrics !== "object") fail("metrics required.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    summary,
    queues: deepFreeze(queues),
    items: deepFreeze(items),
    attention: deepFreeze(attention),
    recommendedActions: deepFreeze(recommendedActions),
    metrics: deepFreeze(metrics),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(vm);
}

