import { deepFreeze } from "./_utils/deepFreeze.js";

function sectionOrder(section) {
  const map = {
    "Mission Control": 1,
    Team: 2,
    Work: 3,
    Knowledge: 4,
    Company: 5,
    Analytics: 6,
    Settings: 7,
  };
  return map[section] ?? 99;
}

export function buildWorkspaceNavigation({ modules } = {}) {
  const mods = Array.isArray(modules) ? modules : [];
  const bySection = new Map();
  for (const m of mods) {
    const sec = m.navigation?.section ?? "Workspace";
    const item = m.navigation?.item ?? m.title;
    const prev = bySection.get(sec) ?? [];
    prev.push({
      moduleId: m.id,
      title: String(item),
      section: String(sec),
    });
    bySection.set(sec, prev);
  }

  const items = [];
  const sections = [...bySection.keys()].sort((a, b) => sectionOrder(a) - sectionOrder(b) || a.localeCompare(b));
  for (const sec of sections) {
    const secItems = bySection.get(sec) ?? [];
    secItems.sort((a, b) => a.title.localeCompare(b.title));
    items.push({ section: sec, items: secItems });
  }

  return deepFreeze({ items });
}

