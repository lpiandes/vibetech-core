import { VIEW_ID_COMMUNICATIONS } from "./CommunicationViewDefaults.js";

function fail(message) {
  throw new Error(`CommunicationViewValidator: ${message}`);
}

function isFrozen(obj) {
  return Boolean(obj) && typeof obj === "object" && Object.isFrozen(obj);
}

export function validateCommunicationViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("view model required object.");

  const requiredTop = [
    "viewId",
    "companyId",
    "generatedAt",
    "summary",
    "threads",
    "messages",
    "participants",
    "queues",
    "attention",
    "recommendedActions",
    "metrics",
    "metadata",
  ];
  for (const k of requiredTop) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  if (String(vm.viewId) !== String(VIEW_ID_COMMUNICATIONS)) {
    // Allow any viewId? Keep strict for deterministic contract.
    fail(`invalid viewId: ${String(vm.viewId)}`);
  }
  if (!Array.isArray(vm.threads)) fail("threads must be array.");
  if (!Array.isArray(vm.messages)) fail("messages must be array.");
  if (!Array.isArray(vm.participants)) fail("participants must be array.");
  if (!Array.isArray(vm.queues)) fail("queues must be array.");
  if (!Array.isArray(vm.recommendedActions)) fail("recommendedActions must be array.");

  if (!vm.attention || typeof vm.attention !== "object") fail("attention must be object.");
  if (!Array.isArray(vm.attention.items)) fail("attention.items must be array.");

  if (!isFrozen(vm)) fail("view model must be frozen.");
  if (!isFrozen(vm.metadata)) fail("metadata must be frozen.");

  // Basic element checks.
  for (const t of vm.threads) {
    if (!t || typeof t !== "object") fail("thread view item must be object.");
    if (!t.id || typeof t.id !== "string") fail("thread.id required string.");
    if (typeof t.attentionRequired !== "boolean") fail("thread.attentionRequired must be boolean.");
    if (!Array.isArray(t.actions)) fail("thread.actions must be array.");
    if (!Array.isArray(t.badges)) fail("thread.badges must be array.");
  }

  for (const m of vm.messages) {
    if (!m || typeof m !== "object") fail("message view item must be object.");
    if (!m.id || typeof m.id !== "string") fail("message.id required string.");
    if (!m.threadId || typeof m.threadId !== "string") fail("message.threadId required string.");
    if (typeof m.attentionRequired !== "boolean") fail("message.attentionRequired must be boolean.");
    if (!Array.isArray(m.recipients)) fail("message.recipients must be array.");
    if (!Array.isArray(m.actions)) fail("message.actions must be array.");
  }

  // Metrics sanity.
  if (!vm.metrics || typeof vm.metrics !== "object") fail("metrics required object.");
  for (const k of ["totalThreads", "totalMessages", "attentionThreadCount", "attentionMessageCount"]) {
    if (!(k in vm.metrics)) fail(`metrics missing field: ${k}`);
    if (typeof vm.metrics[k] !== "number") fail(`metrics.${k} must be number.`);
  }

  return { ok: true };
}

