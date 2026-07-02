import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { LAYOUT_ALLOWED } from "./MissionControlViewDefaults.js";

function fail(message) {
  throw new Error(`MissionControlSectionView: ${message}`);
}

function deriveLayout({ sectionId, cardsCount } = {}) {
  if (cardsCount <= 1) return "single";
  // If it's a list-like section, compact layout is preferred.
  const s = String(sectionId ?? "");
  if (s.includes("recent") || s.includes("work_queue")) return "compact";
  return "stack";
}

export function createMissionControlSectionView({
  id,
  title,
  subtitle,
  status,
  priority,
  layout,
  cards,
  actions,
  emptyState,
  metadata,
} = {}) {
  if (!id) fail("id required.");
  if (!title) fail("title required.");
  if (!subtitle) fail("subtitle required.");

  const l = layout ? String(layout) : deriveLayout({ sectionId: id, cardsCount: Array.isArray(cards) ? cards.length : 0 });
  if (!LAYOUT_ALLOWED.includes(l)) fail(`invalid layout: ${l}`);

  const view = {
    id: String(id),
    title: String(title),
    subtitle: String(subtitle),
    status: String(status ?? "open"),
    priority: String(priority ?? "later"),
    layout: l,
    cards: Array.isArray(cards) ? deepFreeze(cards.map(String)) : deepFreeze([]),
    actions: Array.isArray(actions) ? deepFreeze(actions.map(String)) : deepFreeze([]),
    emptyState: emptyState ? String(emptyState) : "",
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

