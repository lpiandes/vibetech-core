/** Client-facing navigation — plain business language only. */
export function getSimplifiedNavSections(businessId: string, permissions?: Set<string> | string[]) {
  const permSet = permissions instanceof Set ? permissions : new Set(permissions ?? []);
  const base = `/b/${businessId}`;

  const can = (permission: string | null) => !permission || permSet.has(permission);

  const sections = [
    {
      id: "daily",
      title: "",
      items: [
        { id: "nav_home", moduleId: "home", label: "Home", iconName: "home", href: `${base}/home`, permission: null },
        { id: "nav_for_you", moduleId: "command_center", label: "For you", iconName: "home", href: `${base}/for-you`, permission: "work.view" },
        { id: "nav_work", moduleId: "work_queue", label: "Work", iconName: "inbox", href: `${base}/work`, permission: "work.view" },
        { id: "nav_people", moduleId: "engagement", label: "People", iconName: "users", href: `${base}/people`, permission: "people.view" },
        { id: "nav_properties", moduleId: "properties", label: "Properties", iconName: "home", href: `${base}/properties`, permission: "people.view" },
        { id: "nav_inbox", moduleId: "communications", label: "Inbox", iconName: "message-square", href: `${base}/inbox`, permission: "inbox.view" },
      ],
    },
    {
      id: "business",
      title: "",
      items: [
        { id: "nav_team", moduleId: "digital_workforce", label: "Team", iconName: "users", href: `${base}/team`, permission: "team.manage" },
        { id: "nav_knowledge", moduleId: "knowledge", label: "Knowledge", iconName: "book", href: `${base}/knowledge`, permission: null },
        { id: "nav_performance", moduleId: "analytics", label: "Performance", iconName: "chart", href: `${base}/performance`, permission: "performance.view" },
      ],
    },
    {
      id: "system",
      title: "",
      items: [
        { id: "nav_integrations", moduleId: "connections", label: "Integrations", iconName: "link", href: `${base}/integrations`, permission: "integrations.manage" },
        { id: "nav_settings", moduleId: "setup", label: "Settings", iconName: "settings", href: `${base}/settings`, permission: "settings.manage" },
      ],
    },
  ] as const;

  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => {
          if (item.id === "nav_team") return can("team.invite") || can("team.manage");
          return can(item.permission);
        })
        .map((item) => ({ ...item, badges: [] as { type: string; value: string }[] })),
    }))
    .filter((section) => section.items.length > 0);
}
