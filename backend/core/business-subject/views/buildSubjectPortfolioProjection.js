import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { buildBusinessSubjectIndex } from "./buildBusinessSubjectIndex.js";
import { buildSubjectInterestSegmentCriteria } from "../../segments/buildSubjectInterestSegmentCriteria.js";
import { projectSegmentMembership } from "../../segments/SegmentProjectionEngine.js";
import {
  isPortfolioInquiryRequest,
  isPortfolioFollowUpWork,
  isOpenRequest,
  isOpenWork,
  isOverdueWork,
  requestReferencesSubject,
  resolveWorkSubjectIds,
  latestIsoTimestamp,
  isWithinRecentDays,
} from "./subjectPortfolioSemantics.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function interactionReferencesSubject(interaction, subjectId) {
  return safeArray(interaction?.relatedObjects).some(
    (ref) => String(ref?.entityType) === "SUBJECT" && String(ref?.entityId) === String(subjectId),
  );
}

function countAudienceForSubject({ subjectId, ctx }) {
  const criteria = buildSubjectInterestSegmentCriteria(subjectId);
  const projection = projectSegmentMembership({
    segmentDefinition: {
      id: `portfolio_subject_${subjectId}`,
      name: "Portfolio subject audience",
      targetEntityType: "Party",
      criteria,
    },
    businessGraphRuntime: ctx?.businessGraphRuntime,
    requestRuntime: ctx?.requestRuntime,
    interactionRuntime: ctx?.interactionRuntime,
    businessSubjectRuntime: ctx?.businessSubjectRuntime,
  });
  return {
    count: projection.members.length,
    partyIds: projection.members.map((m) => String(m.entityId)),
  };
}

export function sortSubjectPortfolioRows(rows) {
  return rows.slice().sort((a, b) => {
    if (b.inquiryCount !== a.inquiryCount) return b.inquiryCount - a.inquiryCount;
    if (b.interestedCount !== a.interestedCount) return b.interestedCount - a.interestedCount;
    return String(a.displayName).localeCompare(String(b.displayName));
  });
}

/**
 * Universal read-only subject portfolio projection from canonical runtimes.
 */
export function buildSubjectPortfolioProjection({
  ctx,
  subjectTypes,
  nowISO,
  topPropertyLimit = 5,
  recentActivityDays = 30,
  presentation = {},
} = {}) {
  const index = buildBusinessSubjectIndex({
    businessSubjectRuntime: ctx?.businessSubjectRuntime,
    subjectTypes,
  });

  const requests = safeArray(ctx?.requestRuntime?.getRequests?.());
  const workItems = safeArray(ctx?.workRuntime?.getWorkItems?.());
  const interactions = safeArray(ctx?.interactionRuntime?.getInteractions?.());

  const inquiries = requests.filter((request) => isPortfolioInquiryRequest(request, presentation));
  const openInquiries = inquiries.filter(isOpenRequest);
  const unattributedInquiries = openInquiries.filter((r) => safeArray(r.subjectRefs).length === 0);

  const workBySubject = new Map();
  for (const work of workItems) {
    for (const subjectId of resolveWorkSubjectIds(work, ctx?.requestRuntime, ctx?.businessSubjectRuntime)) {
      const list = workBySubject.get(subjectId) ?? [];
      list.push(work);
      workBySubject.set(subjectId, list);
    }
  }

  const globalInterestedPartyIds = new Set();
  const subjectRows = [];
  let portfolioOpenFollowUps = 0;
  let portfolioOverdueFollowUps = 0;

  for (const subject of index.subjects) {
    const subjectId = String(subject.id);
    const subjectInquiries = inquiries.filter((r) =>
      requestReferencesSubject(r, subjectId, ctx?.businessSubjectRuntime),
    );
    const subjectOpenInquiries = subjectInquiries.filter(isOpenRequest);
    const subjectWork = workBySubject.get(subjectId) ?? [];
    const openFollowUps = subjectWork.filter(
      (w) => isPortfolioFollowUpWork(w, presentation) && isOpenWork(w),
    );
    const overdueFollowUps = openFollowUps.filter((w) => isOverdueWork(w, nowISO));

    portfolioOpenFollowUps += openFollowUps.length;
    portfolioOverdueFollowUps += overdueFollowUps.length;

    const audience = countAudienceForSubject({ subjectId, ctx });
    for (const partyId of audience.partyIds) globalInterestedPartyIds.add(partyId);

    const subjectInteractions = interactions.filter((i) => interactionReferencesSubject(i, subjectId));
    const latestActivityAt = latestIsoTimestamp(
      ...subjectInquiries.map((r) => r.receivedAt ?? r.updatedAt),
      ...subjectInteractions.map((i) => i.occurredAt ?? i.updatedAt),
      ...subjectWork.map((w) => w.updatedAt ?? w.createdAt),
      subject.updatedAt,
    );

    subjectRows.push(
      deepFreeze({
        subjectId,
        displayName: subject.displayName,
        subjectType: subject.subjectType,
        status: subject.status,
        address: subject.address,
        inquiryCount: subjectInquiries.length,
        openInquiryCount: subjectOpenInquiries.length,
        interestedCount: audience.count,
        openFollowUpCount: openFollowUps.length,
        overdueFollowUpCount: overdueFollowUps.length,
        latestActivityAt,
        hasRecentActivity: isWithinRecentDays(latestActivityAt, nowISO, recentActivityDays),
        hasUnresolvedInquiries: subjectOpenInquiries.length > 0,
      }),
    );
  }

  const topProperties = sortSubjectPortfolioRows(subjectRows).slice(0, topPropertyLimit);

  return deepFreeze({
    subjects: deepFreeze(subjectRows),
    topProperties: deepFreeze(topProperties),
    totals: deepFreeze({
      totalProperties: index.totalCount,
      activeProperties: index.activeCount,
      inactiveProperties: index.totalCount - index.activeCount,
      totalInquiries: inquiries.length,
      openInquiries: openInquiries.length,
      unattributedInquiries: unattributedInquiries.length,
      interestedProspects: globalInterestedPartyIds.size,
      openFollowUps: portfolioOpenFollowUps,
      overdueFollowUps: portfolioOverdueFollowUps,
    }),
    generatedAt: String(nowISO ?? new Date().toISOString()),
  });
}

export function findSubjectPortfolioRow(portfolio, subjectId) {
  const sid = String(subjectId ?? "");
  return safeArray(portfolio?.subjects).find((row) => String(row.subjectId) === sid) ?? null;
}
