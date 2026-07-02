import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CommunicationViewModel: ${message}`);
}

export function createCommunicationViewModel({
  viewId,
  companyId,
  generatedAt,
  summary,
  threads,
  messages,
  participants,
  queues,
  attention,
  recommendedActions,
  metrics,
  metadata,
} = {}) {
  if (!viewId || typeof viewId !== "string") fail("viewId required.");
  if (!companyId || typeof companyId !== "string") fail("companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required.");
  if (!summary || typeof summary !== "string") fail("summary required string.");

  if (!Array.isArray(threads)) fail("threads required array.");
  if (!Array.isArray(messages)) fail("messages required array.");
  if (!Array.isArray(participants)) fail("participants required array.");
  if (!Array.isArray(queues)) fail("queues required array.");

  if (!attention || typeof attention !== "object") fail("attention required object.");
  if (!Array.isArray(recommendedActions)) fail("recommendedActions required array.");
  if (!metrics || typeof metrics !== "object") fail("metrics required object.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    summary,
    threads: deepFreeze(threads),
    messages: deepFreeze(messages),
    participants: deepFreeze(participants),
    queues: deepFreeze(queues),
    attention: deepFreeze(attention),
    recommendedActions: deepFreeze(recommendedActions),
    metrics: deepFreeze(metrics),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(vm);
}

