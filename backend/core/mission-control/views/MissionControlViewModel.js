import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createMissionControlViewModel({
  viewId,
  companyId,
  generatedAt,
  headline,
  subheadline,
  overallStatus,
  primaryFocus,
  hero,
  sections,
  cards,
  actions,
  alerts,
  metadata,
} = {}) {
  if (!viewId || typeof viewId !== "string") throw new Error("MissionControlViewModel: viewId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("MissionControlViewModel: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("MissionControlViewModel: generatedAt required.");
  if (!headline || typeof headline !== "string") throw new Error("MissionControlViewModel: headline required.");
  if (!subheadline || typeof subheadline !== "string") throw new Error("MissionControlViewModel: subheadline required.");
  if (!overallStatus || typeof overallStatus !== "string") throw new Error("MissionControlViewModel: overallStatus required.");
  if (!primaryFocus || typeof primaryFocus !== "string") throw new Error("MissionControlViewModel: primaryFocus required.");
  if (!hero || typeof hero !== "object") throw new Error("MissionControlViewModel: hero required.");
  if (!Array.isArray(sections)) throw new Error("MissionControlViewModel: sections required.");
  if (!Array.isArray(cards)) throw new Error("MissionControlViewModel: cards required.");
  if (!Array.isArray(actions)) throw new Error("MissionControlViewModel: actions required.");
  if (!Array.isArray(alerts)) throw new Error("MissionControlViewModel: alerts required.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    headline,
    subheadline,
    overallStatus,
    primaryFocus,
    hero: deepFreeze(hero),
    sections: deepFreeze(sections),
    cards: deepFreeze(cards),
    actions: deepFreeze(actions),
    alerts: deepFreeze(alerts),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(vm);
}

