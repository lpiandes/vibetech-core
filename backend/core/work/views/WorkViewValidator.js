import { ATTENTION_CATEGORIES, ACTION_PRIORITIES, ACTION_TYPES } from "./WorkViewDefaults.js";

function fail(message) {
  throw new Error(`WorkViewValidator: ${message}`);
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

export function validateWorkViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("work view model required.");
  const requiredTop = ["viewId", "companyId", "generatedAt", "summary", "queues", "stages", "items", "assignments", "attention", "recommendedActions", "metrics", "metadata"];
  for (const k of requiredTop) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(vm.queues)) fail("queues must be array.");
  if (!Array.isArray(vm.stages)) fail("stages must be array.");
  if (!Array.isArray(vm.items)) fail("items must be array.");
  if (!Array.isArray(vm.assignments)) fail("assignments must be array.");
  if (!vm.attention || typeof vm.attention !== "object") fail("attention must be object.");
  if (!Array.isArray(vm.attention.items)) fail("attention.items must be array.");
  if (!Array.isArray(vm.recommendedActions)) fail("recommendedActions must be array.");
  if (!vm.metrics || typeof vm.metrics !== "object") fail("metrics must be object.");

  uniqueIds(vm.queues, "queue");
  uniqueIds(vm.stages, "stage");
  uniqueIds(vm.items, "item");
  uniqueIds(vm.assignments, "assignment");

  for (const it of vm.attention.items) {
    if (!it || typeof it !== "object") fail("attention item must be object.");
    if (!it.id || typeof it.id !== "string") fail("attention item.id required.");
    if (!ATTENTION_CATEGORIES.includes(String(it.category))) fail(`invalid attention category: ${String(it.category)}`);
    if (!it.priority || typeof it.priority !== "string") fail("attention item.priority required.");
    if (!ACTION_PRIORITIES.includes(String(it.priority))) fail(`invalid attention priority: ${String(it.priority)}`);
  }

  // Validate recommended actions
  for (const a of vm.recommendedActions) {
    if (!a || typeof a !== "object") fail("recommendation/action must be object.");
    if (!a.id || typeof a.id !== "string") fail("action.id required.");
    if (!a.label || typeof a.label !== "string") fail("action.label required.");
    if (!a.type || typeof a.type !== "string") fail("action.type required.");
    if (!Object.values(ACTION_TYPES).includes(String(a.type))) fail(`invalid action.type: ${String(a.type)}`);
    if (!a.target || typeof a.target !== "string") fail("action.target required.");
    if (!ACTION_PRIORITIES.includes(String(a.priority))) fail(`invalid action.priority: ${String(a.priority)}`);
  }

  // Ensure immutability contract
  if (!Object.isFrozen(vm)) fail("work view model must be frozen.");

  return { ok: true };
}

