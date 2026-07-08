import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { buildSubjectPortfolioProjection } from "../business-subject/views/buildSubjectPortfolioProjection.js";
import { projectBusinessEpisodes } from "../episodes/BusinessEpisodeProjection.js";
import { projectOwnerAttention } from "./OwnerAttentionProjection.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function resolveOperatingHomePresentation(presentation) {
  return presentation?.operatingHome ?? {};
}

function formatUnattributedCallout(template, count) {
  const text = String(template ?? "{count} inquiries not linked to a property");
  return text.replace(/\{count\}/g, String(count));
}

function mapActivityItem(episode, businessId) {
  const requestId = episode.requestId ? String(episode.requestId) : null;
  const subjectId = episode.primarySubject?.id ? String(episode.primarySubject.id) : null;
  let href = null;
  if (requestId) href = `/b/${businessId}/inbox/ct_ack_${requestId}`;
  else if (subjectId) href = `/b/${businessId}/properties/${subjectId}`;

  return deepFreeze({
    id: String(episode.episodeId),
    title: String(episode.title ?? ""),
    summary: String(episode.summary ?? ""),
    occurredAt: String(episode.updatedAt ?? episode.occurredAt ?? ""),
    subjectId,
    subjectName: episode.primarySubject?.displayName ? String(episode.primarySubject.displayName) : null,
    partyId: episode.primaryParty?.id ? String(episode.primaryParty.id) : null,
    partyName: episode.primaryParty?.displayName ? String(episode.primaryParty.displayName) : null,
    requestId,
    href,
  });
}

function mapAttentionItem(item, businessId) {
  const actions = safeArray(item.availableActions);
  const first = actions[0];
  let href = first?.href ? String(first.href) : `/b/${businessId}/for-you`;
  if (href.startsWith("/engagement/")) {
    href = `/b/${businessId}/people`;
  }
  return deepFreeze({
    id: String(item.id),
    title: String(item.title ?? ""),
    summary: String(item.summary ?? item.reason ?? ""),
    priority: String(item.priority ?? "medium"),
    href,
  });
}

/**
 * Lightweight operating home view model from canonical runtimes.
 */
export function buildBusinessOperatingHomeView({
  ctx,
  presentation = {},
  nowISO,
  businessId,
  subjectTypes,
  readinessReport,
  connectedSystemsSnapshot,
  employeeReadinessReport,
  recentActivityLimit = 8,
  attentionLimit = 5,
  topPropertyLimit = 5,
} = {}) {
  const homePresentation = resolveOperatingHomePresentation(presentation);
  const metricLabels = homePresentation.metrics ?? {};
  const portfolio = buildSubjectPortfolioProjection({
    ctx,
    subjectTypes,
    nowISO,
    topPropertyLimit,
    presentation,
  });

  const totals = portfolio.totals;
  const bid = String(businessId ?? "");

  const metrics = deepFreeze([
    deepFreeze({
      id: "active_properties",
      label: String(metricLabels.activeProperties ?? "Active properties"),
      value: String(totals.activeProperties),
      href: bid ? `/b/${bid}/properties` : "/properties",
    }),
    deepFreeze({
      id: "open_inquiries",
      label: String(metricLabels.openInquiries ?? "Open inquiries"),
      value: String(totals.openInquiries),
      href: bid ? `/b/${bid}/inbox` : "/inbox",
    }),
    deepFreeze({
      id: "interested_prospects",
      label: String(metricLabels.interestedProspects ?? "Interested prospects"),
      value: String(totals.interestedProspects),
      href: bid ? `/b/${bid}/properties` : "/properties",
    }),
    deepFreeze({
      id: "open_follow_ups",
      label: String(metricLabels.openFollowUps ?? "Open follow-ups"),
      value: String(totals.openFollowUps),
      href: bid ? `/b/${bid}/work` : "/work",
    }),
  ]);

  const topProperties = deepFreeze(
    safeArray(portfolio.topProperties).map((row) =>
      deepFreeze({
        subjectId: row.subjectId,
        displayName: row.displayName,
        status: row.status,
        address: row.address,
        inquiryCount: row.inquiryCount,
        interestedCount: row.interestedCount,
        openFollowUpCount: row.openFollowUpCount,
        latestActivityAt: row.latestActivityAt,
        href: bid ? `/b/${bid}/properties/${row.subjectId}` : `/properties/${row.subjectId}`,
      }),
    ),
  );

  const episodes = projectBusinessEpisodes({ ctx, presentation, nowISO });
  const recentActivity = deepFreeze(
    safeArray(episodes)
      .slice(0, recentActivityLimit)
      .map((ep) => mapActivityItem(ep, bid)),
  );

  const attentionItems = projectOwnerAttention({
    approvalRuntime: ctx?.approvalRuntime,
    workRuntime: ctx?.workRuntime,
    requestRuntime: ctx?.requestRuntime,
    businessGraphRuntime: ctx?.businessGraphRuntime,
    businessSubjectRuntime: ctx?.businessSubjectRuntime,
    readinessReport,
    connectedSystemsSnapshot,
    employeeReadinessReport,
    nowISO,
  });

  const attention = deepFreeze(
    safeArray(attentionItems)
      .slice(0, attentionLimit)
      .map((item) => mapAttentionItem(item, bid)),
  );

  const showOperatingDashboard = totals.totalProperties > 0 || totals.totalInquiries > 0;

  return deepFreeze({
    showOperatingDashboard,
    metrics,
    topProperties,
    recentActivity,
    attention,
    unattributedInquiries: totals.unattributedInquiries,
    unattributedCallout:
      totals.unattributedInquiries > 0
        ? formatUnattributedCallout(homePresentation.unattributedCallout, totals.unattributedInquiries)
        : null,
    sections: deepFreeze({
      propertyIntelligence: String(homePresentation.sections?.propertyIntelligence ?? "Property intelligence"),
      recentActivity: String(homePresentation.sections?.recentActivity ?? "Recent activity"),
      attention: String(homePresentation.sections?.attention ?? "Needs attention"),
    }),
    portfolioTable: deepFreeze({
      property: String(homePresentation.portfolioTable?.property ?? "Property"),
      inquiries: String(homePresentation.portfolioTable?.inquiries ?? "Inquiries"),
      interested: String(homePresentation.portfolioTable?.interested ?? "Interested"),
      followUps: String(homePresentation.portfolioTable?.followUps ?? "Open follow-ups"),
      latestActivity: String(homePresentation.portfolioTable?.latestActivity ?? "Latest activity"),
    }),
    emptyStates: deepFreeze(homePresentation.emptyStates ?? {}),
    generatedAt: String(nowISO ?? new Date().toISOString()),
  });
}
