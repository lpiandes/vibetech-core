import { LAYOUT_ALLOWED, OVERALL_STATUS_ALLOWED, PRIMARY_FOCUS_ALLOWED } from "./MissionControlViewDefaults.js";

function fail(message) {
  throw new Error(`MissionControlViewValidator: ${message}`);
}

function uniqueIds(arr, label) {
  const ids = (arr ?? []).map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateMissionControlViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("view model required.");

  const requiredTop = ["viewId", "companyId", "generatedAt", "headline", "subheadline", "overallStatus", "primaryFocus", "hero", "sections", "cards", "actions", "alerts", "metadata"];
  for (const k of requiredTop) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  if (!vm.headline || typeof vm.headline !== "string") fail("headline required.");
  if (!vm.subheadline || typeof vm.subheadline !== "string") fail("subheadline required.");
  if (!OVERALL_STATUS_ALLOWED.includes(vm.overallStatus)) fail(`invalid overallStatus: ${vm.overallStatus}`);
  if (!PRIMARY_FOCUS_ALLOWED.includes(vm.primaryFocus)) fail(`invalid primaryFocus: ${vm.primaryFocus}`);

  if (!vm.hero || typeof vm.hero !== "object") fail("missing hero.");
  if (!vm.hero.title || typeof vm.hero.title !== "string") fail("hero.title required.");
  if (!vm.hero.subtitle || typeof vm.hero.subtitle !== "string") fail("hero.subtitle required.");
  if (!vm.hero.primaryAction || typeof vm.hero.primaryAction !== "string") fail("hero.primaryAction required.");

  if (!Array.isArray(vm.sections)) fail("sections must be array.");
  if (!Array.isArray(vm.cards)) fail("cards must be array.");
  if (!Array.isArray(vm.actions)) fail("actions must be array.");
  if (!Array.isArray(vm.alerts)) fail("alerts must be array.");

  uniqueIds(vm.sections, "section");
  uniqueIds(vm.cards, "card");
  uniqueIds(vm.actions, "action");

  // Layout validation + required section titles.
  for (const s of vm.sections) {
    if (!s || typeof s !== "object") fail("section must be object.");
    if (!s.title || typeof s.title !== "string") fail("missing section title.");
    if (!s.layout || !LAYOUT_ALLOWED.includes(s.layout)) fail(`invalid layout: ${s.layout}`);
    if (!Array.isArray(s.cards)) fail("section.cards must be array of card ids.");
    if (!Array.isArray(s.actions)) fail("section.actions must be array of action ids.");
    if (!Array.isArray(s.cards) || s.cards.length === 0) {
      // allow emptyState usage
    }
  }

  // Validate section.cards/actions ids exist.
  const cardIdSet = new Set(vm.cards.map((c) => String(c.id)));
  const actionIdSet = new Set(vm.actions.map((a) => String(a.id)));
  for (const s of vm.sections) {
    for (const cid of s.cards) if (!cardIdSet.has(String(cid))) fail(`section references missing card: ${cid}`);
    for (const aid of s.actions) if (!actionIdSet.has(String(aid))) fail(`section references missing action: ${aid}`);
  }

  if (!vm.primaryFocus) fail("missing primary focus.");

  if (!Object.isFrozen(vm)) fail("view model must be frozen.");
  return { ok: true };
}

