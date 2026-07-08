"use client";

import type { ReactNode } from "react";
import { useContext, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Wrench,
  Bot,
} from "lucide-react";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import DemoStoryMode from "./DemoStoryMode";

import StatusPill from "@/components/executive/StatusPill";
import { cockpitColors, semanticColors, spacing, typography, radius } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

function initials(name: string) {
  return String(name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function priorityTone(p: string): "danger" | "warning" | "neutral" {
  if (p === "critical") return "danger";
  if (p === "high" || p === "warning") return "warning";
  return "neutral";
}

function controlTone(tone: string): "danger" | "warning" | "success" | "neutral" {
  if (tone === "danger") return "danger";
  if (tone === "warning") return "warning";
  if (tone === "success") return "success";
  return "neutral";
}

function EntityAvatar({ name, kind }: { name: string; kind?: "person" | "subject" | "employee" }) {
  const bg = kind === "subject" ? cockpitColors.accentMuted : kind === "employee" ? "rgba(34,197,94,0.12)" : cockpitColors.panelElevated;
  const color = kind === "employee" ? semanticColors.success : cockpitColors.accent;
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.medium,
        backgroundColor: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: typography.caption.fontSize,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {kind === "subject" ? <Building2 size={16} /> : kind === "employee" ? <Bot size={16} /> : initials(name)}
    </div>
  );
}

function CompactPulse({ metrics }: { metrics: any[] }) {
  if (!metrics.length) return null;
  return (
    <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
      {metrics.slice(0, 5).map((m) => (
        <div
          key={String(m.id)}
          style={{
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.medium,
            backgroundColor: cockpitColors.panelElevated,
            border: `1px solid ${cockpitColors.panelBorder}`,
            minWidth: 88,
          }}
        >
          <div style={{ fontSize: "0.65rem", color: cockpitColors.textMuted, lineHeight: 1.2 }}>{m.label}</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 650, color: cockpitColors.textPrimary }}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}

function OperatingLoopStrip({ states, activeId, onSelect }: { states: any[]; activeId?: string | null; onSelect?: (id: string) => void }) {
  if (!states.length) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(states.length, 5)}, minmax(0, 1fr))`,
        gap: spacing.sm,
      }}
    >
      {states.map((s) => {
        const disabled = Number(s.count ?? 0) === 0;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelect?.(s.id)}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.medium,
              backgroundColor: activeId === s.id ? cockpitColors.accentMuted : cockpitColors.panel,
              border: `1px solid ${activeId === s.id ? cockpitColors.accent : cockpitColors.panelBorder}`,
              textAlign: "center",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <div style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.05em", color: cockpitColors.textMuted, textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: cockpitColors.textPrimary, marginTop: 2 }}>{s.count}</div>
          </button>
        );
      })}
    </div>
  );
}

function AttentionCard({ item, onDecision }: { item: any; onDecision: (approvalId: string, decision: string) => void }) {
  const approveAction = item.availableActions?.find((a: any) => a.id === "approve");
  const rejectAction = item.availableActions?.find((a: any) => a.id === "reject");
  const reviewAction = item.availableActions?.find((a: any) => a.href);

  return (
    <div
      style={{
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
        <EntityAvatar name={item.partyName ?? item.title} kind="person" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "start" }}>
            <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{item.title}</div>
            <StatusPill tone={priorityTone(item.priorityBadge ?? item.priority)} label={item.priority} />
          </div>
          <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
            {item.summary}
          </div>
          {item.reason ? (
            <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
              <strong>Why:</strong> {item.reason}
            </div>
          ) : null}
          {item.businessImpact ? (
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.warning }}>
              <strong>Impact:</strong> {item.businessImpact}
            </div>
          ) : null}
          {item.recommendedAction ? (
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
              <strong>Recommendation:</strong> {item.recommendedAction}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", paddingLeft: 44 }}>
        {approveAction ? (
          <button
            type="button"
            onClick={() => onDecision(item.approvalId ?? item.sourceId, "GRANT")}
            style={{
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: radius.medium,
              border: "none",
              backgroundColor: semanticColors.success,
              color: "#fff",
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Approve
          </button>
        ) : null}
        {rejectAction ? (
          <button
            type="button"
            onClick={() => onDecision(item.approvalId ?? item.sourceId, "REJECT")}
            style={{
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: "transparent",
              color: cockpitColors.textSecondary,
              fontSize: typography.caption.fontSize,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reject
          </button>
        ) : null}
        {reviewAction?.href ? (
          <Link
            href={reviewAction.href}
            style={{
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              color: cockpitColors.accent,
              fontSize: typography.caption.fontSize,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Review details <ArrowRight size={12} />
          </Link>
        ) : null}
        {!approveAction && item.availableActions?.[0]?.href ? (
          <Link href={item.availableActions[0].href} style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
            {item.availableActions[0].label} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function EpisodeCard({ episode }: { episode: any }) {
  const [expanded, setExpanded] = useState(false);
  const steps = safeArray(episode.whatVibeTechHandled);

  return (
    <div
      style={{
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
        <EntityAvatar name={episode.primaryParty?.displayName ?? episode.title} kind="person" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
            {episode.href ? (
              <Link href={episode.href} style={{ fontWeight: 650, color: cockpitColors.textPrimary, textDecoration: "none", fontSize: typography.body.fontSize }}>
                {episode.title}
              </Link>
            ) : (
              <div style={{ fontWeight: 650, fontSize: typography.body.fontSize }}>{episode.title}</div>
            )}
            <StatusPill tone={episode.operatingState === "waiting_human" ? "warning" : "success"} label={episode.operatingStateLabel ?? "In progress"} />
          </div>
          {episode.journeyLine ? (
            <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.accent, fontWeight: 500 }}>
              {episode.journeyLine}
            </div>
          ) : null}
          {steps.length > 0 ? (
            <div style={{ marginTop: spacing.sm }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 600, color: cockpitColors.textMuted, marginBottom: 4 }}>VIBETech</div>
              {(expanded ? steps : steps.slice(0, 3)).map((s: any) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, marginTop: 2 }}>
                  <Check size={12} color={semanticColors.success} /> {s.label}
                </div>
              ))}
              {steps.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    marginTop: 4,
                    border: "none",
                    background: "none",
                    color: cockpitColors.accent,
                    fontSize: typography.caption.fontSize,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: 0,
                  }}
                >
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {expanded ? "Less detail" : `${steps.length - 3} more steps`}
                </button>
              ) : null}
            </div>
          ) : null}
          {episode.nextStepLabel ? (
            <div style={{ marginTop: spacing.sm, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
              <strong>Next:</strong> {episode.nextStepLabel}
            </div>
          ) : null}
          {episode.handledCount ? (
            <div style={{ marginTop: 4, fontSize: "0.65rem", color: cockpitColors.textMuted }}>
              Handled automatically: {episode.handledCount} steps
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkforceCompact({ employees }: { employees: any[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {employees.slice(0, 4).map((emp) => (
        <div key={emp.id} style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
          <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
            <EntityAvatar name={emp.name} kind="employee" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                <div style={{ fontWeight: 600, fontSize: typography.body.fontSize }}>{emp.name}</div>
                <StatusPill
                  tone={emp.operatingLabel === "WAITING ON YOU" ? "warning" : emp.operatingLabel === "HANDLING" ? "success" : "neutral"}
                  label={emp.operatingLabel ?? emp.status}
                />
              </div>
              <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                {emp.responsibility ?? emp.role}
              </div>
              {safeArray(emp.monitoring ?? emp.watching).map((m: any) => (
                <div key={m.label} style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
                  Currently monitoring · {m.count} {String(m.label).toLowerCase()}
                </div>
              ))}
              {emp.currentHandling ? (
                <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
                  Handling · {emp.currentHandling}
                </div>
              ) : null}
              <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: emp.needsFromYou !== "Nothing" ? cockpitColors.warning : cockpitColors.textMuted }}>
                Needs from you · {emp.needsFromYou ?? emp.needsFromOwner ?? "Nothing"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkMovingRow({ row }: { row: any }) {
  const displayName = row.partyName ?? row.title ?? "Work item";
  const dueSuffix = row.dueLabel
    ? row.overdue
      ? ` · Overdue since ${row.dueLabel}`
      : ` · Due ${row.dueLabel}`
    : "";
  return (
    <div style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}`, display: "grid", gridTemplateColumns: "1fr auto", gap: spacing.sm, alignItems: "center" }}>
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", minWidth: 0 }}>
        <EntityAvatar name={displayName} kind={row.partyName ? "person" : "subject"} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: typography.body.fontSize }}>
            {row.engagementHref && row.partyName ? (
              <Link href={row.engagementHref} style={{ color: cockpitColors.textPrimary, textDecoration: "none" }}>
                {row.partyName}
              </Link>
            ) : (
              displayName
            )}
            {row.subjectName ? <span style={{ color: cockpitColors.textMuted, fontWeight: 400 }}> · {row.subjectName}</span> : null}
          </div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {row.workTypeLabel}
            {row.assigneeName ? ` · ${row.assigneeName}` : ""}
          </div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Next: {row.nextStep}
            {dueSuffix}
          </div>
        </div>
      </div>
      <StatusPill tone={row.overdue ? "danger" : "neutral"} label={row.statusLabel ?? String(row.status ?? "").replace(/_/g, " ")} />
    </div>
  );
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section
      style={{
        borderRadius: radius.large,
        border: `1px solid ${cockpitColors.panelBorder}`,
        backgroundColor: cockpitColors.panel,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: `${spacing.sm} ${spacing.md}`,
          borderBottom: `1px solid ${cockpitColors.panelBorder}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: spacing.sm,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{title}</div>
          {subtitle ? <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

export default function OperatingCockpitLayout() {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  const router = useRouter();
  if (!viewModel) return null;

  const cc = (viewModel as any).commandCenter ?? viewModel;
  const hero = cc.hero ?? {};
  const control = cc.businessControlStatus ?? {};
  const pulse = safeArray(cc.pulse);
  const attention = safeArray(cc.needsYourAttention);
  const episodeFeed = safeArray(cc.businessEpisodeFeed ?? cc.businessEpisodes);
  const workRows = safeArray(cc.workMovingNow ?? cc.workInProgress?.in_progress);
  const workforce = safeArray(cc.digitalWorkforce?.digitalEmployees);
  const operatingStates = safeArray(cc.operatingStates);
  const autonomous = safeArray(cc.autonomousContinuation ?? cc.whatHappensNext);
  const continuationTitle = cc.autonomousContinuationTitle ?? "VIBETech will keep moving";
  const [stateFilter, setStateFilter] = useState<string | null>(null);

  const filteredEpisodes =
    stateFilter === "new"
      ? episodeFeed.filter((e: any) => e.operatingState === "new")
      : stateFilter === "vibetech_handling"
        ? episodeFeed.filter((e: any) => e.operatingState === "handling")
        : stateFilter === "waiting_human"
          ? episodeFeed.filter((e: any) => e.operatingState === "waiting_human" || e.operatingState === "blocked")
          : stateFilter === "moving_forward"
            ? workRows
            : stateFilter === "completed"
              ? episodeFeed.filter((e: any) => e.operatingState === "completed")
              : episodeFeed;
  const attentionPanelTitle = (viewModel as any).productContext?.pageLabels?.attention ?? "Needs decision";
  const showDemoStory = safeArray((viewModel as any).demoStorySteps).length > 0;

  const handleApproval = useCallback(
    async (approvalId: string, decision: string) => {
      await fetch(`/api/approvals/${approvalId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    },
    [router],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.lg }}>
      {/* Business today summary + control + pulse */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 0.8fr)",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
          }}
        >
          <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
            Business today
          </div>
          <div style={{ marginTop: spacing.xs, fontSize: "1.25rem", fontWeight: 650, color: cockpitColors.textPrimary, lineHeight: 1.25 }}>
            {hero.headline ?? hero.businessName}
          </div>
          <div style={{ marginTop: spacing.xs, fontSize: typography.body.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.45, maxWidth: 640 }}>
            {hero.summary}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <div
            style={{
              padding: spacing.md,
              borderRadius: radius.large,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.panelElevated,
            }}
          >
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Business status</div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: spacing.sm }}>
              <StatusPill tone={controlTone(control.tone)} label={control.label ?? "Under control"} />
            </div>
            <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.4 }}>
              {control.reason}
            </div>
          </div>
          <CompactPulse metrics={pulse} />
        </div>
      </div>

      <OperatingLoopStrip states={operatingStates} activeId={stateFilter} onSelect={(id) => setStateFilter((prev) => (prev === id ? null : id))} />

      {/* Primary operations grid — natural document flow, no fixed heights */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.2fr) minmax(0, 0.85fr)",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <Panel
          title={attentionPanelTitle}
          subtitle="Decisions only you can make"
          action={
            attention.length > 0 ? (
              <Link href="/attention" style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
                View all
              </Link>
            ) : null
          }
        >
          {attention.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.body.fontSize }}>
              Nothing needs your judgment. VIBETech is handling routine operations.
            </div>
          ) : (
            attention.slice(0, 3).map((item: any) => <AttentionCard key={item.id} item={item} onDecision={handleApproval} />)
          )}
        </Panel>

        <Panel
          title="Business moving now"
          subtitle="Active business episodes"
          action={
            <Link href="/work" style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
              Open work
            </Link>
          }
        >
          {filteredEpisodes.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted }}>No items for this operating state.</div>
          ) : stateFilter === "moving_forward" ? (
            filteredEpisodes.slice(0, 4).map((w: any) => <WorkMovingRow key={w.id} row={w} />)
          ) : (
            filteredEpisodes.slice(0, 4).map((ep: any) => <EpisodeCard key={ep.id ?? ep.episodeId} episode={ep} />)
          )}
        </Panel>

        <Panel
          title="Digital workforce"
          subtitle="VIBETech operating status"
          action={
            <Link href="/team" style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
              Team
            </Link>
          }
        >
          <WorkforceCompact employees={workforce} />
        </Panel>
      </div>

      {/* What happens next + work board */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: spacing.md }}>
        <Panel title={continuationTitle} subtitle="Truthful autonomous continuation">
          {autonomous.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              No autonomous actions queued. VIBETech will act when new work is ready.
            </div>
          ) : (
            autonomous.slice(0, 5).map((n: any) => (
              <div key={n.id} style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                <div style={{ fontWeight: 500, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{n.title}</div>
                <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, lineHeight: 1.4 }}>{n.detail}</div>
                {n.blocker ? (
                  <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.warning }}>Blocked: {n.blocker}</div>
                ) : null}
              </div>
            ))
          )}
        </Panel>

        <Panel title="Work in motion" subtitle="Who owns what — and when">
          {workRows.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted }}>No active work.</div>
          ) : (
            workRows.slice(0, 5).map((w: any) => <WorkMovingRow key={w.id} row={w} />)
          )}
        </Panel>
      </div>

      <DemoStoryMode enabled={showDemoStory} steps={safeArray((viewModel as any).demoStorySteps)} />
    </div>
  );
}
