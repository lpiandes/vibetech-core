import { CAPABILITY_VIEW_VERSION } from "./CapabilityViewDefaults.js";

function fail(message) {
  throw new Error(`CapabilityViewValidator: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function validateCapabilityViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("view model required object.");
  const required = ["viewId", "companyId", "generatedAt", "summary", "overallReadiness", "coverage", "categories", "providers", "gaps", "risks", "recommendations", "metrics", "metadata"];
  for (const k of required) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  requireString(vm.viewId, "viewId");
  requireString(vm.companyId, "companyId");
  requireString(vm.generatedAt, "generatedAt");
  requireString(vm.summary, "summary");

  if (typeof vm.overallReadiness !== "number") fail("overallReadiness must be number.");
  if (!isPlainObject(vm.coverage)) fail("coverage must be object.");
  if (!Array.isArray(vm.categories)) fail("categories must be array.");
  if (!Array.isArray(vm.providers)) fail("providers must be array.");

  for (const c of vm.categories) {
    if (!isPlainObject(c)) fail("category must be object.");
    if (!c.id || typeof c.id !== "string") fail("category.id required string.");
    if (!c.name || typeof c.name !== "string") fail("category.name required string.");
    if (!c.status || typeof c.status !== "string") fail("category.status required string.");
  }

  for (const p of safeArray(vm.providers)) {
    if (!isPlainObject(p)) fail("provider must be object.");
    if (!p.providerType) fail("provider.providerType required.");
    if (!p.status) fail("provider.status required.");
  }

  for (const g of safeArray(vm.gaps)) {
    if (!isPlainObject(g)) fail("gap must be object.");
    if (!g.id || typeof g.id !== "string") fail("gap.id required string.");
    if (!g.capabilityId) fail("gap.capabilityId required.");
  }

  for (const r of safeArray(vm.risks)) {
    if (!isPlainObject(r)) fail("risk must be object.");
    if (!r.id || typeof r.id !== "string") fail("risk.id required string.");
  }

  if (!Object.isFrozen(vm)) fail("view model must be frozen.");
  if (!Object.isFrozen(vm.metadata)) fail("view model.metadata must be frozen.");
  return { ok: true };
}

