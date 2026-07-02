import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkViewModel: ${message}`);
}

export function createWorkViewModel({
  viewId,
  companyId,
  generatedAt,
  summary,
  queues,
  stages,
  items,
  assignments,
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
  if (!Array.isArray(stages)) fail("stages required array.");
  if (!Array.isArray(items)) fail("items required array.");
  if (!Array.isArray(assignments)) fail("assignments required array.");
  if (!attention || typeof attention !== "object") fail("attention required.");
  if (!Array.isArray(recommendedActions)) fail("recommendedActions required array.");
  if (!metrics || typeof metrics !== "object") fail("metrics required.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    summary,
    queues: deepFreeze(queues),
    stages: deepFreeze(stages),
    items: deepFreeze(items),
    assignments: deepFreeze(assignments),
    attention: deepFreeze(attention),
    recommendedActions: deepFreeze(recommendedActions),
    metrics: deepFreeze(metrics),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(vm);
}

