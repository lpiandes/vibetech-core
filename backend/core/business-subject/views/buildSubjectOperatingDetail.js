import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { ENTITY_TYPES } from "../../references/EntityRef.js";
import { projectBusinessEpisodes } from "../../episodes/BusinessEpisodeProjection.js";
import { formatBusinessDateWithOverdue } from "../../presentation/formatBusinessDate.js";
import {
  buildSubjectPortfolioProjection,
  findSubjectPortfolioRow,
} from "./buildSubjectPortfolioProjection.js";
import {
  isOpenRequest,
  isOpenWork,
  isOverdueWork,
  collectSubjectIdentityIds,
  requestReferencesSubject,
  resolveWorkSubjectIds,
} from "./subjectPortfolioSemantics.js";
import { resolveWorkPartyId } from "../../work/views/resolveWorkRowLinks.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function partyDisplayName(ctx, partyId) {
  if (!partyId) return null;
  return ctx?.businessGraphRuntime?.getParty?.(String(partyId))?.displayName ?? String(partyId);
}

function requestTypeLabel(presentation, requestType) {
  return presentation?.requestTypeLabels?.[requestType] ?? String(requestType ?? "request").replace(/_/g, " ");
}

function workTypeLabel(presentation, workType) {
  return presentation?.workTypeLabels?.[workType] ?? String(workType ?? "work").replace(/_/g, " ");
}

function buildRecentRequests({ ctx, subjectId, presentation, limit = 10 }) {
  return deepFreeze(
    safeArray(ctx?.requestRuntime?.getRequests?.())
      .filter((r) => requestReferencesSubject(r, subjectId, ctx?.businessSubjectRuntime))
      .sort((a, b) => String(b.receivedAt ?? b.createdAt ?? "").localeCompare(String(a.receivedAt ?? a.createdAt ?? "")))
      .slice(0, limit)
      .map((request) =>
        deepFreeze({
          id: String(request.id),
          title: String(request.title ?? requestTypeLabel(presentation, request.requestType)),
          requestType: String(request.requestType ?? ""),
          requestTypeLabel: requestTypeLabel(presentation, request.requestType),
          status: String(request.status ?? ""),
          receivedAt: request.receivedAt ? String(request.receivedAt) : null,
          partyId: request.requester ? String(request.requester) : null,
          partyName: partyDisplayName(ctx, request.requester),
          sourceLabel: request.inboundAttribution?.sourceLabel
            ? String(request.inboundAttribution.sourceLabel)
            : request.source
              ? String(request.source)
              : null,
          isOpen: isOpenRequest(request),
        }),
      ),
  );
}

function buildOpenWork({ ctx, subjectId, presentation, nowISO, limit = 10 }) {
  const rows = [];
  for (const work of safeArray(ctx?.workRuntime?.getWorkItems?.())) {
    if (!isOpenWork(work)) continue;
    const subjectIds = resolveWorkSubjectIds(work, ctx?.requestRuntime, ctx?.businessSubjectRuntime);
    const pageIds = new Set(
      collectSubjectIdentityIds(subjectId, ctx?.businessSubjectRuntime).map(String),
    );
    if (!subjectIds.some((id) => pageIds.has(String(id)))) continue;

    const dueMeta = work.dueAt ? formatBusinessDateWithOverdue(work.dueAt, { nowISO }) : { label: null, overdue: false };
    const partyId = resolveWorkPartyId({
      workItem: work,
      requestRuntime: ctx?.requestRuntime,
      businessGraphRuntime: ctx?.businessGraphRuntime,
    });
    rows.push(
      deepFreeze({
        id: String(work.id),
        title: String(work.title ?? work.id),
        workType: String(work.workType ?? ""),
        workTypeLabel: workTypeLabel(presentation, work.workType),
        status: String(work.status ?? ""),
        priority: String(work.priority ?? "normal"),
        dueAt: work.dueAt ? String(work.dueAt) : null,
        dueLabel: dueMeta.label,
        overdue: Boolean(dueMeta.overdue) || isOverdueWork(work, nowISO),
        partyId,
        partyName: partyDisplayName(ctx, partyId),
      }),
    );
  }

  return deepFreeze(
    rows
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        const priority = { urgent: 0, high: 1, medium: 2, normal: 3 };
        return (priority[a.priority] ?? 3) - (priority[b.priority] ?? 3);
      })
      .slice(0, limit),
  );
}

function episodeReferencesSubject(episode, subjectId) {
  const sid = String(subjectId);
  if (String(episode?.primarySubject?.id) === sid) return true;
  return safeArray(episode?.relatedObjects).some(
    (ref) => String(ref?.entityType) === ENTITY_TYPES.SUBJECT && String(ref?.entityId) === sid,
  );
}

function buildRecentActivity({ ctx, subjectId, presentation, nowISO, limit = 8 }) {
  const episodes = projectBusinessEpisodes({ ctx, presentation, nowISO });
  return deepFreeze(
    safeArray(episodes)
      .filter((ep) => episodeReferencesSubject(ep, subjectId))
      .sort((a, b) => String(b.updatedAt ?? b.occurredAt ?? "").localeCompare(String(a.updatedAt ?? a.occurredAt ?? "")))
      .slice(0, limit)
      .map((ep) =>
        deepFreeze({
          id: String(ep.episodeId),
          title: String(ep.title ?? ""),
          summary: String(ep.summary ?? ""),
          occurredAt: String(ep.updatedAt ?? ep.occurredAt ?? nowISO),
          requestId: ep.requestId ? String(ep.requestId) : null,
          partyId: ep.primaryParty?.id ? String(ep.primaryParty.id) : null,
          partyName: ep.primaryParty?.displayName ? String(ep.primaryParty.displayName) : null,
        }),
      ),
  );
}

/**
 * Subject-scoped operating detail for a single canonical subject.
 * Portfolio row metrics are sourced from buildSubjectPortfolioProjection for consistency.
 */
export function buildSubjectOperatingDetail({
  subjectId,
  ctx,
  presentation = {},
  subjectTypes,
  nowISO,
  limits = {},
} = {}) {
  const sid = String(subjectId ?? "");
  if (!sid) return null;

  const subject = ctx?.businessSubjectRuntime?.getSubject?.(sid) ?? null;
  if (!subject) return null;

  const portfolio = buildSubjectPortfolioProjection({ ctx, subjectTypes, nowISO, presentation });
  const row = findSubjectPortfolioRow(portfolio, sid);

  const inquiryLimit = limits.inquiries ?? 10;
  const workLimit = limits.work ?? 10;
  const activityLimit = limits.activity ?? 8;

  return deepFreeze({
    subject: deepFreeze({
      id: sid,
      displayName: String(subject.displayName),
      subjectType: String(subject.subjectType),
      status: String(subject.status),
      address: subject.keyAttributes?.address ? String(subject.keyAttributes.address) : null,
    }),
    metrics: deepFreeze({
      inquiryCount: row?.inquiryCount ?? 0,
      openInquiryCount: row?.openInquiryCount ?? 0,
      interestedCount: row?.interestedCount ?? 0,
      openFollowUpCount: row?.openFollowUpCount ?? 0,
      overdueFollowUpCount: row?.overdueFollowUpCount ?? 0,
      latestActivityAt: row?.latestActivityAt ?? null,
    }),
    recentInquiries: buildRecentRequests({ ctx, subjectId: sid, presentation, limit: inquiryLimit }),
    openWork: buildOpenWork({ ctx, subjectId: sid, presentation, nowISO, limit: workLimit }),
    recentActivity: buildRecentActivity({ ctx, subjectId: sid, presentation, nowISO, limit: activityLimit }),
    sectionLabels: deepFreeze(presentation?.operatingHome?.detail ?? {}),
    generatedAt: String(nowISO ?? new Date().toISOString()),
  });
}
