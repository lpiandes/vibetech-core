import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Resolves context-aware labels from installed package terminology configuration.
 */
export function resolveTerminologyLabels({ terminology, context } = {}) {
  const t = terminology && typeof terminology === "object" ? terminology : {};
  const ctx = context && typeof context === "object" ? context : {};

  const relationshipType = safeString(ctx.relationshipType ?? "");
  const requestType = safeString(ctx.requestType ?? "");
  const workType = safeString(ctx.workType ?? "");

  const partyByRel = t.party?.byRelationship ?? {};
  const partyDefault = safeString(t.party?.default ?? "Party");
  const partyLabel = relationshipType && partyByRel[relationshipType] ? partyByRel[relationshipType] : partyDefault;

  const requestLabels = t.request ?? {};
  const requestLabel = requestType && requestLabels[requestType] ? requestLabels[requestType] : safeString(t.request?.default ?? "Request");

  const workLabels = t.work ?? {};
  const workLabel = workType && workLabels[workType] ? workLabels[workType] : safeString(t.work?.default ?? "Work");

  return deepFreeze({
    partyLabel,
    requestLabel,
    workLabel,
    requestsPageTitle: safeString(t.pages?.requestsTitle ?? "Requests"),
    workPageTitle: safeString(t.pages?.workTitle ?? "Work"),
    operatingSystemTitle: safeString(t.operatingSystemTitle ?? "Business Operating System"),
    entityLabels: t.entityLabels && typeof t.entityLabels === "object" ? deepFreeze({ ...t.entityLabels }) : deepFreeze({}),
  });
}

export function buildPackagePageLabels({ installationResult, industryPackage } = {}) {
  const terminology = installationResult?.terminology ?? industryPackage?.terminology ?? {};
  const pkgName = safeString(installationResult?.packageDisplayName ?? industryPackage?.displayName ?? industryPackage?.name ?? "");
  const osTitle = terminology.operatingSystemTitle ?? (pkgName ? `${pkgName}` : "Business Operating System");

  return deepFreeze({
    operatingSystemTitle: osTitle,
    commandCenter: terminology.pages?.commandCenterTitle ?? "Command Center",
    attention: terminology.pages?.attentionTitle ?? "Needs decision",
    work: terminology.pages?.workTitle ?? "Work",
    engagement: terminology.pages?.engagementTitle ?? "People & Relationships",
    communications: terminology.pages?.communicationsTitle ?? "Communications",
    digitalWorkforce: terminology.pages?.teamTitle ?? "Digital Workforce",
    knowledge: terminology.pages?.knowledgeTitle ?? "Knowledge",
    analytics: terminology.pages?.analyticsTitle ?? "Business Performance",
    connections: terminology.pages?.connectionsTitle ?? "Connections",
    setup: terminology.pages?.setupTitle ?? "Setup & Configuration",
    automations: terminology.pages?.automationsTitle ?? "Automations",
    requestsPageTitle: terminology.pages?.requestsTitle ?? "Opportunity & Service Requests",
    workPageTitle: terminology.pages?.workTitle ?? "Work",
    teamPageTitle: terminology.pages?.teamTitle ?? "Team & Digital Workforce",
    automationsPageTitle: terminology.pages?.automationsTitle ?? "Automations",
    connectionsPageTitle: terminology.pages?.connectionsTitle ?? "Connections",
    setupPageTitle: terminology.pages?.setupTitle ?? "Workspace Setup",
    knowledgePageTitle: terminology.pages?.knowledgeTitle ?? "Knowledge",
  });
}
