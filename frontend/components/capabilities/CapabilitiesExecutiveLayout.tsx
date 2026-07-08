"use client";

import { useContext } from "react";

import type { CapabilityViewModel } from "./CapabilityContext";
import { CapabilityViewModelContext } from "./CapabilityContext";

import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveGrid from "@/components/executive/ExecutiveGrid";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";

import MetricCard from "@/components/executive/MetricCard";
import BusinessHealthCard from "@/components/executive/BusinessHealthCard";
import HealthBadge, { type HealthLevel } from "@/components/executive/HealthBadge";
import StatusPill from "@/components/executive/StatusPill";
import InsightCard from "@/components/executive/InsightCard";
import RecommendationCard from "@/components/executive/RecommendationCard";

import { semanticColors, spacing, typography } from "@/design/tokens";

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function readinessLevelFromScore(score: number): HealthLevel {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function priorityTierFromNumber(priority: number) {
  const p = Number(priority ?? 0);
  if (p >= 80) return { label: "Immediate", tone: "danger" as const };
  if (p >= 50) return { label: "Soon", tone: "warning" as const };
  return { label: "Later", tone: "neutral" as const };
}

function healthLevelFromCategoryStatus(status: string): HealthLevel {
  const s = String(status ?? "").toLowerCase();
  if (s === "fully_covered") return "excellent";
  if (s === "partially_covered") return "good";
  if (s === "missing") return "critical";
  if (s === "unknown") return "warning";
  return "warning";
}

function importanceFromSeverity(severity: number): Parameters<typeof InsightCard>[0]["importance"] {
  const s = Number(severity ?? 0);
  if (s >= 70) return "high";
  if (s >= 40) return "medium";
  return "low";
}

function findBestRecommendationForCapability(recommendations: any[], capabilityId: string) {
  const capId = String(capabilityId ?? "");
  const matches = safeArray(recommendations).filter((r: any) => safeArray(r?.relatedCapabilityIds).includes(capId));
  const sorted = matches.slice().sort((a: any, b: any) => Number(b?.priority ?? 0) - Number(a?.priority ?? 0));
  return sorted[0] ?? null;
}

export default function CapabilitiesExecutiveLayout() {
  const viewModel = useContext<CapabilityViewModel | null>(CapabilityViewModelContext);
  if (!viewModel) return null;

  const vm: any = viewModel;
  const metrics = vm?.metrics ?? {};
  const overallReadiness = Number(metrics?.overallReadiness ?? vm?.overallReadiness ?? 0);
  const coverageScore = Number(metrics?.coverageScore ?? vm?.coverage?.coverageScore ?? 0);
  const gapCount = Number(metrics?.gapCount ?? 0);
  const riskCount = Number(metrics?.riskCount ?? 0);
  const recommendationCount = Number(metrics?.recommendationCount ?? 0);

  const categories = safeArray(vm?.categories);
  const providers = safeArray(vm?.providers);
  const gaps = safeArray(vm?.gaps);
  const risks = safeArray(vm?.risks);
  const recommendations = safeArray(vm?.recommendations);

  const strengthsCount = categories.filter((c: any) => String(c?.status ?? "") === "fully_covered").length;

  const readinessLevel = readinessLevelFromScore(overallReadiness);
  const heroStatus =
    readinessLevel === "excellent"
      ? { label: "Business execution is strong", tone: "success" as const }
      : readinessLevel === "good"
        ? { label: "Execution is mostly on track", tone: "info" as const }
        : readinessLevel === "warning"
          ? { label: "Execution needs focus", tone: "warning" as const }
          : { label: "Execution is at risk", tone: "danger" as const };

  const heroSubtitle = String(vm?.summary ?? "").trim() || "Executive capability summary. Coverage and gaps update deterministically as reports arrive.";

  const coverageValue = `${coverageScore}%`;
  const strategyCoveredValue = `${Number(metrics?.totalCoveredCapabilities ?? 0)}/${Number(metrics?.totalRequiredCapabilities ?? 0)}`;

  const strengths = categories.filter((c: any) => String(c?.status ?? "") === "fully_covered").slice(0, 4);
  const criticalGaps = gaps.slice(0, 4);
  const categoryCards = categories.slice(0, 6);

  const sortedRisks = risks.slice().sort((a: any, b: any) => Number(b?.severity ?? 0) - Number(a?.severity ?? 0)).slice(0, 4);
  const sortedRecommendations = recommendations.slice().sort((a: any, b: any) => Number(b?.priority ?? 0) - Number(a?.priority ?? 0));

  return (
    <ExecutiveSurface>
      <div style={{ width: "100%", minHeight: "100vh", padding: spacing.xl }}>
        <ExecutiveStack gap="xl">
          <ExecutiveHeader title="Capabilities OS" subtitle="Can this business execute its strategy?" />

          {/* Hero */}
          <ExecutiveCard style={{ padding: spacing.lg }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <StatusPill label={heroStatus.label} tone={heroStatus.tone} />
                  <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                    Executive capability summary
                  </div>
                </div>

                <div style={{ marginTop: spacing.sm, color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
                  {heroSubtitle}
                </div>

                <div style={{ marginTop: spacing.md, display: "flex", flexWrap: "wrap", gap: spacing.md }}>
                  <MetricCard title="Coverage" value={coverageValue} badge={String(metrics?.coverageSummary ?? vm?.coverage?.coverageSummary ?? "") || undefined} status="recorded" priority={coverageScore >= 80 ? "Later" : "Immediate"} />
                  <MetricCard title="Critical Gaps" value={gapCount} status="recorded" priority={gapCount > 0 ? "Immediate" : "Later"} />
                  <MetricCard title="Business Readiness" value={overallReadiness} badge={`${overallReadiness}% ready`} status="recorded" priority={readinessLevel === "excellent" ? "Later" : "Soon"} />
                </div>
              </div>

              <div style={{ flex: "0 0 auto", minWidth: 360 }}>
                <BusinessHealthCard title="Capability Readiness" score={overallReadiness} level={readinessLevel} summary="Readiness score derived from recorded coverage, gaps, and risk." />
              </div>
            </div>
          </ExecutiveCard>

          {/* Capability Pulse */}
          <ExecutiveCard>
            <ExecutiveHeader title="Capability Pulse" subtitle="Executive KPI strip" />
            <div style={{ marginTop: spacing.md }}>
              <ExecutiveGrid columns={3}>
                <MetricCard title="Capabilities" value={strategyCoveredValue} status="recorded" priority={Number(metrics?.totalCoveredCapabilities ?? 0) > 0 ? "Later" : "Immediate"} />
                <MetricCard title="Providers" value={providers.length} status="recorded" priority={providers.length > 0 ? "Later" : "Immediate"} />
                <MetricCard title="Coverage" value={coverageValue} status="recorded" priority={coverageScore >= 80 ? "Later" : "Soon"} />
                <MetricCard title="Strengths" value={strengthsCount} status="recorded" priority={strengthsCount > 0 ? "Later" : "Soon"} />
                <MetricCard title="Risks" value={riskCount} status="recorded" priority={riskCount > 0 ? "Immediate" : "Later"} />
                <MetricCard title="Recommendations" value={recommendationCount} status="recorded" priority={recommendationCount > 0 ? "Soon" : "Later"} />
              </ExecutiveGrid>
            </div>
          </ExecutiveCard>

          {/* Capability Areas */}
          <ExecutiveCard>
            <ExecutiveHeader title="Capability Areas" subtitle="Category, coverage, health, providers, and attention" />
            <div style={{ marginTop: spacing.md }}>
              {categoryCards.length === 0 ? (
                <ExecutiveEmptyState title="Business capabilities are well balanced." message="No capability categories require executive attention in this report." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {categoryCards.map((c: any) => {
                    const status = String(c?.status ?? "unknown");
                    const health = healthLevelFromCategoryStatus(status);
                    const attentionTone = health === "excellent" ? "success" : health === "good" ? "info" : health === "warning" ? "warning" : "danger";
                    const attentionLabel = health === "excellent" ? "No attention required" : "Attention required";
                    const providersSummary = providers.length > 0 ? `${providers.length} provider type(s)` : "Providers not recorded";

                    return (
                      <ExecutiveCard key={String(c?.id ?? c?.name ?? "")} style={{ padding: spacing.lg }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                            <HealthBadge level={health} />
                            <div style={{ color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
                              Category: {String(c?.name ?? "—")}
                            </div>
                          </div>
                          <StatusPill tone={attentionTone as any} label={attentionLabel} />
                        </div>

                        <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.xs }}>
                          <div style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                            Coverage: {String(c?.summary ?? "—")}
                          </div>
                          <div style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                            Providers: {providersSummary}
                          </div>
                          <div style={{ color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                            Attention: {status.replaceAll("_", " ")}
                          </div>
                        </div>
                      </ExecutiveCard>
                    );
                  })}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Critical Gaps */}
          <ExecutiveCard>
            <ExecutiveHeader title="Critical Gaps" subtitle="Priority, business impact, and recommendation" />
            <div style={{ marginTop: spacing.md }}>
              {criticalGaps.length === 0 ? (
                <ExecutiveEmptyState title="No capability gaps require executive attention." message="Business capabilities are well balanced." />
              ) : (
                <ExecutiveStack gap="md">
                  {criticalGaps.map((g: any) => {
                    const capId = String(g?.capabilityId ?? "");
                    const best = findBestRecommendationForCapability(recommendations, capId);
                    const tier = priorityTierFromNumber(Number(best?.priority ?? 0));
                    const recommendationText = String(best?.description ?? best?.type ?? "—");

                    return (
                      <ExecutiveCard key={String(g?.id ?? capId)} style={{ padding: spacing.lg }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                              <StatusPill tone={tier.tone} label={`Priority: ${tier.label}`} />
                              <HealthBadge level="warning" />
                            </div>

                            <div style={{ marginTop: spacing.sm, color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
                              {String(g?.name ?? "Capability gap")}
                            </div>
                            <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                              Business impact: {String(g?.reason ?? "—")}
                            </div>
                          </div>

                          <div style={{ flex: "0 0 auto", maxWidth: 360 }}>
                            <div style={{ color: semanticColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                              Recommendation
                            </div>
                            <div
                              style={{
                                marginTop: spacing.sm,
                                padding: `${spacing.xs} ${spacing.sm}`,
                                border: `1px solid ${semanticColors.border}`,
                                borderRadius: 9999,
                                color: semanticColors.textPrimary,
                                backgroundColor: semanticColors.surface,
                                fontSize: typography.caption.fontSize,
                                lineHeight: typography.caption.lineHeight,
                                fontWeight: typography.caption.fontWeight,
                              }}
                            >
                              {recommendationText}
                            </div>
                          </div>
                        </div>
                      </ExecutiveCard>
                    );
                  })}
                </ExecutiveStack>
              )}
            </div>
          </ExecutiveCard>

          {/* Strengths */}
          <ExecutiveCard>
            <ExecutiveHeader title="Strengths" subtitle="Areas where the business is exceptional" />
            <div style={{ marginTop: spacing.md }}>
              {strengths.length === 0 ? (
                <ExecutiveEmptyState title="Business capabilities are well balanced." message="No exceptional capability strengths require prioritization today." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {strengths.map((c: any) => (
                    <ExecutiveCard key={String(c?.id ?? c?.name ?? "")} style={{ padding: spacing.lg }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
                        <div>
                          <div style={{ color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
                            {String(c?.name ?? "—")}
                          </div>
                          <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
                            Coverage: {String(c?.summary ?? "—")}
                          </div>
                        </div>
                        <HealthBadge level="excellent" />
                      </div>
                    </ExecutiveCard>
                  ))}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Capability Risks */}
          <ExecutiveCard>
            <ExecutiveHeader title="Capability Risks" subtitle="Signals that warrant leadership action" />
            <div style={{ marginTop: spacing.md }}>
              {sortedRisks.length === 0 ? (
                <ExecutiveEmptyState title="No capability risks require executive attention." message="Your capability coverage is steady." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {sortedRisks.map((r: any) => (
                    <InsightCard
                      key={String(r?.id ?? "")}
                      title={String(r?.type ?? "Risk")}
                      category={r?.providerType ? String(r.providerType) : "capability"}
                      message={String(r?.message ?? "")}
                      importance={importanceFromSeverity(Number(r?.severity ?? 0))}
                    />
                  ))}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Recommendations */}
          <ExecutiveCard>
            <ExecutiveHeader title="Recommendations" subtitle="Executive actions to invest in next" />
            <div style={{ marginTop: spacing.md }}>
              {sortedRecommendations.length === 0 ? (
                <ExecutiveEmptyState title="No recommendations require executive action." message="Your strategy execution signals are stable." />
              ) : (
                <ExecutiveGrid columns={2}>
                  {sortedRecommendations.slice(0, 4).map((rec: any) => (
                    <RecommendationCard
                      key={String(rec?.id ?? rec?.type ?? "")}
                      title={String(rec?.type ?? "Recommendation")}
                      actionType={String(rec?.type ?? "invest")}
                      priority={Number(rec?.priority ?? 0)}
                      recommendation={String(rec?.description ?? "")}
                    />
                  ))}
                </ExecutiveGrid>
              )}
            </div>
          </ExecutiveCard>

          {/* Bottom Summary */}
          <ExecutiveCard>
            <ExecutiveHeader title="What capabilities should we invest in next?" subtitle={`Decisions-first view based on recorded capability facts.`} />
            <div style={{ marginTop: spacing.sm, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
              This view is deterministic: it renders exactly from `CapabilityViewModel` facts—no runtime access, no intelligence recompute.
            </div>
          </ExecutiveCard>
        </ExecutiveStack>
      </div>
    </ExecutiveSurface>
  );
}
