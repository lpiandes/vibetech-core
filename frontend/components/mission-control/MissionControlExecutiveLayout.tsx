"use client";

import { useContext } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";

import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveSurface from "@/components/executive/ExecutiveSurface";
import ExecutiveDivider from "@/components/executive/ExecutiveDivider";
import MetricCard from "@/components/executive/MetricCard";
import BusinessHealthCard from "@/components/executive/BusinessHealthCard";
import InsightCard from "@/components/executive/InsightCard";
import RecommendationCard from "@/components/executive/RecommendationCard";
import ExecutiveEmptyState from "@/components/executive/ExecutiveEmptyState";
import StatusPill from "@/components/executive/StatusPill";

import CommandCenterExecutiveSections from "./CommandCenterExecutiveSections";
import DemoStoryMode from "./DemoStoryMode";

import { semanticColors, spacing } from "@/design/tokens";

function safeArray(v: any) {
  return Array.isArray(v) ? v : [];
}

function priorityRank(p: string) {
  const s = String(p ?? "").toLowerCase();
  if (s === "immediate") return 0;
  if (s === "soon") return 1;
  return 2;
}

function healthLevelFromHeroStatus(status: string) {
  const s = String(status ?? "");
  if (s === "success") return "good";
  if (s === "warning") return "warning";
  if (s === "danger") return "critical";
  return "warning";
}

function trendArrow(trend: string | null) {
  const t = String(trend ?? "").toLowerCase();
  if (t.includes("improv")) return <ArrowUp style={{ width: spacing.md, height: spacing.md }} />;
  if (t.includes("declin") || t.includes("down")) return <ArrowDown style={{ width: spacing.md, height: spacing.md }} />;
  if (t.includes("stable")) return <Minus style={{ width: spacing.md, height: spacing.md }} />;
  return <Minus style={{ width: spacing.md, height: spacing.md }} />;
}

function trendLabel(trend: string | null) {
  const t = String(trend ?? "");
  if (!t) return "unknown";
  const lt = t.toLowerCase();
  if (lt.includes("improv")) return "improving";
  if (lt.includes("declin") || lt.includes("down")) return "declining";
  if (lt.includes("stable")) return "stable";
  return "unknown";
}

function findCard(viewModel: MissionControlViewModel, id: string) {
  return safeArray(viewModel.cards).find((c: any) => String(c.id) === String(id)) ?? null;
}

function firstCardActionId(card: any) {
  const acts = safeArray(card?.actions);
  if (acts.length === 0) return null;
  return String(acts[0]);
}

function actionTypeFromActionId(actionId: string | null | undefined) {
  const id = String(actionId ?? "");
  if (!id) return "review_work_queue";
  return id;
}

function importanceFromPriority(priority: string | null | undefined) {
  const r = priorityRank(String(priority ?? "later"));
  // Executive naming: high/medium/low
  if (r === 0) return "high";
  if (r === 1) return "medium";
  return "low";
}

function priorityLabel(priority: string | null | undefined) {
  if (String(priority ?? "") === "immediate") return "Immediate";
  if (String(priority ?? "") === "soon") return "Soon";
  return "Later";
}

function priorityNumberFromCardPriority(priority: string | null | undefined) {
  const tier = priorityRank(String(priority ?? "later"));
  if (tier === 0) return 90;
  if (tier === 1) return 70;
  return 40;
}

export default function MissionControlExecutiveLayout() {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  const hero = viewModel.hero ?? {};

  const companyHealthCard = findCard(viewModel, "card_company_health");
  const workQueueCard = findCard(viewModel, "card_work_queue");
  const recentActivityCard = findCard(viewModel, "card_recent_activity");
  const teamCard = findCard(viewModel, "card_digital_workforce");
  const capabilityCard = findCard(viewModel, "card_knowledge");
  const analyticsCard = findCard(viewModel, "card_connected_systems");
  const topRecommendationCard = findCard(viewModel, "card_top_recommendation");

  // Inputs for each executive layout segment.
  const heroHealthLevel = healthLevelFromHeroStatus(String(hero?.status ?? ""));
  const heroScore =
    typeof companyHealthCard?.metric === "number"
      ? companyHealthCard.metric
      : typeof hero?.score === "number"
        ? hero.score
        : null;

  const heroTrend = companyHealthCard?.trend ?? null;
  const heroPrimaryActionId = firstCardActionId(topRecommendationCard) ?? String(hero?.primaryAction ?? "");

  const heroPrimaryActionLabel = heroPrimaryActionId ? String(viewModel.actions?.find((a: any) => String(a.id) === heroPrimaryActionId)?.label ?? heroPrimaryActionId) : "";

  const secondaryActionLabels = safeArray(viewModel.hero?.secondaryActions)
    .map((labelOrActionId: any) => {
      const id = String(labelOrActionId ?? "");
      return String(viewModel.actions?.find((a: any) => String(a.id) === id)?.label ?? labelOrActionId ?? "");
    })
    .filter(Boolean)
    .slice(0, 2);

  const recommendationCards = safeArray(viewModel.sections)
    .filter((s: any) => ["section_recommendations", "section_decisions_waiting", "section_opportunities"].includes(String(s.id)))
    .flatMap((s: any) => safeArray(s.cards))
    .map((cid: any) => findCard(viewModel, String(cid)))
    .filter(Boolean)
    .slice(0, 6) as any[];

  const orderedRecs = recommendationCards
    .slice()
    .sort((a: any, b: any) => priorityRank(String(a?.priority ?? "later")) - priorityRank(String(b?.priority ?? "later")) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 4);

  const insightCards = safeArray(viewModel.sections)
    .filter((s: any) => ["section_risks", "section_opportunities"].includes(String(s.id)))
    .flatMap((s: any) => safeArray(s.cards))
    .map((cid: any) => findCard(viewModel, String(cid)))
    .filter(Boolean)
    .slice(0, 4) as any[];

  const timelineCards = [
    { kind: "recent", card: recentActivityCard },
    ...safeArray(viewModel.sections)
      .filter((s: any) => ["section_risks", "section_opportunities", "section_work_queue", "section_decisions_waiting"].includes(String(s.id)) || String(s.title).toLowerCase().includes("risk"))
      .flatMap((s: any) => safeArray(s.cards))
      .map((cid: any) => findCard(viewModel, String(cid)))
      .filter(Boolean),
    ...safeArray(viewModel.alerts).map((a: any) => ({
      kind: "alert",
      card: {
        id: String(a.id ?? "alert"),
        title: String(a.title ?? "Alert"),
        subtitle: String(a.summary ?? ""),
        priority: String(a.priority ?? "later"),
      },
    })),
    { kind: "workQueue", card: workQueueCard },
  ]
    .map((x: any) => x.card)
    .filter(Boolean) as any[];

  const nonEmptyTimeline = timelineCards.length > 0;

  const bottomSummary = heroPrimaryActionLabel
    ? `Your next move: ${heroPrimaryActionLabel}.`
    : "Your next move: review what requires attention first.";

  const stripStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: spacing.sm,
  } as const;

  const commandCenterTitle =
    viewModel?.productContext?.pageLabels?.commandCenter ??
    viewModel?.commandCenter?.pageTitle ??
    "Command Center";
  const showDemoStory = viewModel?.productContext?.identity?.workspaceId === "ws_horizon_properties";

  return (
    <ExecutiveSurface>
      <div style={{ width: "100%", padding: spacing.xl }}>
        <ExecutiveStack gap="xl">
          <ExecutiveHeader
            title={commandCenterTitle}
            subtitle={String(viewModel?.hero?.summary ?? hero?.subtitle ?? viewModel.subheadline ?? "")}
          />

          <CommandCenterExecutiveSections viewModel={viewModel} />

          <ExecutiveDivider />

          <ExecutiveHeader
            title="Business Intelligence"
            subtitle="Deeper signals and recommendations"
          />
          <ExecutiveCard>
            <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-start" }}>
              <div style={{ width: "100%", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                  <StatusPill
                    label={heroHealthLevel === "good" ? "Operationally Sound" : heroHealthLevel === "warning" ? "Needs Attention" : "Critical Attention"}
                    tone={heroHealthLevel === "good" ? "success" : heroHealthLevel === "warning" ? "warning" : "danger"}
                  />
                  <div style={{ fontSize: "0.875rem", color: semanticColors.textSecondary }}>
                    {String(hero?.title ?? viewModel.headline ?? "")}
                  </div>
                </div>

                <div style={{ fontSize: typographyDisplaySize(), color: semanticColors.textPrimary, marginTop: spacing.xs }}>
                  Business Health
                </div>

                <div style={{ display: "flex", gap: spacing.md, alignItems: "center", marginTop: spacing.sm }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <BusinessHealthCard
                      title="Business Health"
                      score={heroScore ?? 0}
                      level={heroHealthLevel}
                      summary={String(companyHealthCard?.summary ?? companyHealthCard?.subtitle ?? "")}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                    <div style={{ color: semanticColors.textSecondary, fontSize: "0.875rem" }}>Trend:</div>
                    {trendArrow(heroTrend)}
                    <div style={{ color: semanticColors.textPrimary, fontSize: "0.875rem" }}>{trendLabel(heroTrend)}</div>
                  </div>
                </div>

                <ExecutiveDivider />

                <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ color: semanticColors.textSecondary, lineHeight: 1.4, fontSize: "0.95rem", maxWidth: 680 }}>
                    {String(viewModel.subheadline ?? "")}
                  </div>

                  <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: spacing.sm, minWidth: 220 }}>
                    <div style={{ fontSize: "0.75rem", letterSpacing: "0.02em", color: semanticColors.textMuted }}>
                      Primary recommendation
                    </div>
                    <RecommendationCard
                      title={String(topRecommendationCard?.subtitle ?? topRecommendationCard?.title ?? "Recommendation")}
                      actionType={actionTypeFromActionId(heroPrimaryActionId)}
                      priority={priorityNumberFromCardPriority(String(topRecommendationCard?.priority ?? "later"))}
                      recommendation={String(heroPrimaryActionLabel || topRecommendationCard?.body || "")}
                    />

                    {secondaryActionLabels.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
                        {secondaryActionLabels.map((lbl: any) => (
                          <MetricCard
                            key={String(lbl)}
                            title={String(lbl)}
                            value={0}
                            status="open"
                            priority="Later"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </ExecutiveCard>

          {/* Business Pulse */}
          <div>
            <ExecutiveHeader title="Business Pulse" subtitle="Key signals at a glance" />
            <div style={{ marginTop: spacing.md }}>
              <div style={stripStyle}>
                <div>
                  {companyHealthCard ? (
                    <BusinessHealthCard
                      title="Business Health"
                      score={heroScore ?? 0}
                      level={heroHealthLevel}
                      summary={String(companyHealthCard?.summary ?? companyHealthCard?.subtitle ?? "")}
                    />
                  ) : (
                    <ExecutiveEmptyState title="Health" message="Health will appear as operations run." />
                  )}
                </div>

                <div>
                  {workQueueCard ? (
                    <MetricCard
                      title="Workload"
                      value={typeof workQueueCard.metric === "number" ? workQueueCard.metric : String(workQueueCard.subtitle ?? "")}
                      badge={workQueueCard.badge ? String(workQueueCard.badge) : undefined}
                      status={String(workQueueCard.status ?? "open")}
                      priority={priorityLabel(workQueueCard.priority)}
                    />
                  ) : (
                    <ExecutiveEmptyState title="Workload" message="Workload signals will appear as the queue updates." />
                  )}
                </div>

                <div>
                  {recentActivityCard ? (
                    <MetricCard
                      title="Requests"
                      value={typeof recentActivityCard.metric === "number" ? recentActivityCard.metric : String(recentActivityCard.subtitle ?? "")}
                      badge={recentActivityCard.badge ? String(recentActivityCard.badge) : undefined}
                      status="open"
                      priority="Later"
                    />
                  ) : (
                    <ExecutiveEmptyState title="Requests" message="Request signals will appear as requests arrive." />
                  )}
                </div>

                <div>
                  <MetricCard
                    title="Communications"
                    value={typeof topRecommendationCard?.metric === "number" ? topRecommendationCard.metric : String(topRecommendationCard?.subtitle ?? "")}
                    badge={topRecommendationCard?.badge ? String(topRecommendationCard.badge) : undefined}
                    status="open"
                    priority={priorityLabel(topRecommendationCard?.priority)}
                  />
                </div>

                <div>
                  <MetricCard
                    title="Team"
                    value={typeof teamCard?.metric === "number" ? teamCard.metric : String(teamCard?.subtitle ?? "")}
                    badge={teamCard?.badge ? String(teamCard.badge) : undefined}
                    status={String(teamCard?.status ?? "open")}
                    priority={priorityLabel(teamCard?.priority)}
                  />
                </div>

                <div>
                  <MetricCard
                    title="Capability"
                    value={typeof capabilityCard?.metric === "number" ? capabilityCard.metric : String(capabilityCard?.subtitle ?? "")}
                    badge={capabilityCard?.badge ? String(capabilityCard.badge) : undefined}
                    status={String(capabilityCard?.status ?? "open")}
                    priority={priorityLabel(capabilityCard?.priority)}
                  />
                </div>

                <div>
                  <MetricCard
                    title="Analytics"
                    value={typeof analyticsCard?.metric === "number" ? analyticsCard.metric : String(analyticsCard?.subtitle ?? "")}
                    badge={analyticsCard?.badge ? String(analyticsCard.badge) : undefined}
                    status={String(analyticsCard?.status ?? "open")}
                    priority={priorityLabel(analyticsCard?.priority)}
                  />
                </div>
              </div>
            </div>
          </div>

          <ExecutiveDivider />

          <ExecutiveStack gap="xl">
            {/* Today's Priorities */}
            <div>
              <ExecutiveHeader title="Today's Priorities" subtitle="Recommendations ordered by importance" />
              <div style={{ marginTop: spacing.md, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing.md }}>
                {orderedRecs.length > 0 ? (
                  orderedRecs.map((c: any) => (
                    <RecommendationCard
                      key={String(c.id)}
                      title={String(c.title ?? "Recommendation")}
                      actionType={actionTypeFromActionId(firstCardActionId(c))}
                      priority={priorityNumberFromCardPriority(String(c.priority ?? "later"))}
                      recommendation={String(c.subtitle ?? c.body ?? "")}
                    />
                  ))
                ) : (
                  <ExecutiveEmptyState title="Priorities" message="No priorities require attention today." />
                )}
              </div>
            </div>

            {/* Business Timeline */}
            <div>
              <ExecutiveHeader title="Business Timeline" subtitle="Recent activity and attention items" />
              <div style={{ marginTop: spacing.md }}>
                {nonEmptyTimeline ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: spacing.sm }}>
                    {timelineCards.slice(0, 6).map((c: any, idx: number) => (
                      <ExecutiveCard key={String(c.id)} style={{ padding: spacing.md }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                              <div style={{ fontSize: "0.875rem", color: semanticColors.textPrimary, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {String(c.title ?? "Item")}
                              </div>
                            </div>
                            <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: "0.875rem" }}>
                              {String(c.subtitle ?? c.body ?? "")}
                            </div>
                          </div>
                          <StatusPill
                            label={priorityLabel(c.priority)}
                            tone={c.priority === "immediate" ? "danger" : c.priority === "soon" ? "warning" : "success"}
                          />
                        </div>
                      </ExecutiveCard>
                    ))}
                  </div>
                ) : (
                  <ExecutiveEmptyState title="Timeline" message="Performance data will appear as the business operates." />
                )}
              </div>
            </div>

            {/* Insights + Recommendations side-by-side */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: spacing.xl }}>
              <div>
                <ExecutiveHeader title="Insights" subtitle="Executive observations to review" />
                <div style={{ marginTop: spacing.md, display: "grid", gridTemplateColumns: "1fr", gap: spacing.md }}>
                  {insightCards.length > 0 ? (
                    insightCards.map((c: any) => (
                      <InsightCard
                        key={String(c.id)}
                        title={String(c.title ?? "Insight")}
                        category={String(c.source ?? "insight")}
                        importance={importanceFromPriority(String(c.priority ?? "later"))}
                        message={String(c.body ?? c.summary ?? c.subtitle ?? "")}
                      />
                    ))
                  ) : (
                    <ExecutiveEmptyState title="Insights" message="No analytics insights require attention." />
                  )}
                </div>
              </div>

              <div>
                <ExecutiveHeader title="Recommendations" subtitle="Action cards" />
                <div style={{ marginTop: spacing.md, display: "grid", gridTemplateColumns: "1fr", gap: spacing.md }}>
                  {orderedRecs.length > 0 ? (
                    orderedRecs.map((c: any) => (
                      <RecommendationCard
                        key={String(c.id) + "_rec"}
                        title={String(c.title ?? "Recommendation")}
                        actionType={actionTypeFromActionId(firstCardActionId(c))}
                        priority={priorityNumberFromCardPriority(String(c.priority ?? "later"))}
                        recommendation={String(c.body ?? c.subtitle ?? "")}
                      />
                    ))
                  ) : (
                    <ExecutiveEmptyState title="Recommendations" message="No recommendations at this time." />
                  )}
                </div>
              </div>
            </div>
          </ExecutiveStack>

          <ExecutiveDivider />

          {/* Bottom Summary */}
          <div>
            <ExecutiveHeader title="Next Focus" subtitle="What should I focus on next?" />
            <ExecutiveCard>
              <div style={{ color: semanticColors.textSecondary, lineHeight: 1.5 }}>{bottomSummary}</div>
            </ExecutiveCard>
          </div>
        </ExecutiveStack>
      </div>
      <DemoStoryMode enabled={showDemoStory} steps={safeArray((viewModel as any).demoStorySteps)} />
    </ExecutiveSurface>
  );
}

function typographyDisplaySize() {
  // Executive typography is token-driven; this is used only for consistent scale.
  return "1.25rem";
}

