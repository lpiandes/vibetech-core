"use client";

import { useContext } from "react";
import Link from "next/link";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import DemoStoryMode from "@/components/mission-control/DemoStoryMode";
import OperatingHeader, { OperatingSection } from "@/components/operating/OperatingHeader";
import DecisionCard, { SituationCard, OutcomeCard } from "@/components/operating/DecisionCard";
import AskVibeTechPrompt from "@/components/operating/AskVibeTechPrompt";
import OperatingActivityFeed from "@/components/operating/OperatingActivityFeed";
import EmployeeWorkerCard from "@/components/team/EmployeeWorkerCard";
import GlobalAskVibeTechEntry from "@/components/shell/GlobalAskVibeTechEntry";
import { EmptyState, ActionButton } from "@/components/operating/Surface";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { scrubInternalWording } from "@/lib/operating/businessLanguage";

/**
 * Home — premium operating center for a living business.
 * Story order: greeting → today → waiting on you → working now → ask → memory → overview.
 */
export default function OperatingHomeExperience() {
  const viewModel = useContext(MissionControlViewModelContext) as any;
  const experience = viewModel?.experience ?? null;
  const supervision = experience?.supervision ?? viewModel?.supervision ?? null;
  const scope = useOptionalBusinessScope();
  const base = scope?.businessId ? `/b/${scope.businessId}` : "";
  const showDemo = Array.isArray(viewModel?.demoStorySteps) && viewModel.demoStorySteps.length > 0;

  if (!experience || !supervision?.available) {
    return (
      <EmptyState
        title="Your business is getting ready"
        description="VIBETech is gathering live signals. Refresh in a moment, or ask what to do next."
        action={scope?.businessId ? <GlobalAskVibeTechEntry /> : null}
      />
    );
  }

  const decisions = supervision.needsDecision;
  const workingNow = supervision.workingNow ?? [];
  const workforce = supervision.digitalWorkforce ?? [];
  const outcomes = supervision.recentOutcomes ?? [];
  const overview = supervision.businessOverview ?? [];
  const recentActivity = supervision.recentActivity ?? [];
  const todayOutcomes = outcomes.slice(0, 6);

  return (
    <div
      style={{
        display: "grid",
        gap: 0,
        paddingBottom: spacing["3xl"],
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <OperatingHeader
        title={supervision.greeting?.headline ?? "Welcome."}
        summary={
          scrubInternalWording(supervision.operatingSummary?.headline)
          + (supervision.operatingSummary?.detail
            ? ` ${scrubInternalWording(supervision.operatingSummary.detail)}`
            : "")
        }
      />

      {showDemo ? <DemoStoryMode /> : null}

      {/* Today VIBETech */}
      <OperatingSection id="today-heading" title="Today with VIBETech" description="What was handled from recorded outcomes." quiet>
        {todayOutcomes.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>
            Nothing completed yet today. As work finishes, it will appear here.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {todayOutcomes.map((item: any) => (
              <OutcomeCard
                key={item.id}
                title={item.title}
                result={item.result}
                meta={item.who}
              />
            ))}
          </ul>
        )}
      </OperatingSection>

      {/* Waiting on You */}
      <OperatingSection
        id="waiting-heading"
        title="Waiting on you"
        description="Only decisions that need your judgment."
        action={
          decisions.viewAllHref ? (
            <Link href={decisions.viewAllHref} style={linkStyle}>View all</Link>
          ) : null
        }
      >
        {decisions.items.length === 0 ? (
          <div style={{ display: "grid", gap: spacing.xs }}>
            <p style={{ margin: 0, fontWeight: 600, color: cockpitColors.textPrimary }}>
              {decisions.emptyTitle}
            </p>
            <p style={{ margin: 0, color: cockpitColors.textMuted }}>{decisions.emptyDetail}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: spacing.md }}>
            {decisions.items.map((item: any) => (
              <DecisionCard
                key={item.id}
                title={item.title}
                why={item.why}
                impact={item.proposedAction ? `Recommended: ${item.proposedAction}` : null}
                timeHint={item.ageOrDue}
                evidence={item.evidenceSummary}
                priority={item.priority}
                actions={(item.actions ?? []).slice(0, 2)}
                askHref={item.askHref}
              />
            ))}
          </div>
        )}
      </OperatingSection>

      {/* Working right now */}
      <OperatingSection
        id="working-heading"
        title="Working right now"
        description="Live situations VIBETech and your team are moving."
        action={
          base ? <Link href={`${base}/work`} style={linkStyle}>Open Work</Link> : null
        }
      >
        {workingNow.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>
            No active situations right now. Ask VIBETech what to prioritize next.
          </p>
        ) : (
          <div>
            {workingNow.map((episode: any) => (
              <SituationCard
                key={episode.id}
                title={episode.title}
                responsible={episode.responsible}
                current={episode.currentStep}
                next={episode.nextStep}
                related={episode.relatedLabel}
                href={episode.openWorkHref}
                steps={episode.completedSteps}
              />
            ))}
          </div>
        )}
      </OperatingSection>

      {/* Ask VIBETech — primary conversational action */}
      <OperatingSection
        id="ask-heading"
        title="Ask VIBETech"
        description="Talk about your business, or change how work runs."
      >
        {scope?.businessId ? (
          <AskVibeTechPrompt businessId={scope.businessId} large showSuggestions />
        ) : null}
      </OperatingSection>

      {/* Team */}
      <OperatingSection
        id="team-heading"
        title="Your team"
        description="People and AI teammates currently accountable."
        action={
          base ? <Link href={`${base}/team`} style={linkStyle}>Open team</Link> : null
        }
      >
        {workforce.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>
            No teammates reporting yet. Invite your team or ask VIBETech to prepare AI teammates.
          </p>
        ) : (
          <div>
            {workforce.map((emp: any) => (
              <EmployeeWorkerCard
                key={emp.id}
                name={emp.name}
                role={emp.responsibility}
                status={emp.statusLabel}
                currentWork={emp.currentAssignment}
                currentCustomer={emp.currentCustomer}
                waitingFor={emp.waitingFor}
                nextAction={emp.nextAction}
                recentOutcome={emp.lastActivity}
                needsApproval={emp.status === "needs_approval"}
                blockers={emp.readinessBlockers}
                confidence={emp.confidence}
                askHref={emp.askHref}
              />
            ))}
          </div>
        )}
      </OperatingSection>

      {/* Business memory */}
      <OperatingSection
        id="memory-heading"
        title="Business memory"
        description="Important recent events — not a technical log."
      >
        <OperatingActivityFeed
          headingId="memory-heading"
          events={recentActivity}
          emptyLabel="No recent business memory yet. As the business operates, meaningful events will appear here."
        />
      </OperatingSection>

      {/* Business overview — secondary */}
      <OperatingSection
        id="overview-heading"
        title="Business overview"
        description="Secondary metrics that support decisions."
      >
        {overview.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>
            Metrics appear when there is enough operating activity.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: spacing.md,
            }}
          >
            {overview.map((metric: any) => (
              <li key={metric.id}>
                <div style={{ fontSize: typography.metric.fontSize, fontWeight: 700 }}>{metric.value}</div>
                <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                  {scrubInternalWording(metric.label)}
                </div>
              </li>
            ))}
          </ul>
        )}
        {base ? (
          <div style={{ marginTop: spacing.sm }}>
            <ActionButton href={`${base}/intelligence`} variant="ghost">
              Review decisions
            </ActionButton>
          </div>
        ) : null}
      </OperatingSection>

      <style>{`
        @media (max-width: 720px) {
          #ask-vibetech-composer { min-height: 96px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}

const linkStyle = {
  color: cockpitColors.accent,
  fontWeight: 600,
  fontSize: typography.caption.fontSize,
  textDecoration: "none",
} as const;
