"use client";

import { useContext } from "react";

import type { TeamViewModel } from "./TeamContext";
import { TeamViewModelContext } from "./TeamContext";

import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveGrid from "@/components/executive/ExecutiveGrid";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import MetricCard from "@/components/executive/MetricCard";
import BusinessHealthCard from "@/components/executive/BusinessHealthCard";
import InsightCard from "@/components/executive/InsightCard";
import RecommendationCard from "@/components/executive/RecommendationCard";
import HealthBadge from "@/components/executive/HealthBadge";
import StatusPill from "@/components/executive/StatusPill";

import { semanticColors, spacing, typography } from "@/design/tokens";

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function clampInt(n: number, min: number, max: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function priorityToStatusTone(priority: string | undefined | null): "success" | "warning" | "danger" | "info" | "accent" | "neutral" {
  const p = String(priority ?? "").toLowerCase();
  if (p === "immediate") return "danger";
  if (p === "soon") return "warning";
  return "neutral";
}

function priorityToImportance(priority: string | undefined | null): "low" | "medium" | "high" {
  const p = String(priority ?? "").toLowerCase();
  if (p === "immediate") return "high";
  if (p === "soon") return "medium";
  return "low";
}

function priorityToRecommendationNumber(priority: string | undefined | null) {
  const p = String(priority ?? "").toLowerCase();
  if (p === "immediate") return 90;
  if (p === "soon") return 70;
  return 40;
}

function healthLevelFromDepartmentStatus(status: string | undefined | null): Parameters<typeof HealthBadge>[0]["level"] {
  const s = String(status ?? "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "needs_attention") return "warning";
  return "excellent";
}

function healthLevelFromMember(member: any): Parameters<typeof HealthBadge>[0]["level"] {
  const status = String(member?.status ?? "").toLowerCase();
  const badges = safeArray(member?.badges).map((b: any) => String(b));

  if (String(member?.attentionRequired ?? false) === "true") {
    if (status === "blocked" || status === "offline") return "critical";
    // overloaded/coverage gaps -> warning
    if (badges.some((b) => b.toLowerCase().includes("overloaded"))) return "warning";
  }

  if (status === "blocked" || status === "offline") return "critical";
  if (badges.some((b) => b.toLowerCase().includes("overloaded"))) return "warning";
  if (status === "busy" || status === "away") return "good";
  return "excellent";
}

function statusLabelForMember(member: any) {
  const status = String(member?.status ?? "").toLowerCase();
  const badges = safeArray(member?.badges).map((b: any) => String(b));

  if (status === "blocked") return "Blocked — needs investigation";
  if (status === "offline") return "Offline — critical coverage missing";
  if (badges.some((b) => b.toLowerCase().includes("overloaded"))) return "Overloaded — pending work requires review";
  if (status === "busy") return "Busy with in-flight work";
  if (status === "away") return "Away — coverage may be reduced";
  return "Operating smoothly";
}

function memberAttentionPriority(member: any, attentionItems: any[]) {
  const memberId = String(member?.id ?? "");
  const direct = safeArray(attentionItems).find((it: any) => String(it?.metadata?.memberId ?? "") === memberId);
  if (direct?.priority) return String(direct.priority);

  // Best-effort fallback when metadata isn't present.
  const status = String(member?.status ?? "");
  if (status === "blocked" || status === "offline") return "immediate";
  if (badgesContain(member, "Overloaded")) return "soon";
  return "later";
}

function badgesContain(member: any, needle: string) {
  const badges = safeArray(member?.badges).map((b: any) => String(b).toLowerCase());
  return badges.some((b: string) => b.includes(String(needle).toLowerCase()));
}

function attentionCategoryLabel(category: string | undefined | null) {
  const c = String(category ?? "").toLowerCase();
  if (c === "blocked_members") return "Unblock coverage";
  if (c === "overloaded_members") return "Rebalance workload";
  if (c === "offline_critical_members") return "Restore critical coverage";
  if (c === "pending_approvals") return "Review pending approvals";
  if (c === "failed_communications") return "Investigate communication failures";
  if (c === "work_waiting_too_long") return "Clear work waiting too long";
  if (c === "departments_no_active_coverage") return "Restore department coverage";
  return "Leadership attention";
}

function utilizationToBusinessHealth(utilization: number, blockedMembers: number, attentionItems: any[]) {
  // Deterministic, mapping-only: no intelligence recompute.
  const immediateCount = safeArray(attentionItems).filter((x: any) => String(x?.priority ?? "").toLowerCase() === "immediate").length;
  const criticalSignals = blockedMembers > 0 || immediateCount > 0 || utilization >= 80;

  let level: "excellent" | "good" | "warning" | "critical";
  if (criticalSignals) level = "critical";
  else if (utilization >= 65 || immediateCount > 0) level = "warning";
  else if (utilization >= 45) level = "good";
  else level = "excellent";

  const score = clampInt(100 - utilization, 0, 100);
  return { level, score };
}

export default function TeamExecutiveLayout() {
  const viewModel = useContext<TeamViewModel | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const members = safeArray(viewModel.members);
  const departments = safeArray(viewModel.departments);
  const workload = viewModel.workload ?? {};
  const attentionItems = safeArray(viewModel.attention?.items);
  const recommendations = safeArray(viewModel.recommendations);

  const totalCapacity = members.reduce((sum: number, m: any) => sum + Number(m?.capacity ?? 0), 0);
  const totalMembers = Number(workload?.totalMembers ?? members.length);
  const utilization = Number(workload?.utilization ?? 0);

  const blockedMembers = Number(workload?.blockedMembers ?? 0);
  const digitalEmployees = members.filter((m: any) => String(m?.memberType ?? "").toLowerCase() === "digital").length;
  const humanEmployees = members.filter((m: any) => String(m?.memberType ?? "").toLowerCase() === "human").length;

  const { level: teamHealthLevel, score: teamHealthScore } = utilizationToBusinessHealth(utilization, blockedMembers, attentionItems);

  const heroSubtitle = String(viewModel.summary ?? "").trim() || "Your workforce is operating smoothly.";
  const heroDepartmentsCount = departments.length;
  const heroUtilizationLabel = `${utilization}%`;

  const nextLeadershipMessage = (() => {
    const hasAttention = attentionItems.length > 0;
    if (hasAttention) {
      const top = attentionItems
        .slice()
        .sort((a: any, b: any) => {
          const rankFromPriority = (p: any) => {
            const s = String(p ?? "").toLowerCase();
            if (s === "immediate") return 0;
            if (s === "soon") return 1;
            return 2;
          };
          return rankFromPriority(a?.priority) - rankFromPriority(b?.priority);
        })[0];
      return `Next: ${attentionCategoryLabel(top?.category)}.`;
    }
    if (recommendations.length > 0) {
      return `Next: ${String(recommendations[0]?.label ?? "review the team dashboard")}.`;
    }
    return "Next: Keep steady coverage and review capacity as work changes.";
  })();

  const memberById = new Map(members.map((m: any) => [String(m?.id ?? ""), m]));

  return (
    <ExecutiveSurface>
      <div style={{ width: "100%", minHeight: "100vh", padding: spacing.xl }}>
        <ExecutiveStack gap="xl">
          {/* Hero */}
          <ExecutiveHeader title="Team OS" subtitle="How is my workforce performing?" />

          <ExecutiveCard>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                  Executive workforce summary
                </div>
                <div style={{ marginTop: spacing.xs, color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
                  {heroSubtitle}
                </div>
                <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                  Total team members: {String(totalMembers)}
                </div>
                <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                  Overall utilization: {heroUtilizationLabel}
                </div>
                <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                  Departments: {String(heroDepartmentsCount)}
                </div>
              </div>

              <div style={{ flex: "0 0 auto", minWidth: 360 }}>
                <BusinessHealthCard
                  title="Business Health contribution"
                  score={teamHealthScore}
                  level={teamHealthLevel}
                  summary="A deterministic view of capacity pressure and attention signals."
                />
              </div>
            </div>
          </ExecutiveCard>

          {/* Workforce Pulse */}
          <ExecutiveCard>
            <ExecutiveHeader title="Workforce Pulse" subtitle="Executive KPI strip" />
            <div style={{ marginTop: spacing.md }}>
              <ExecutiveGrid columns={3}>
                <MetricCard title="Capacity" value={totalCapacity} status="recorded" priority="Later" />
                <MetricCard title="Utilization" value={`${utilization}%`} status="recorded" priority={utilization >= 70 ? "Immediate" : utilization >= 55 ? "Soon" : "Later"} />
                <MetricCard title="Open Work" value={Number(workload?.totalPendingWork ?? 0)} status="recorded" priority="Later" />
                <MetricCard title="Blocked Work" value={blockedMembers} status="recorded" priority={blockedMembers > 0 ? "Immediate" : "Later"} />
                <MetricCard title="Digital Employees" value={digitalEmployees} status="recorded" priority="Later" />
                <MetricCard title="Human Employees" value={humanEmployees} status="recorded" priority="Later" />
              </ExecutiveGrid>
            </div>
          </ExecutiveCard>

          {/* Departments */}
          <ExecutiveCard>
            <ExecutiveHeader title="Departments" subtitle="Health, capacity, utilization, and workload" />
            <div style={{ marginTop: spacing.md }}>
              {departments.length === 0 ? (
                <div style={{ padding: spacing.lg, border: `1px dashed ${semanticColors.border}`, borderRadius: spacing.md, backgroundColor: semanticColors.surface }}>
                  <div style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight }}>
                    Your department coverage will appear as roles are configured.
                  </div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
                    In the meantime, focus on stabilizing the workforce inputs.
                  </div>
                </div>
              ) : (
                <ExecutiveGrid columns={2}>
                  {departments.map((d: any) => {
                    const deptMemberIds = safeArray(d?.members);
                    const deptCapacity = deptMemberIds.reduce((sum: number, mid: any) => sum + Number(memberById.get(String(mid))?.capacity ?? 0), 0);
                    const assigned = Number(d?.workload?.assignedWork ?? 0);
                    const pending = Number(d?.workload?.pendingWork ?? 0);
                    const completed = Number(d?.workload?.completedWork ?? 0);
                    const deptUtil = Number(d?.workload?.utilization ?? 0);
                    const deptHealth = healthLevelFromDepartmentStatus(d?.status);

                    return (
                      <ExecutiveCard key={String(d?.id ?? "")} style={{ padding: spacing.lg }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
                              {String(d?.name ?? "Department")}
                            </div>
                            <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                              {String(d?.summary ?? "")}
                            </div>
                          </div>
                          <HealthBadge level={deptHealth} />
                        </div>

                        <div style={{ marginTop: spacing.md }}>
                          <ExecutiveGrid columns={3}>
                            <MetricCard title="Capacity" value={deptCapacity} status="recorded" priority="Later" />
                            <MetricCard title="Utilization" value={`${deptUtil}%`} status="recorded" priority={deptUtil >= 70 ? "Immediate" : deptUtil >= 55 ? "Soon" : "Later"} />
                            <MetricCard
                              title="Workload"
                              value={`Assigned ${assigned} · Pending ${pending}`}
                              status={pending > 0 ? "open" : "steady"}
                              priority={pending > 0 ? "Soon" : "Later"}
                            />
                          </ExecutiveGrid>

                          <div style={{ marginTop: spacing.sm, color: semanticColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
                            Completed work: {String(completed)}
                          </div>
                        </div>
                      </ExecutiveCard>
                    );
                  })}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* People */}
          <ExecutiveCard>
            <ExecutiveHeader title="People" subtitle="Executive employee cards" />
            <div style={{ marginTop: spacing.md }}>
              {members.length === 0 ? (
                <div style={{ padding: spacing.lg, border: `1px dashed ${semanticColors.border}`, borderRadius: spacing.md, backgroundColor: semanticColors.surface }}>
                  <div style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight }}>
                    People cards will appear as capacity is measured.
                  </div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
                    Stabilize workforce coverage to unlock reliable signals.
                  </div>
                </div>
              ) : (
                <ExecutiveGrid columns={2}>
                  {members.map((m: any) => {
                    const memberHealth = healthLevelFromMember(m);
                    const attentionPriority = memberAttentionPriority(m, attentionItems);
                    const hasAttention = Boolean(m?.attentionRequired);
                    const statusPillLabel = hasAttention ? statusLabelForMember(m) : "Operating smoothly";
                    const statusPillTone = priorityToStatusTone(attentionPriority);

                    return (
                      <ExecutiveCard key={String(m?.id ?? "")} style={{ padding: spacing.lg }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: semanticColors.textPrimary, fontSize: typography.cardTitle.fontSize, lineHeight: typography.cardTitle.lineHeight, fontWeight: typography.cardTitle.fontWeight }}>
                              {String(m?.name ?? "Member")}
                            </div>
                            <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                              {String(m?.department?.name ?? "")} · {String(m?.role?.name ?? "")}
                            </div>
                          </div>
                          <HealthBadge level={memberHealth} />
                        </div>

                        <div style={{ marginTop: spacing.md, display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <StatusPill
                              tone={hasAttention ? statusPillTone : "success"}
                              label={statusPillLabel}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: spacing.md }}>
                          <ExecutiveGrid columns={2}>
                            <MetricCard
                              title="Current work"
                              value={`Assigned ${Number(m?.workload?.assignedWork ?? 0)} · Pending ${Number(m?.workload?.pendingWork ?? 0)}`}
                              status="recorded"
                              priority="Later"
                            />
                            <MetricCard title="Capacity" value={Number(m?.capacity ?? 0)} status="recorded" priority="Later" />
                            <MetricCard title="Availability" value={Number(m?.availability ?? 0)} status="recorded" priority="Later" />
                            <MetricCard title="Completed" value={Number(m?.workload?.completedWork ?? 0)} status="recorded" priority="Later" />
                          </ExecutiveGrid>
                        </div>
                      </ExecutiveCard>
                    );
                  })}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Attention */}
          <ExecutiveCard>
            <ExecutiveHeader title="Attention" subtitle="Things requiring leadership action" />
            <div style={{ marginTop: spacing.md }}>
              {attentionItems.length === 0 ? (
                <div style={{ padding: spacing.lg, border: `1px dashed ${semanticColors.border}`, borderRadius: spacing.md, backgroundColor: semanticColors.surface }}>
                  <div style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight }}>
                    Your workforce is operating smoothly.
                  </div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
                    No immediate leadership action is currently required.
                  </div>
                </div>
              ) : (
                <ExecutiveGrid columns={2}>
                  {attentionItems.slice(0, 6).map((it: any) => (
                    <InsightCard
                      key={String(it?.id ?? "")}
                      title={attentionCategoryLabel(it?.category)}
                      category={String(it?.category ?? "")}
                      importance={priorityToImportance(it?.priority)}
                      message={String(it?.summary ?? "")}
                    />
                  ))}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Recommendations */}
          <ExecutiveCard>
            <ExecutiveHeader title="Recommendations" subtitle="Executive recommendations" />
            <div style={{ marginTop: spacing.md }}>
              {recommendations.length === 0 ? (
                <div style={{ padding: spacing.lg, border: `1px dashed ${semanticColors.border}`, borderRadius: spacing.md, backgroundColor: semanticColors.surface }}>
                  <div style={{ color: semanticColors.textPrimary, fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight }}>
                    No recommendations are currently pending.
                  </div>
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight }}>
                    Keep operating smoothly and monitor workforce signals.
                  </div>
                </div>
              ) : (
                <ExecutiveGrid columns={2}>
                  {recommendations.slice(0, 6).map((r: any) => (
                    <RecommendationCard
                      key={String(r?.id ?? "")}
                      title={String(r?.label ?? "Recommendation")}
                      actionType={`${String(r?.type ?? "")} · ${String(r?.target ?? "")}`}
                      priority={priorityToRecommendationNumber(r?.priority)}
                      recommendation={
                        Boolean(r?.disabled)
                          ? "Temporarily disabled until prerequisites are resolved."
                          : "Ready to execute when leadership confirms this action."
                      }
                    />
                  ))}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Bottom Summary */}
          <ExecutiveCard>
            <ExecutiveHeader title="Bottom Summary" subtitle="What should leadership do next?" />
            <div style={{ marginTop: spacing.md, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
              {nextLeadershipMessage}
            </div>
          </ExecutiveCard>
        </ExecutiveStack>
      </div>
    </ExecutiveSurface>
  );
}

