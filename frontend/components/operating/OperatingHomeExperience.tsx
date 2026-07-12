"use client";

import { useContext, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import DemoStoryMode from "@/components/mission-control/DemoStoryMode";
import { PageHeader, SectionHeader } from "@/components/operating/PageHeader";
import OperatingStatusBadge from "@/components/operating/OperatingStatusBadge";
import { Surface, ActionButton, EmptyState } from "@/components/operating/Surface";
import GlobalAskVibeTechEntry from "@/components/shell/GlobalAskVibeTechEntry";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";

/**
 * Operating Home — supervise a living business.
 * Prioritizes Needs Attention, what VIBETech handled, team load, and recent changes.
 */
export default function OperatingHomeExperience() {
  const viewModel = useContext(MissionControlViewModelContext) as any;
  const experience = viewModel?.experience ?? null;
  const scope = useOptionalBusinessScope();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const businessName = String(
    viewModel?.hero?.businessName ?? viewModel?.productContext?.identity?.businessName ?? "Your business",
  );
  const base = scope?.businessId ? `/b/${scope.businessId}` : "";
  const showDemo = Array.isArray(viewModel?.demoStorySteps) && viewModel.demoStorySteps.length > 0;

  const waiting = experience?.waitingOnYou ?? [];
  const handled = experience?.aiWorkforceActivity?.handledByVibeTech ?? [];
  const employees = experience?.aiWorkforceActivity?.digitalEmployees ?? [];
  const timeline = experience?.businessTimeline ?? [];
  const briefing = experience?.executiveBriefing;
  const control = experience?.businessControlStatus;

  const pulse = useMemo(() => {
    const approvals = waiting.filter((w: any) => /approv/i.test(String(w.priorityBadge ?? w.title ?? ""))).length;
    return {
      attention: waiting.length,
      inProgress: experience?.upcomingWork?.filter((w: any) => /progress|active|open/i.test(String(w.status ?? ""))).length
        ?? experience?.activeBusinessEpisodes?.length
        ?? 0,
      approvals,
      handled: handled.length,
    };
  }, [waiting, handled, experience]);

  async function improve(prompt: string, id: string) {
    if (!scope?.businessId) {
      setError("Open this business workspace to act.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.productError?.message ?? data.error ?? data.reason ?? "Could not open Architect.");
      }
      router.push(data.openHref ?? `${base}/architect`);
    } catch (err) {
      setError(formatProductErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!experience) {
    return (
      <EmptyState
        title="Getting your Home ready"
        description="VIBETech is gathering live signals for this business. Refresh in a moment, or Ask VIBETech what to do next."
        action={scope?.businessId ? <GlobalAskVibeTechEntry /> : null}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: spacing.xl, paddingBottom: spacing["3xl"] }}>
      <PageHeader
        eyebrow="Operating Home"
        title={businessName}
        description={
          briefing?.summary
          ?? "The business is operating. Supervise what needs you, what VIBETech handled, and what changed."
        }
        actions={
          <>
            {control ? <OperatingStatusBadge status={control.tone} label={control.label ?? "Operating"} /> : null}
            {scope?.businessId ? <GlobalAskVibeTechEntry compact /> : null}
          </>
        }
      />

      {error ? (
        <Surface role="alert" style={{ color: cockpitColors.critical }}>
          {error}
        </Surface>
      ) : null}

      {showDemo ? <DemoStoryMode /> : null}

      {/* 1. Operating pulse */}
      <Surface as="section" aria-labelledby="pulse-heading">
        <SectionHeader id="pulse-heading" title="Operating pulse" description="What requires supervision right now." />
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: spacing.md,
          }}
        >
          <PulseStat label="Needs attention" value={pulse.attention} href={base ? `${base}/intelligence` : undefined} emphasize />
          <PulseStat label="In progress" value={pulse.inProgress} href={base ? `${base}/work` : undefined} />
          <PulseStat label="Approvals waiting" value={pulse.approvals} />
          <PulseStat label="Recently handled" value={pulse.handled} />
        </ul>
        {briefing?.nextHumanStep ? (
          <p style={{ margin: `${spacing.md} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
            Next: {briefing.nextHumanStep}
          </p>
        ) : null}
      </Surface>

      {/* 2. Needs Attention preview */}
      <Surface as="section" aria-labelledby="attention-heading">
        <SectionHeader
          id="attention-heading"
          title="Needs your attention"
          description="Top items that need a human decision or action."
          action={
            base ? (
              <Link href={`${base}/intelligence`} style={{ color: cockpitColors.accent, fontWeight: 600, fontSize: typography.caption.fontSize }}>
                View all
              </Link>
            ) : null
          }
        />
{waiting.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>Nothing waiting on you. VIBETech will surface the next decision when it matters.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.md }}>
            {waiting.slice(0, 5).map((item: any) => (
              <li
                key={item.id}
                style={{
                  display: "grid",
                  gap: spacing.sm,
                  paddingBottom: spacing.md,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                  <strong style={{ color: cockpitColors.textPrimary }}>{item.title}</strong>
                  {item.priorityBadge ? <OperatingStatusBadge status={item.priorityBadge} label={item.priorityBadge} /> : null}
                </div>
                <div style={{ color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
                  {item.reason ?? item.summary}
                </div>
                <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  {(item.availableActions ?? []).slice(0, 2).map((action: any, idx: number) =>
                    action.href ? (
                      <ActionButton key={idx} href={action.href} variant="secondary">
                        {action.label ?? "Open"}
                      </ActionButton>
                    ) : null,
                  )}
                  {base ? (
                    <ActionButton href={`${base}/intelligence`} variant="ghost">
                      Review
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* 3. VIBETech handled */}
      <Surface as="section" aria-labelledby="handled-heading">
        <SectionHeader id="handled-heading" title="VIBETech handled" description="Completed work, resolved attention, and AI employee outcomes." />
{handled.length === 0 && (experience.recentlyImproved ?? []).length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>
            Handled outcomes will appear here as the business operates.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.sm }}>
            {handled.slice(0, 6).map((item: any, index: number) => (
              <li key={item.id ?? index} style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
                <OperatingStatusBadge status="handled" />
                <div>
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{item.title}</div>
                  {item.summary ? (
                    <div style={{ color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>{item.summary}</div>
                  ) : null}
                </div>
              </li>
            ))}
            {(experience.recentlyImproved ?? []).slice(0, 4).map((item: any) => (
              <li key={item.id} style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
                <OperatingStatusBadge status="resolved" />
                <div>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  {item.at ? (
                    <div style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                      {new Date(item.at).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* 4. Team at work */}
      <Surface as="section" aria-labelledby="team-heading">
        <SectionHeader
          id="team-heading"
          title="Team at work"
          description="Human and AI employee load."
          action={
            base ? (
              <Link href={`${base}/team`} style={{ color: cockpitColors.accent, fontWeight: 600, fontSize: typography.caption.fontSize }}>
                Open team
              </Link>
            ) : null
          }
        />
{employees.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>
            No AI employees reporting yet. Invite teammates or Ask VIBETech to prepare digital workers.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.md }}>
            {employees.slice(0, 6).map((emp: any) => (
              <li key={emp.id} style={{ display: "grid", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{emp.name ?? "AI Employee"}</strong>
                  <OperatingStatusBadge status={emp.status} label={emp.status ?? "ready"} />
                </div>
                <div style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>{emp.role}</div>
                {emp.currentHandling ? (
                  <div style={{ color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
                    Working on: {emp.currentHandling}
                  </div>
                ) : null}
                {emp.needsFromOwner ? (
                  <div style={{ color: cockpitColors.warning, fontSize: typography.meta.fontSize }}>
                    Needs you: {emp.needsFromOwner}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* 5. Recent changes */}
      <Surface as="section" aria-labelledby="changes-heading">
        <SectionHeader id="changes-heading" title="Recent changes" description="OS, team, integrations, attention, and work." />
{(briefing?.whatChanged ?? []).length === 0 && timeline.length === 0 ? (
          <p style={{ margin: 0, color: cockpitColors.textMuted }}>No recent changes recorded.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.sm }}>
            {(briefing?.whatChanged ?? []).slice(0, 5).map((line: string, i: number) => (
              <li key={`chg-${i}`} style={{ color: cockpitColors.textSecondary }}>
                {line}
              </li>
            ))}
            {timeline.slice(0, 5).map((item: any) => (
              <li key={item.id} style={{ display: "grid", gap: 2 }}>
                <strong style={{ fontSize: typography.body.fontSize }}>{item.title}</strong>
                {item.summary ? (
                  <span style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>{item.summary}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* Ask prompt */}
      <Surface as="section" inset>
        <SectionHeader title="Ask VIBETech" description="Explain a situation, propose a change, or decide what to do next." />
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          {scope?.businessId ? <GlobalAskVibeTechEntry /> : null}
          <ActionButton
            variant="secondary"
            disabled={busyId === "brief"}
            onClick={() =>
              void improve(
                briefing?.topRecommendation?.title
                  ?? "What should I focus on in this business right now?",
                "brief",
              )
            }
          >
            {busyId === "brief" ? "Opening…" : "What should I focus on?"}
          </ActionButton>
        </div>
      </Surface>
    </div>
  );
}

function PulseStat({
  label,
  value,
  href,
  emphasize,
}: {
  label: string;
  value: number;
  href?: string;
  emphasize?: boolean;
}) {
  const content = (
    <>
      <div
        style={{
          fontSize: typography.metric.fontSize,
          fontWeight: 700,
          color: emphasize && value > 0 ? cockpitColors.warning : cockpitColors.textPrimary,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>{label}</div>
    </>
  );
  if (href) {
    return (
      <li>
        <Link href={href} style={{ textDecoration: "none", display: "block" }}>
          {content}
        </Link>
      </li>
    );
  }
  return <li>{content}</li>;
}
