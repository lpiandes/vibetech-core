import { deepFreeze } from "../_utils/deepFreeze.js";

/**
 * Universal navigation model — package terminology drives labels; Core defines structure.
 */
export const UNIVERSAL_NAV_ITEMS = [
  { moduleId: "home", defaultLabel: "Home", href: "/mission-control", icon: "home", section: "primary" },
  { moduleId: "attention", defaultLabel: "Attention", href: "/attention", icon: "alert-circle", section: "primary" },
  { moduleId: "work_queue", defaultLabel: "Work", href: "/work", icon: "inbox", section: "primary" },
  { moduleId: "engagement", defaultLabel: "People", href: "/engagement", icon: "users", section: "primary" },
  { moduleId: "communications", defaultLabel: "Communications", href: "/communications", icon: "message-square", section: "primary" },
  { moduleId: "digital_workforce", defaultLabel: "Digital Workforce", href: "/team", icon: "bot", section: "business" },
  { moduleId: "knowledge", defaultLabel: "Knowledge", href: "/knowledge", icon: "book", section: "business" },
  { moduleId: "analytics", defaultLabel: "Performance", href: "/analytics", icon: "chart", section: "business" },
  { moduleId: "automations", defaultLabel: "Automations", href: "/automations", icon: "workflow", section: "manage", visibility: "admin" },
  { moduleId: "audiences", defaultLabel: "Audiences", href: "/audiences", icon: "target", section: "manage" },
  { moduleId: "connections", defaultLabel: "Connections", href: "/connections", icon: "link", section: "manage" },
  { moduleId: "setup", defaultLabel: "Setup", href: "/setup", icon: "settings", section: "manage" },
];

const LABEL_KEY_BY_MODULE = {
  home: "commandCenter",
  command_center: "commandCenter",
  attention: "attention",
  work_queue: "work",
  engagement: "engagement",
  audiences: "audiences",
  communications: "communications",
  digital_workforce: "digitalWorkforce",
  knowledge: "knowledge",
  analytics: "analytics",
  connections: "connections",
  setup: "setup",
  automations: "automations",
};

export function buildPackageNavigation({ pageLabels, packageNavigation, attentionCount = 0 } = {}) {
  const packageModules = new Set(safeArray(packageNavigation?.modules));
  const usePackageFilter = packageModules.size > 0;

  const items = UNIVERSAL_NAV_ITEMS.filter((item) => {
    if (!usePackageFilter) return true;
    const aliases = {
      home: ["mission_control", "command_center", "home"],
      command_center: ["mission_control", "command_center", "home"],
      work_queue: ["work", "work_queue", "requests"],
      digital_workforce: ["team", "digital_workforce"],
      engagement: ["engagement", "people"],
      audiences: ["audiences", "segments"],
      communications: ["communications"],
      analytics: ["analytics"],
      knowledge: ["knowledge"],
    };
    const keys = aliases[item.moduleId] ?? [item.moduleId];
    return keys.some((k) => packageModules.has(k)) || ["home", "command_center", "attention", "setup", "connections"].includes(item.moduleId);
  }).map((item, index) => {
    const labelKey = LABEL_KEY_BY_MODULE[item.moduleId];
    const label = (labelKey && pageLabels?.[labelKey]) || item.defaultLabel;
    const badges = [];
    if (item.moduleId === "attention" && attentionCount > 0) {
      badges.push({ type: "count", value: String(attentionCount) });
    }
    return deepFreeze({
      id: `nav_${item.moduleId}`,
      moduleId: item.moduleId,
      label,
      href: item.href,
      iconName: item.icon,
      visibility: item.visibility ?? "VISIBLE",
      status: "READY",
      displayOrder: index,
      badges,
      section: item.section,
    });
  });

  return deepFreeze({
    version: "2",
    items,
    sections: groupBySection(items),
  });
}

function groupBySection(items) {
  const order = ["primary", "business", "manage"];
  const grouped = new Map(order.map((s) => [s, []]));
  for (const item of items) {
    const sec = item.section ?? "operations";
    if (!grouped.has(sec)) grouped.set(sec, []);
    grouped.get(sec).push(item);
  }
  return deepFreeze(
    order
      .filter((s) => grouped.get(s)?.length)
      .map((s) => deepFreeze({ id: s, title: sectionTitle(s), items: grouped.get(s) })),
  );
}

function sectionTitle(section) {
  if (section === "primary") return "Operate";
  if (section === "business") return "Business";
  if (section === "manage") return "Manage";
  return section;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
