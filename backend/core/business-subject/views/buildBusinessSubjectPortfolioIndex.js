import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  buildSubjectPortfolioProjection,
  sortSubjectPortfolioRows,
} from "./buildSubjectPortfolioProjection.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function mapPortfolioHref(businessId, subjectId) {
  const bid = String(businessId ?? "");
  const sid = String(subjectId ?? "");
  if (!bid || !sid) return null;
  return `/b/${bid}/properties/${sid}`;
}

function mapTotalsMetrics(totals, businessId, metricLabels = {}) {
  const bid = String(businessId ?? "");
  const t = totals ?? {};
  const labels = metricLabels ?? {};
  return deepFreeze([
    deepFreeze({
      id: "active_properties",
      label: String(labels.activeProperties ?? "Active properties"),
      value: String(t.activeProperties ?? 0),
      href: bid ? `/b/${bid}/properties` : null,
    }),
    deepFreeze({
      id: "open_inquiries",
      label: String(labels.openInquiries ?? "Open inquiries"),
      value: String(t.openInquiries ?? 0),
      href: bid ? `/b/${bid}/inbox` : null,
    }),
    deepFreeze({
      id: "interested_prospects",
      label: String(labels.interestedProspects ?? "Interested prospects"),
      value: String(t.interestedProspects ?? 0),
      href: bid ? `/b/${bid}/properties` : null,
    }),
    deepFreeze({
      id: "open_follow_ups",
      label: String(labels.openFollowUps ?? "Open follow-ups"),
      value: String(t.openFollowUps ?? 0),
      href: bid ? `/b/${bid}/work` : null,
    }),
  ]);
}

function resolveMetricLabels(presentation) {
  return presentation?.operatingHome?.metrics ?? presentation?.metrics ?? {};
}

/**
 * Universal subject portfolio index — sorted rows and totals for an index surface.
 */
export function buildBusinessSubjectPortfolioIndex({
  ctx,
  subjectTypes,
  businessId,
  nowISO,
  presentation = {},
} = {}) {
  const metricLabels = resolveMetricLabels(presentation);
  const portfolio = buildSubjectPortfolioProjection({
    ctx,
    subjectTypes,
    nowISO,
    topPropertyLimit: Number.MAX_SAFE_INTEGER,
    presentation,
  });

  const rows = deepFreeze(
    sortSubjectPortfolioRows(safeArray(portfolio.subjects)).map((row) =>
      deepFreeze({
        subjectId: String(row.subjectId),
        displayName: String(row.displayName ?? ""),
        subjectType: String(row.subjectType ?? ""),
        status: String(row.status ?? ""),
        address: row.address ? String(row.address) : null,
        inquiryCount: row.inquiryCount ?? 0,
        openInquiryCount: row.openInquiryCount ?? 0,
        interestedCount: row.interestedCount ?? 0,
        openFollowUpCount: row.openFollowUpCount ?? 0,
        overdueFollowUpCount: row.overdueFollowUpCount ?? 0,
        latestActivityAt: row.latestActivityAt ? String(row.latestActivityAt) : null,
        hasUnresolvedInquiries: Boolean(row.hasUnresolvedInquiries),
        hasRecentActivity: Boolean(row.hasRecentActivity),
        href: mapPortfolioHref(businessId, row.subjectId),
      }),
    ),
  );

  return deepFreeze({
    metrics: mapTotalsMetrics(portfolio.totals, businessId, metricLabels),
    totals: portfolio.totals,
    rows,
    generatedAt: portfolio.generatedAt,
  });
}
