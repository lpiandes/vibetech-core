import { deepFreeze } from "../_utils/deepFreeze.js";

export const NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE = {
  "Mission Control": "/mission-control",
  Team: "/team",
  Work: "/work",
  Knowledge: "/knowledge",
  Company: "/company",
  Analytics: "/analytics",
  Settings: "/settings",
};

// The navigation "primary destination" for each group is represented by a single module.
// Selection is deterministic and derived from module registry metadata.kind.
export const NAVIGATION_GROUP_DEFINITIONS = [
  {
    title: "Mission Control",
    description: "Executive command center for the owner.",
    icon: "sparkles",
    priority: 1,
    preferredModuleKinds: ["mission_control"],
  },
  {
    title: "Team",
    description: "Everything related to people and coverage.",
    icon: "users",
    priority: 2,
    preferredModuleKinds: ["workforce"],
  },
  {
    title: "Work",
    description: "Work that needs triage, review, and execution.",
    icon: "inbox",
    priority: 3,
    preferredModuleKinds: ["queue"],
  },
  {
    title: "Knowledge",
    description: "Policies, SOPs, and knowledge readiness.",
    icon: "book",
    priority: 4,
    preferredModuleKinds: ["knowledge"],
  },
  {
    title: "Company",
    description: "The business profile, connected systems, and health signals.",
    icon: "dashboard",
    priority: 5,
    preferredModuleKinds: ["base"],
  },
  {
    title: "Analytics",
    description: "Historical reporting and capability readiness.",
    icon: "chart",
    priority: 6,
    preferredModuleKinds: ["analytics"],
  },
  {
    title: "Settings",
    description: "Platform configuration and operational preferences.",
    icon: "sun",
    priority: 7,
    preferredModuleKinds: ["settings"],
  },
];

export const WORKSPACE_NAVIGATION_VERSION = "1";

export const NAVIGATION_GROUP_TITLE_SET = new Set(NAVIGATION_GROUP_DEFINITIONS.map((g) => g.title));

export function freezeNavigationDefaults() {
  return deepFreeze({
    NAVIGATION_PRIMARY_ROUTES_BY_GROUP_TITLE,
    NAVIGATION_GROUP_DEFINITIONS,
    WORKSPACE_NAVIGATION_VERSION,
  });
}

