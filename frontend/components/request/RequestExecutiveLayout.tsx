"use client";

import { useContext } from "react";

import type { RequestViewModel } from "./RequestContext";
import { RequestViewModelContext } from "./RequestContext";

import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveGrid from "@/components/executive/ExecutiveGrid";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveDivider from "@/components/executive/ExecutiveDivider";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";

import MetricCard from "@/components/executive/MetricCard";
import BusinessHealthCard from "@/components/executive/BusinessHealthCard";
import HealthBadge from "@/components/executive/HealthBadge";
import StatusPill from "@/components/executive/StatusPill";
import InsightCard from "@/components/executive/InsightCard";
import RecommendationCard from "@/components/executive/RecommendationCard";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";

import { semanticColors, spacing, typography } from "@/design/tokens";

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function toPriorityTier(p: string | null | undefined): "immediate" | "soon" | "later" {
  const s = String(p ?? "").toLowerCase();
  if (s === "high" || s === "immediate" || s === "urgent") return "immediate";
  if (s === "medium" || s === "soon") return "soon";
  return "later";
}

function toneFromTier(tier: "immediate" | "soon" | "later"): Parameters<typeof StatusPill>[0]["tone"] {
  if (tier === "immediate") return "danger";
  if (tier === "soon") return "warning";
  return "success";
}

function importanceFromTier(tier: "immediate" | "soon" | "later"): "high" | "medium" | "low" {
  if (tier === "immediate") return "high";
  if (tier === "soon") return "medium";
  return "low";
}

function numberFromTier(tier: "immediate" | "soon" | "later") {
  if (tier === "immediate") return 90;
  if (tier === "soon") return 70;
  return 40;
}

function healthFromRequestStatus(status: string | null | undefined): Parameters<typeof HealthBadge>[0]["level"] {
  const s = String(status ?? "").toLowerCase();
  if (["rejected", "failed", "blocked", "overdue"].includes(s)) return "critical";
  if (["reviewing", "review_required", "needs_attention"].includes(s)) return "warning";
  if (["converted", "closed", "completed"].includes(s)) return "excellent";
  return "good";
}

function ownerFromRequest(item: any) {
  return String(item?.assignedTeamMemberId ?? "Unassigned");
}

function attentionItemsByRequestId(attentionItems: any[]) {
  const map = new Map<string, any[]>();
  for (const it of attentionItems) {
    const rid = String(it?.metadata?.requestId ?? "");
    if (!rid) continue;
    const list = map.get(rid) ?? [];
    list.push(it);
    map.set(rid, list);
  }
  return map;
}

function stageKeyFromQueue(queueType: string | null | undefined) {
  const t = String(queueType ?? "").toLowerCase();
  if (t === "new_requests" || t === "received") return "received";
  if (t === "needs_review" || t === "reviewing") return "reviewing";
  if (t === "qualified") return "qualified";
  if (t === "ready_to_convert") return "converted"; // treated as the “ready” slope
  if (t === "converted") return "converted";
  if (t === "closed") return "closed";
  return "received";
}

function queueHealthFromQueue(q: any, attentionCount: number): Parameters<typeof HealthBadge>[0]["level"] {
  const st = String(q?.status ?? "").toLowerCase();
  if (st === "completed") return "excellent";
  if (st === "blocked") return "critical";
  if (st === "needs_attention") return "warning";
  if (attentionCount > 0) {
    const pri = safeArray(q?.items).length > 0 ? "soon" : "later";
    return pri === "soon" ? "warning" : "warning";
  }
  return "good";
}

function pipelineStageLabel(key: "received" | "reviewing" | "qualified" | "converted" | "closed") {
  if (key === "received") return "Received";
  if (key === "reviewing") return "Reviewing";
  if (key === "qualified") return "Qualified";
  if (key === "converted") return "Converted";
  return "Closed";
}

function priorityForPipelineStage(stageKey: string) {
  if (stageKey === "received" || stageKey === "reviewing") return "soon";
  if (stageKey === "qualified") return "immediate";
  if (stageKey === "converted") return "later";
  return "later";
}

function stageStatusForPill(stageKey: string) {
  if (stageKey === "received") return "Operationally sound";
  if (stageKey === "reviewing") return "Reviewing requests";
  if (stageKey === "qualified") return "Qualified opportunities";
  if (stageKey === "converted") return "Converted opportunities";
  return "Closed and archived";
}

function blockWorkFromAttention(attentionItems: any[]) {
  const blockedCategories = new Set([
    "overdue_requests",
    "missing_assignment",
    "qualified_not_converted",
    "failed_blocked_related_work",
    "requests_waiting_too_long",
    "conversion_backlog",
  ]);
  return safeArray(attentionItems).filter((a: any) => blockedCategories.has(String(a?.category ?? ""))).length;
}

function stageAttentionCounts(stageKey: string, stageRequestIds: Set<string>, attentionById: Map<string, any[]>) {
  let count = 0;
  for (const rid of stageRequestIds) {
    const list = attentionById.get(rid);
    if (list && list.length) count += list.length;
  }
  return count;
}

export default function RequestExecutiveLayout() {
  const viewModel = useContext<RequestViewModel | null>(RequestViewModelContext);
  if (!viewModel) return null;

  const pageTitle = viewModel.productContext?.pageLabels?.requestsPageTitle ?? "Requests OS";

  const metrics = viewModel.metrics ?? {};
  const queues = safeArray(viewModel.queues);
  const items = safeArray(viewModel.items);
  const attentionItems = safeArray(viewModel.attention?.items);
  const recommendedActions = safeArray(viewModel.recommendedActions);

  const attentionById = attentionItemsByRequestId(attentionItems);
  const blockedWork = blockWorkFromAttention(attentionItems);

  const totalRequests = Number(metrics.totalRequests ?? items.length ?? 0);
  const newRequests = Number(metrics.newRequests ?? 0);
  const qualifiedRequests = Number(metrics.qualifiedRequests ?? 0);
  const convertedRequests = Number(metrics.convertedRequests ?? 0);
  const closedRequests = Number(metrics.closedRequests ?? 0);

  const conversionRate = qualifiedRequests > 0 ? Math.round((convertedRequests / qualifiedRequests) * 100) : 0;
  const averageResponseDays = Number(metrics.averageAgeDays ?? 0);
  const averageResponseLabel = averageResponseDays > 1 ? `${averageResponseDays}d` : `${Math.round(averageResponseDays * 24)}h`;

  const totalActiveWork = totalRequests - closedRequests;
  const completionRate = totalRequests > 0 ? Math.round((closedRequests / totalRequests) * 100) : 0;

  const stageKeys = ["received", "reviewing", "qualified", "converted", "closed"] as const;
  const stageQueueByKey = new Map<string, any>();
  for (const q of queues) {
    const key = stageKeyFromQueue(String(q?.type ?? q?.name ?? ""));
    if (!stageQueueByKey.has(key)) stageQueueByKey.set(key, q);
  }

  const stageCards = stageKeys.map((key) => {
    const q = stageQueueByKey.get(key);
    const requestIds = new Set(
      safeArray(q?.items).map((id: any) => String(id)).filter(Boolean),
    );
    const attentionCount = stageAttentionCounts(key, requestIds, attentionById);
    const count = Number(q?.itemCount ?? requestIds.size ?? 0);
    const health = queueHealthFromQueue(q ?? {}, attentionCount);
    const tier = attentionCount > 0 ? "immediate" : (key === "reviewing" ? "soon" : "later");
    const pillTone = toneFromTier(tier);
    const pillLabel = attentionCount > 0 ? `${attentionCount} attention` : stageStatusForPill(key);

    return { key, queue: q, count, attentionCount, health, pillTone, pillLabel };
  });

  const priorityOpportunityItems = safeArray(items)
    .slice()
    .sort((a, b) => {
      const aTier = toPriorityTier(a?.priority);
      const bTier = toPriorityTier(b?.priority);
      const rank = { immediate: 0, soon: 1, later: 2 } as const;
      return (rank[aTier] ?? 2) - (rank[bTier] ?? 2) || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
    })
    .slice(0, 6);

  const topAttention = attentionItems
    .slice()
    .sort((a, b) => toPriorityTier(b?.priority) === toPriorityTier(a?.priority) ? 0 : toPriorityTier(b?.priority) === "immediate" ? -1 : 1)[0];

  const bottomSummary = (() => {
    if (attentionItems.length === 0) return "Opportunity flow is healthy.";
    if (topAttention?.summary) return `Next: ${String(topAttention.summary)}.`;
    return "Opportunities require executive attention. Review the highest-priority signals first.";
  })();

  // Pipeline risks mapped from attention categories only.
  const riskCandidates = attentionItems
    .slice()
    .map((a: any) => {
      const category = String(a?.category ?? "");
      const summary = String(a?.summary ?? "");
      const priorityTier = toPriorityTier(a?.priority);

      const riskTitle = (() => {
        if (category === "overdue_requests") return "Slow response";
        if (category === "requests_waiting_too_long") return "Slow response";
        if (category === "conversion_backlog") return "Qualification backlog";
        if (category === "qualified_not_converted") return "Conversion issues";
        if (category === "missing_assignment") return "Stalled requests";
        if (category === "failed_blocked_related_work") return "Conversion issues";
        return "Delivery risk";
      })();

      return { id: String(a?.id ?? category), riskTitle, summary, category, priorityTier };
    })
    .slice(0, 8);

  const pipelineRisks = riskCandidates
    .slice()
    .sort((a: any, b: any) => {
      const rank = { immediate: 0, soon: 1, later: 2 } as const;
      const tierA = String(a?.priorityTier ?? "later").toLowerCase() as "immediate" | "soon" | "later";
      const tierB = String(b?.priorityTier ?? "later").toLowerCase() as "immediate" | "soon" | "later";
      return (rank[tierA] ?? 2) - (rank[tierB] ?? 2);
    })
    .slice(0, 4);

  const heroStatusTone = attentionItems.length > 0 ? (blockedWork > 0 ? "critical" : "warning") : "excellent";
  const heroScore = Math.max(0, Math.min(100, 100 - blockedWork * 12 - Math.round((averageResponseDays ?? 0) * 3)));

  const newStageCount = stageCards.find((s) => s.key === "received")?.count ?? newRequests;
  const waitingCount = stageCards.find((s) => s.key === "reviewing")?.attentionCount ?? attentionItems.length;

  return (
    <ExecutiveSurface>
      <div style={{ width: "100%", minHeight: "100vh", padding: spacing.xl }}>
        <ExecutiveStack gap="xl">
          {/* Hero */}
          <ExecutiveHeader title={pageTitle} subtitle="Where are tomorrow's opportunities?" />

          <ExecutiveCard style={{ padding: spacing.lg }}>
            <div style={{ display: "flex", gap: spacing.lg, alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                  Executive opportunity summary
                </div>
                <div style={{ marginTop: spacing.xs, color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
                  {String(viewModel.summary ?? "").trim() || "Opportunity flow is healthy."}
                </div>

                <div style={{ marginTop: spacing.md, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  <MetricCard title="Total active work" value={totalActiveWork} status="recorded" priority="Later" />
                  <MetricCard title="Completion rate" value={`${completionRate}%`} status="recorded" priority={completionRate >= 70 ? "Immediate" : "Later"} />
                  <MetricCard title="Blocked work" value={blockedWork} status="recorded" priority={blockedWork > 0 ? "Immediate" : "Later"} />
                </div>
              </div>

              <div style={{ flex: "0 0 auto", minWidth: 360 }}>
                <BusinessHealthCard
                  title="Pipeline Health"
                  score={heroScore}
                  level={heroStatusTone}
                  summary="Deterministic indicators showing whether requests can convert safely."
                />
              </div>
            </div>
          </ExecutiveCard>

          {/* Delivery Pulse / KPI strip */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Opportunity Pulse" subtitle="Executive KPI strip" />
            <div style={{ marginTop: spacing.md }}>
              <ExecutiveGrid columns={3}>
                <MetricCard title="New" value={newRequests} status="recorded" priority={newRequests > 0 ? "Soon" : "Later"} />
                <MetricCard title="Reviewing" value={stageCards.find((s) => s.key === "reviewing")?.count ?? 0} status="recorded" priority="Later" />
                <MetricCard title="Qualified" value={qualifiedRequests} status="recorded" priority="Later" />

                <MetricCard title="Converted" value={convertedRequests} status="recorded" priority={conversionRate >= 50 ? "Immediate" : "Later"} />
                <MetricCard title="Rejected" value={safeArray(items).filter((i: any) => String(i?.status ?? "") === "rejected").length} status="recorded" priority="Later" />
                <MetricCard title="Waiting" value={waitingCount} status="recorded" priority={waitingCount > 0 ? "Soon" : "Later"} />

                <MetricCard title="Average Response Time" value={averageResponseLabel} status="recorded" priority="Later" />
                <MetricCard title="Conversion Rate" value={`${conversionRate}%`} status="recorded" priority={conversionRate >= 50 ? "Immediate" : "Later"} />
                <MetricCard title="New backlog risk" value={Math.max(0, waitingCount - newStageCount)} status="recorded" priority="Later" />
              </ExecutiveGrid>
            </div>
          </ExecutiveCard>

          {/* Pipeline / stage cards */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Pipeline" subtitle="Executive stage cards" />
            <div style={{ marginTop: spacing.md }}>
              <ExecutiveGrid columns={2}>
                {stageCards.map((s) => (
                  <ExecutiveCard key={s.key} style={{ padding: spacing.lg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
                          {pipelineStageLabel(s.key)}
                        </div>
                        <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                          Stage health and attention
                        </div>
                      </div>
                      <HealthBadge level={s.health} />
                    </div>

                    <div style={{ marginTop: spacing.md }}>
                      <MetricCard title="Count" value={s.count} status="recorded" priority={s.attentionCount > 0 ? "Immediate" : "Later"} />
                    </div>

                    <div style={{ marginTop: spacing.sm, display: "flex", justifyContent: "flex-end" }}>
                      <StatusPill tone={s.pillTone} label={s.pillLabel} />
                    </div>
                  </ExecutiveCard>
                ))}
              </ExecutiveGrid>

              {totalRequests === 0 ? (
                <div style={{ marginTop: spacing.md }}>
                  <ExecutiveEmptyState title="Pipeline" message="Delivery is operating smoothly." />
                </div>
              ) : null}
            </div>
          </ExecutiveCard>

          {/* Priority Opportunities */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Priority Opportunities" subtitle="Large executive cards" />
            <div style={{ marginTop: spacing.md }}>
              {priorityOpportunityItems.length === 0 ? (
                <ExecutiveEmptyState title="Priority Opportunities" message="No requests require executive intervention." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {priorityOpportunityItems
                    .slice()
                    .sort((a: any, b: any) => Number(b?.attentionRequired ?? false) - Number(a?.attentionRequired ?? false))
                    .slice(0, 4)
                    .map((it: any) => {
                      const rid = String(it?.id ?? "");
                      const attentionCount = attentionById.get(rid)?.length ?? 0;
                      const tier = toPriorityTier(it?.priority);
                      const health = it?.attentionRequired ? "warning" : healthFromRequestStatus(it?.status);

                      return (
                        <ExecutiveCard key={rid} style={{ padding: spacing.lg }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
                                {String(it?.requester ?? "Customer")}
                              </div>
                              <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                                Customer · {String(it?.requestType ?? it?.title ?? "")}
                              </div>
                            </div>
                            <HealthBadge level={health} />
                          </div>

                          <div style={{ marginTop: spacing.md, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: spacing.sm }}>
                            <MetricCard title="Priority" value={String(it?.priority ?? "").toUpperCase() || "—"} status="recorded" priority={tier === "immediate" ? "Immediate" : tier === "soon" ? "Soon" : "Later"} />
                            <MetricCard title="Age" value={String(it?.age ?? "") || "—"} status="recorded" priority="Later" />
                            <MetricCard title="Owner" value={ownerFromRequest(it)} status="recorded" priority="Later" />
                            <MetricCard title="Health" value={String(health).toUpperCase()} status="recorded" priority="Later" />
                          </div>

                          <div style={{ marginTop: spacing.sm, display: "flex", justifyContent: "flex-end" }}>
                            <StatusPill tone={attentionCount > 0 ? toneFromTier(tier) : "success"} label={attentionCount > 0 ? `${attentionCount} attention` : "Operating smoothly"} />
                          </div>
                        </ExecutiveCard>
                      );
                    })}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Pipeline Risks */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Pipeline Risks" subtitle="Insight cards" />
            <div style={{ marginTop: spacing.md }}>
              {attentionItems.length === 0 ? (
                <ExecutiveEmptyState title="Pipeline Risks" message="Opportunity flow is operating smoothly." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {pipelineRisks.map((r) => (
                    <InsightCard
                      key={r.id}
                      title={r.riskTitle}
                      category={r.category}
                      importance={importanceFromTier(r.priorityTier)}
                      message={r.summary}
                    />
                  ))}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Recommendations */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Recommendations" subtitle="Executive recommendation cards" />
            <div style={{ marginTop: spacing.md }}>
              {recommendedActions.length === 0 ? (
                <ExecutiveEmptyState title="Recommendations" message="No requests currently require executive intervention." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {recommendedActions.slice(0, 6).map((a: any) => {
                    const tier = toPriorityTier(a?.priority);
                    const priority = numberFromTier(tier);
                    const recommendation = a?.disabled ? "Temporarily disabled until prerequisites are resolved." : "Ready to execute when leadership confirms the decision.";
                    return (
                      <RecommendationCard
                        key={String(a?.id ?? "")}
                        title={String(a?.label ?? a?.type ?? "Recommendation")}
                        actionType={String(a?.type ?? "request_action")}
                        priority={priority}
                        recommendation={recommendation}
                      />
                    );
                  })}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Bottom Summary */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <ExecutiveHeader title="Bottom Summary" subtitle="What opportunities deserve attention today?" />
            <div style={{ marginTop: spacing.md, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
              {bottomSummary}
            </div>
          </ExecutiveCard>
        </ExecutiveStack>
      </div>
    </ExecutiveSurface>
  );
}
