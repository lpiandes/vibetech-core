import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { composeBusinessCommandCenter } from "./BusinessCommandCenterComposer.js";
import { adaptBusinessCommandCenterView } from "./views/BusinessCommandCenterViewAdapter.js";
import { buildBusinessOperatingHomeView } from "./buildBusinessOperatingHomeView.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function resolveExecutivePresentation(presentation) {
  return presentation?.executiveHome ?? presentation?.operatingHome ?? {};
}

function mapBusinessHref(href, businessId) {
  if (!href) return null;
  const bid = String(businessId ?? "");
  if (!bid) return String(href);
  const path = String(href);
  if (path.startsWith(`/b/${bid}/`)) return path;
  if (path.startsWith("/engagement/")) return `/b/${bid}/people`;
  if (path === "/work" || path.startsWith("/work/")) return `/b/${bid}/work`;
  if (path === "/attention" || path === "/for-you" || path.startsWith("/for-you")) return `/b/${bid}/for-you`;
  if (path === "/team" || path.startsWith("/team")) return `/b/${bid}/team`;
  if (path === "/inbox" || path.startsWith("/inbox/")) {
    const suffix = path === "/inbox" ? "" : path.slice("/inbox".length);
    return `/b/${bid}/inbox${suffix}`;
  }
  if (path === "/properties" || path.startsWith("/properties/")) {
    const suffix = path === "/properties" ? "" : path.slice("/properties".length);
    return `/b/${bid}/properties${suffix}`;
  }
  return path;
}

function remapAttentionItem(item, businessId) {
  const actions = safeArray(item.availableActions).map((action) =>
    deepFreeze({
      ...action,
      href: action.href ? mapBusinessHref(action.href, businessId) : action.href,
    }),
  );
  const firstHref = actions[0]?.href ?? mapBusinessHref(`/b/${businessId}/for-you`, businessId);
  return deepFreeze({
    ...item,
    availableActions: deepFreeze(actions),
    href: firstHref,
  });
}

function remapEpisode(episode, businessId) {
  return deepFreeze({
    ...episode,
    href: episode.href ? mapBusinessHref(episode.href, businessId) : null,
  });
}

function remapWorkRow(row, businessId) {
  const href = row.rowHref ?? row.personHref ?? row.propertyHref ?? mapBusinessHref(row.href ?? "/work", businessId);
  return deepFreeze({
    ...row,
    href,
    personHref: row.personHref ?? null,
    propertyHref: row.propertyHref ?? null,
    rowHref: row.rowHref ?? href,
    engagementHref: null,
  });
}

function remapContinuationItem(item, businessId) {
  return deepFreeze({
    ...item,
    href: item.href ? mapBusinessHref(item.href, businessId) : null,
  });
}

function buildRecentCommunications({ ctx, businessId, limit = 5 }) {
  const bid = String(businessId ?? "");
  const threads = safeArray(ctx?.communicationRuntime?.getThreads?.());
  const messages = safeArray(ctx?.communicationRuntime?.getMessages?.());
  const messageById = new Map(messages.map((m) => [String(m.id), m]));

  return deepFreeze(
    threads
      .slice()
      .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0))
      .slice(0, limit)
      .map((thread) => {
        const lastMessageId = safeArray(thread.messageIds).at(-1);
        const lastMessage = lastMessageId ? messageById.get(String(lastMessageId)) : null;
        const preview = String(lastMessage?.body ?? "").trim();
        return deepFreeze({
          id: String(thread.id),
          subject: String(thread.subject ?? ""),
          preview: preview ? preview.slice(0, 160) : null,
          channel: String(thread.channel ?? ""),
          status: String(thread.status ?? ""),
          occurredAt: String(thread.updatedAt ?? thread.createdAt ?? ""),
          href: bid ? `/b/${bid}/inbox/${thread.id}` : null,
        });
      }),
  );
}

function resolveWorkspacePhase({ showOperatingDashboard, checklistComplete }) {
  if (!showOperatingDashboard) return "new";
  if (!checklistComplete) return "onboarding";
  return "operating";
}

/**
 * Executive workspace home — command center + portfolio operating slices with business-scoped links.
 */
export function buildExecutiveWorkspaceHomeView({
  identityViewModel,
  readinessReport,
  connectedSystemsSnapshot,
  employeeReadinessReport,
  connectionDependencyProjection,
  integrationPlatform,
  terminology,
  installationResult,
  industryPackage,
  ctx,
  presentation = {},
  nowISO,
  businessId,
  subjectTypes,
  checklistComplete = false,
} = {}) {
  const executivePresentation = resolveExecutivePresentation(presentation);
  const sectionLabels = executivePresentation.sections ?? {};
  const bid = String(businessId ?? "");

  const commandCenterRaw = composeBusinessCommandCenter({
    identityViewModel,
    readinessReport,
    connectedSystemsSnapshot,
    employeeReadinessReport,
    connectionDependencyProjection,
    integrationPlatform,
    terminology,
    installationResult,
    industryPackage,
    nowISO,
    ctx,
    businessId: bid,
  });
  const commandCenter = adaptBusinessCommandCenterView(commandCenterRaw, {
    pageLabels: presentation?.pageLabels ?? {},
  });

  const operating = buildBusinessOperatingHomeView({
    ctx,
    presentation,
    nowISO,
    businessId,
    subjectTypes,
    readinessReport,
    connectedSystemsSnapshot,
    employeeReadinessReport,
  });

  const showOperatingDashboard = operating.showOperatingDashboard;
  const workspacePhase = resolveWorkspacePhase({ showOperatingDashboard, checklistComplete });
  const collapseChecklist = showOperatingDashboard && !checklistComplete;

  const attention = deepFreeze(
    safeArray(commandCenter.needsYourAttention)
      .slice(0, 5)
      .map((item) => remapAttentionItem(item, bid)),
  );

  const episodeFeed = deepFreeze(
    safeArray(commandCenter.businessEpisodeFeed ?? commandCenter.businessEpisodes)
      .slice(0, 8)
      .map((ep) => remapEpisode(ep, bid)),
  );

  const workMovingNow = deepFreeze(safeArray(commandCenter.workMovingNow).map((row) => remapWorkRow(row, bid)));

  const autonomousContinuation = deepFreeze(
    safeArray(commandCenter.autonomousContinuation ?? commandCenter.whatHappensNext)
      .slice(0, 6)
      .map((item) => remapContinuationItem(item, bid)),
  );

  const digitalWorkforce = deepFreeze({
    digitalEmployees: deepFreeze(safeArray(commandCenter.digitalWorkforce?.digitalEmployees)),
    humanTeamSummary: commandCenter.digitalWorkforce?.humanTeamSummary ?? {},
  });

  const recentCommunications = buildRecentCommunications({ ctx, businessId: bid, limit: 5 });

  return deepFreeze({
    showOperatingDashboard,
    workspacePhase,
    collapseChecklist,
    hero: commandCenter.hero,
    businessControlStatus: commandCenter.businessControlStatus,
    operatingStates: commandCenter.operatingStates,
    metrics: operating.metrics,
    attention,
    attentionCount: attention.length,
    episodeFeed,
    workMovingNow,
    digitalWorkforce,
    autonomousContinuation,
    autonomousContinuationTitle:
      commandCenter.autonomousContinuationTitle ??
      String(sectionLabels.autonomousContinuation ?? "VIBETech will keep moving"),
    topProperties: operating.topProperties,
    recentActivity: operating.recentActivity,
    recentCommunications,
    unattributedInquiries: operating.unattributedInquiries,
    unattributedCallout: operating.unattributedCallout,
    sections: deepFreeze({
      businessToday: String(sectionLabels.businessToday ?? "Business today"),
      businessStatus: String(sectionLabels.businessStatus ?? "Business status"),
      attention: String(sectionLabels.attention ?? operating.sections.attention ?? "Needs decision"),
      movingNow: String(sectionLabels.movingNow ?? "Business moving now"),
      digitalWorkforce: String(sectionLabels.digitalWorkforce ?? "Digital workforce"),
      workInMotion: String(sectionLabels.workInMotion ?? "Work in motion"),
      propertyIntelligence: String(
        sectionLabels.propertyIntelligence ?? operating.sections.propertyIntelligence ?? "Property intelligence",
      ),
      recentCommunications: String(sectionLabels.recentCommunications ?? "Recent communications"),
      recentActivity: String(sectionLabels.recentActivity ?? operating.sections.recentActivity ?? "Recent activity"),
    }),
    portfolioTable: operating.portfolioTable,
    emptyStates: operating.emptyStates,
    generatedAt: String(nowISO ?? new Date().toISOString()),
  });
}
