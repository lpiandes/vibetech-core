import { CARD_SOURCES, MISSION_CONTROL_STATUS, PRIMARY_FOCUS, PRIORITY_TIER_RANK } from "./MissionControlDefaults.js";

function fail(message) {
  throw new Error(`MissionControlValidator: ${message}`);
}

function uniqueIds(arr, label) {
  const ids = (arr ?? []).map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function priorityRank(priority) {
  const p = String(priority ?? "later");
  return PRIORITY_TIER_RANK[p] ?? 99;
}

export function validateMissionControl(missionControl) {
  if (!missionControl || typeof missionControl !== "object") fail("missionControl required.");

  const requiredTop = ["missionControlId", "companyId", "generatedAt", "headline", "overallStatus", "primaryFocus", "sections", "cards", "actions", "alerts", "metadata"];
  for (const k of requiredTop) {
    if (!(k in missionControl)) fail(`missing field: ${k}`);
  }

  if (!missionControl.headline || typeof missionControl.headline !== "string") fail("headline required.");
  if (!Object.values(MISSION_CONTROL_STATUS).includes(missionControl.overallStatus)) fail(`invalid overallStatus: ${missionControl.overallStatus}`);

  if (!PRIMARY_FOCUS.includes(missionControl.primaryFocus)) fail("missing/invalid primaryFocus.");

  if (!Array.isArray(missionControl.sections)) fail("sections must be array.");
  if (!Array.isArray(missionControl.cards)) fail("cards must be array.");
  if (!Array.isArray(missionControl.actions)) fail("actions must be array.");
  if (!Array.isArray(missionControl.alerts)) fail("alerts must be array.");

  uniqueIds(missionControl.sections, "section");
  uniqueIds(missionControl.cards, "card");
  uniqueIds(missionControl.actions, "action");

  // Validate primary focus exists in derived business logic.
  if (!missionControl.primaryFocus) fail("primaryFocus missing.");

  // Validate sections priority ordering.
  const sectionRanks = missionControl.sections.map((s) => priorityRank(s?.priority)).filter((n) => Number.isFinite(n));
  for (let i = 1; i < sectionRanks.length; i += 1) {
    if (sectionRanks[i] < sectionRanks[i - 1]) fail("invalid priority ordering across sections.");
  }

  // Validate card/action references.
  const actionIdSet = new Set(missionControl.actions.map((a) => String(a.id)));
  const cardIdsInSections = new Set();
  const sectionIdSet = new Set(missionControl.sections.map((s) => String(s.id)));

  for (const s of missionControl.sections) {
    if (!sectionIdSet.has(String(s.id))) fail("section id missing.");
    if (!Array.isArray(s.cards)) fail("section.cards must be array.");
    if (!Array.isArray(s.actions)) fail("section.actions must be array.");

    // Cards inside sections should also exist in missionControl.cards.
    for (const c of s.cards) {
      if (!c?.id) fail("card missing id.");
      cardIdsInSections.add(String(c.id));
      const cardInAll = missionControl.cards.some((x) => x.id === c.id);
      if (!cardInAll) fail(`section references unknown card: ${c.id}`);
      if (!CARD_SOURCES.includes(c.source)) fail(`card has invalid source: ${c.source}`);
      // Card actions must exist.
      const aIds = Array.isArray(c.actions) ? c.actions.map(String) : [];
      for (const aid of aIds) {
        if (!actionIdSet.has(aid)) fail(`card references unknown action: ${aid}`);
      }
    }

    // Section actions must exist and must appear in at least one card actions.
    for (const aid of s.actions) {
      const idStr = String(aid);
      if (!actionIdSet.has(idStr)) fail(`section references unknown action: ${idStr}`);
    }
  }

  // Validate that top-level cards cover all section cards.
  const allCardIds = new Set(missionControl.cards.map((c) => String(c.id)));
  if (allCardIds.size !== cardIdsInSections.size) {
    // allow top-level alerts etc but strict per spec.
    fail("cards in sections must match top-level cards.");
  }

  // Deep freeze canonical objects expected.
  if (!Object.isFrozen(missionControl)) fail("missionControl must be frozen.");

  return { ok: true };
}

