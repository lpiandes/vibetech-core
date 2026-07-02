import { ATTENTION_CATEGORIES, ACTION_PRIORITIES } from "./TeamViewDefaults.js";

function fail(message) {
  throw new Error(`TeamViewValidator: ${message}`);
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

export function validateTeamViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("view model required.");

  const requiredTop = ["viewId", "companyId", "generatedAt", "summary", "members", "departments", "workload", "attention", "recommendations", "metadata"];
  for (const k of requiredTop) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(vm.members)) fail("members must be array.");
  if (!Array.isArray(vm.departments)) fail("departments must be array.");
  if (!vm.workload || typeof vm.workload !== "object") fail("workload must be object.");
  if (!vm.attention || typeof vm.attention !== "object") fail("attention must be object.");
  if (!Array.isArray(vm.recommendations)) fail("recommendations must be array.");

  uniqueIds(vm.members, "member");
  uniqueIds(vm.departments, "department");

  // Workload totals sanity.
  const wl = vm.workload;
  if (typeof wl.totalMembers !== "number") fail("workload.totalMembers must be number.");
  if (wl.totalMembers !== vm.members.length) fail("workload.totalMembers must equal members.length.");

  // Attention items
  if (!Array.isArray(vm.attention.items)) fail("attention.items must be array.");
  for (const it of vm.attention.items) {
    if (!it || typeof it !== "object") fail("attention item must be object.");
    if (!it.id || typeof it.id !== "string") fail("attention item.id required.");
    if (!ATTENTION_CATEGORIES.includes(String(it.category))) fail(`invalid attention.category: ${String(it.category)}`);
    if (!it.priority || typeof it.priority !== "string") fail("attention item.priority required.");
  }

  // Validate action-like recommendation objects.
  for (const a of vm.recommendations) {
    if (!a || typeof a !== "object") fail("recommendation item must be object.");
    if (!a.id || typeof a.id !== "string") fail("recommendation.id required.");
    if (!a.label || typeof a.label !== "string") fail("recommendation.label required.");
    if (!a.type || typeof a.type !== "string") fail("recommendation.type required.");
    if (!a.target || typeof a.target !== "string") fail("recommendation.target required.");
    if (!ACTION_PRIORITIES.includes(String(a.priority))) fail(`invalid recommendation.priority: ${String(a.priority)}`);
  }

  if (!Object.isFrozen(vm)) fail("view model must be frozen.");

  return { ok: true };
}

