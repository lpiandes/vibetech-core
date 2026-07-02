import { ACTION_TYPES, ACTION_PRIORITIES, ATTENTION_CATEGORIES } from "./RequestViewDefaults.js";

function fail(message) {
  throw new Error(`RequestViewValidator: ${message}`);
}

function uniqueIds(arr, label) {
  const seen = new Set();
  for (const x of arr) {
    const id = String(x?.id ?? "");
    if (!id) fail(`${label} missing id`);
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateRequestViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("request view model required.");
  const requiredTop = [
    "viewId",
    "companyId",
    "generatedAt",
    "summary",
    "queues",
    "items",
    "attention",
    "recommendedActions",
    "metrics",
    "metadata",
  ];
  for (const k of requiredTop) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(vm.queues)) fail("queues must be array.");
  if (!Array.isArray(vm.items)) fail("items must be array.");
  if (!vm.attention || typeof vm.attention !== "object") fail("attention must be object.");
  if (!Array.isArray(vm.attention.items)) fail("attention.items must be array.");
  if (!Array.isArray(vm.recommendedActions)) fail("recommendedActions must be array.");
  if (!vm.metrics || typeof vm.metrics !== "object") fail("metrics must be object.");

  uniqueIds(vm.items, "request item");
  uniqueIds(vm.queues, "queue");

  // Attention categories.
  for (const it of vm.attention.items) {
    if (!it || typeof it !== "object") fail("attention item must be object.");
    if (!it.id || typeof it.id !== "string") fail("attention item.id required.");
    if (!ATTENTION_CATEGORIES.includes(String(it.category))) fail(`invalid attention category: ${String(it.category)}`);
    if (!ACTION_PRIORITIES.includes(String(it.priority))) fail(`invalid attention priority: ${String(it.priority)}`);
  }

  // Recommended actions.
  for (const a of vm.recommendedActions) {
    if (!a || typeof a !== "object") fail("action must be object.");
    if (!a.id || typeof a.id !== "string") fail("action.id required.");
    if (!a.label || typeof a.label !== "string") fail("action.label required.");
    if (!a.type || typeof a.type !== "string") fail("action.type required.");
    if (!Object.values(ACTION_TYPES).includes(String(a.type))) fail(`invalid action.type: ${String(a.type)}`);
    if (!a.target || typeof a.target !== "string") fail("action.target required.");
    if (!ACTION_PRIORITIES.includes(String(a.priority))) fail(`invalid action.priority: ${String(a.priority)}`);
  }

  if (!Object.isFrozen(vm)) fail("request view model must be frozen.");
  if (!Object.isFrozen(vm.queues)) fail("request view queues must be frozen array.");
  if (!Object.isFrozen(vm.items)) fail("request view items must be frozen array.");
  return { ok: true };
}

