import { deepFreeze } from "../_utils/deepFreeze.js";

import { createNavigationDefinition } from "./NavigationDefinition.js";
import { validateNavigationDefinition } from "./NavigationValidator.js";

import {
  NAVIGATION_GROUP_DEFINITIONS,
  NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE,
  WORKSPACE_NAVIGATION_VERSION,
} from "./NavigationDefaults.js";

import { createNavigationGroup } from "./NavigationGroup.js";

export class NavigationService {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  generate({
    modules,
  } = {}) {
    const enabledModules = Array.isArray(modules) ? modules : [];

    // Build definition by selecting exactly one module per primary destination group.
    const groups = NAVIGATION_GROUP_DEFINITIONS.map((groupDef) => {
      const candidates = enabledModules.filter((m) => String(m.navigation?.section ?? "") === String(groupDef.title));
      const preferred = groupDef.preferredModuleKinds ?? [];

      const scored = candidates
        .map((m) => {
          const kind = String(m.metadata?.kind ?? "");
          const idx = preferred.includes(kind) ? preferred.indexOf(kind) : 999;
          return { module: m, score: idx, kind };
        })
        .sort((a, b) => a.score - b.score || String(a.module.id).localeCompare(String(b.module.id)));

      const picked = scored.length ? scored[0].module : null;

      const pickedItems = picked
        ? [
            {
              id: `nav_item_${String(groupDef.title).replace(/\s+/g, "_").toLowerCase()}_${String(picked.id)}`,
              title: String(picked.navigation?.item ?? picked.title ?? picked.id),
              route: NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE[String(groupDef.title)],
              icon: groupDef.icon,
              enabled: true,
              badge: {},
              priority: groupDef.priority,
              metadata: deepFreeze({
                moduleId: String(picked.id),
                groupTitle: String(groupDef.title),
                version: WORKSPACE_NAVIGATION_VERSION,
              }),
              moduleId: String(picked.id),
            },
          ]
        : [];

      // Use createNavigationGroup for deep-freeze consistency.
      return createNavigationGroup({
        title: groupDef.title,
        description: groupDef.description,
        icon: groupDef.icon,
        priority: groupDef.priority,
        items: pickedItems,
        metadata: deepFreeze({ derivedAtISO: this.nowISO }),
      });
    });

    const definition = createNavigationDefinition({
      groups,
      metadata: deepFreeze({ generatedAt: this.nowISO }),
    });

    validateNavigationDefinition(definition);

    // Convert to WorkspaceConfiguration.navigation contract shape.
    const items = groups.map((g) => ({
      section: String(g.title),
      items: (Array.isArray(g.items) ? g.items : []).map((it) => ({
        moduleId: String(it.moduleId),
        title: String(it.title),
        section: String(g.title),
      })),
    }));

    return deepFreeze({ items });
  }
}

