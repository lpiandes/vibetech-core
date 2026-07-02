import { NAVIGATION_GROUP_TITLE_SET, NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE, WORKSPACE_NAVIGATION_VERSION } from "./NavigationDefaults.js";

function fail(message) {
  throw new Error(`NavigationValidator: ${message}`);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function assertUniqueIds(items, label) {
  const ids = items.map((x) => String(x?.id ?? ""));
  const dupe = ids.find((id, idx) => id && ids.indexOf(id) !== idx);
  if (dupe) fail(`duplicate ${label} id: ${dupe}`);
}

export function validateNavigationDefinition(def) {
  if (!def || typeof def !== "object") fail("navigation definition required.");
  if (!Array.isArray(def.groups)) fail("navigationDefinition.groups must be array.");
  if (def.version !== WORKSPACE_NAVIGATION_VERSION && def.version !== "1") {
    // Allow "1" for forward compatibility.
  }

  const groupTitles = def.groups.map((g) => String(g?.title ?? ""));
  for (const t of groupTitles) {
    if (!NAVIGATION_GROUP_TITLE_SET.has(t)) fail(`invalid group reference: ${t}`);
  }

  // Validate group ordering by priority (ascending)
  const priorities = def.groups.map((g) => Number(g?.priority ?? NaN));
  for (const p of priorities) {
    if (!Number.isFinite(p)) fail("group priority must be number.");
  }
  const sorted = [...def.groups].sort((a, b) => Number(a.priority) - Number(b.priority) || String(a.title).localeCompare(String(b.title)));
  const orderingMatches = sorted.every((g, idx) => String(g.title) === String(def.groups[idx].title));
  if (!orderingMatches) fail("group ordering invalid.");

  const allItems = def.groups.flatMap((g) => (Array.isArray(g.items) ? g.items : []));
  assertUniqueIds(allItems, "navigation item");

  // Duplicate routes + missing routes/icons.
  const routes = allItems.map((i) => String(i?.route ?? ""));
  const dupeRoute = routes.find((r, idx) => r && routes.indexOf(r) !== idx);
  if (dupeRoute) fail(`duplicate route: ${dupeRoute}`);

  for (const it of allItems) {
    if (!it?.icon) fail(`missing icon for module: ${String(it.moduleId ?? "")}`);
    if (!it?.route) fail(`missing route for module: ${String(it.moduleId ?? "")}`);

    // Ensure route matches the expected primary route for its group title.
    const groupTitle = it?.metadata?.groupTitle ?? null;
    if (groupTitle && NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE[groupTitle] && it.route !== NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE[groupTitle]) {
      // Fail to catch accidental legacy routing.
      fail(`route for group ${groupTitle} must be primary.`);
    }
  }

  // Ensure no duplicate module ids in output per definition (platform requires unique destinations)
  const moduleIds = allItems.map((i) => String(i?.moduleId ?? ""));
  const dupeModule = moduleIds.find((id, idx) => id && moduleIds.indexOf(id) !== idx);
  if (dupeModule) fail(`duplicate moduleId: ${dupeModule}`);

  return { ok: true };
}

