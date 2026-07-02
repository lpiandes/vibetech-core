import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { DEFAULT_SECTION_ORDER, MISSION_CONTROL_STATUS, PRIMARY_FOCUS } from "./MissionControlDefaults.js";

export function createMissionControl({
  missionControlId,
  companyId,
  generatedAt,
  headline,
  summary,
  overallStatus,
  primaryFocus,
  sections,
  cards,
  actions,
  alerts,
  metadata,
} = {}) {
  if (!missionControlId || typeof missionControlId !== "string") throw new Error("MissionControl: missionControlId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("MissionControl: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("MissionControl: generatedAt required.");
  if (!headline || typeof headline !== "string") throw new Error("MissionControl: headline required.");
  if (!summary || typeof summary !== "string") throw new Error("MissionControl: summary required.");
  if (!overallStatus || typeof overallStatus !== "string") throw new Error("MissionControl: overallStatus required.");
  if (!Object.values(MISSION_CONTROL_STATUS).includes(overallStatus)) throw new Error(`MissionControl: invalid overallStatus: ${overallStatus}`);
  if (!primaryFocus || typeof primaryFocus !== "string") throw new Error("MissionControl: primaryFocus required.");
  if (!PRIMARY_FOCUS.includes(primaryFocus)) throw new Error(`MissionControl: invalid primaryFocus: ${primaryFocus}`);

  if (!Array.isArray(sections)) throw new Error("MissionControl: sections required.");
  if (!Array.isArray(cards)) throw new Error("MissionControl: cards required.");
  if (!Array.isArray(actions)) throw new Error("MissionControl: actions required.");
  if (!Array.isArray(alerts)) throw new Error("MissionControl: alerts required.");

  // Validate basic structure deterministically.
  const sectionIds = sections.map((s) => s?.id).filter(Boolean).map(String);
  for (const required of DEFAULT_SECTION_ORDER) {
    // sections are deterministic; but allow missing if caller composes differently.
    // Validator will enforce duplicates & ordering.
    void required;
  }

  const mc = {
    missionControlId,
    companyId,
    generatedAt,
    headline,
    summary,
    overallStatus,
    primaryFocus,
    sections: deepFreeze(sections),
    cards: deepFreeze(cards),
    actions: deepFreeze(actions),
    alerts: deepFreeze(alerts ?? []),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(mc);
}

