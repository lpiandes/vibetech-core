export type SetupChecklistItem = {
  id: string;
  title: string;
  actionLabel?: string;
  href?: string;
  complete?: boolean;
  summary?: string | null;
  whereInApp?: string | null;
  inApp?: string[];
  external?: string[];
};

export function deriveSetupStatusSummary(checklist: unknown) {
  const items = Array.isArray(checklist) ? (checklist as SetupChecklistItem[]) : [];
  const complete = items.filter((item) => item.complete).length;
  return {
    total: items.length,
    complete,
    incomplete: Math.max(0, items.length - complete),
    allComplete: items.length > 0 && complete === items.length,
  };
}

export function incompleteSetupItems(checklist: unknown) {
  const items = Array.isArray(checklist) ? (checklist as SetupChecklistItem[]) : [];
  return items.filter((item) => !item.complete);
}

export function settingsHubLinks({
  businessId,
  canManageTeam,
  canManageIntegrations,
  canManageKnowledge,
}: {
  businessId: string;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  canManageKnowledge: boolean;
}) {
  const links = [];
  if (canManageTeam) {
    links.push({ id: "team", title: "Team", description: "Invite people and manage access", href: `/b/${businessId}/team` });
  }
  if (canManageIntegrations) {
    links.push({
      id: "integrations",
      title: "Integrations",
      description: "Connect email, software, and channels",
      href: `/b/${businessId}/integrations`,
    });
  }
  if (canManageKnowledge) {
    links.push({
      id: "knowledge",
      title: "Knowledge",
      description: "Business documents and instructions",
      href: `/b/${businessId}/knowledge`,
    });
  }
  return links;
}
