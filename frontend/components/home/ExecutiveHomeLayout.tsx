"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronUp } from "lucide-react";

import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellPanel from "@/components/shell/ShellPanel";
import ShellMetricStrip, { type ShellMetric } from "@/components/shell/ShellMetricStrip";
import PortfolioIntelligenceTable, { type PortfolioPropertyRow } from "@/components/home/PortfolioIntelligenceTable";
import StatusPill from "@/components/executive/StatusPill";
import { cockpitColors, semanticColors, spacing, typography, radius } from "@/design/tokens";

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
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

function OperatingLoopStrip({
  states,
  activeId,
  onSelect,
}: {
  states: Array<{ id: string; label: string; count?: number }>;
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (!states.length) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(states.length, 5)}, minmax(0, 1fr))`,
        gap: spacing.sm,
      }}
    >
      {states.map((state) => {
        const disabled = Number(state.count ?? 0) === 0;
        return (
          <button
            key={state.id}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelect?.(state.id)}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.medium,
              backgroundColor: activeId === state.id ? cockpitColors.accentMuted : cockpitColors.panel,
              border: `1px solid ${activeId === state.id ? cockpitColors.accent : cockpitColors.panelBorder}`,
              textAlign: "center",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: cockpitColors.textMuted,
                textTransform: "uppercase",
              }}
            >
              {state.label}
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: cockpitColors.textPrimary, marginTop: 2 }}>{state.count}</div>
          </button>
        );
      })}
    </div>
  );
}

function AttentionCard({
  item,
  onDecision,
}: {
  item: {
    id: string;
    title: string;
    summary?: string;
    reason?: string;
    businessImpact?: string;
    recommendedAction?: string;
    priority?: string;
    priorityBadge?: string;
    approvalId?: string;
    sourceId?: string;
    availableActions?: Array<{ id?: string; label?: string; href?: string }>;
  };
  onDecision: (approvalId: string, decision: string) => void;
}) {
  const approveAction = item.availableActions?.find((a) => a.id === "approve");
  const rejectAction = item.availableActions?.find((a) => a.id === "reject");
  const reviewAction = item.availableActions?.find((a) => a.href);

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
        <EntityAvatar name={item.title} kind="person" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "start" }}>
            <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{item.title}</div>
            <StatusPill tone={priorityTone(item.priorityBadge ?? item.priority ?? "medium")} label={item.priority ?? "medium"} />
          </div>
          {item.summary ? (
            <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
              {item.summary}
            </div>
          ) : null}
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
            onClick={() => onDecision(item.approvalId ?? item.sourceId ?? item.id, "GRANT")}
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
            onClick={() => onDecision(item.approvalId ?? item.sourceId ?? item.id, "REJECT")}
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

function EpisodeCard({ episode }: { episode: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const steps = safeArray<{ id: string; label: string }>(episode.whatVibeTechHandled);
  const primaryParty = episode.primaryParty as { displayName?: string } | undefined;
  const href = episode.href as string | null | undefined;
  const title = String(episode.title ?? "");

  return (
    <div style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
        <EntityAvatar name={primaryParty?.displayName ?? title} kind="person" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
            {href ? (
              <Link href={href} style={{ fontWeight: 650, color: cockpitColors.textPrimary, textDecoration: "none", fontSize: typography.body.fontSize }}>
                {title}
              </Link>
            ) : (
              <div style={{ fontWeight: 650, fontSize: typography.body.fontSize }}>{title}</div>
            )}
            <StatusPill
              tone={episode.operatingState === "waiting_human" ? "warning" : "success"}
              label={String(episode.operatingStateLabel ?? "In progress")}
            />
          </div>
          {episode.journeyLine ? (
            <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.accent, fontWeight: 500 }}>
              {String(episode.journeyLine)}
            </div>
          ) : null}
          {steps.length > 0 ? (
            <div style={{ marginTop: spacing.sm }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 600, color: cockpitColors.textMuted, marginBottom: 4 }}>VIBETech</div>
              {(expanded ? steps : steps.slice(0, 3)).map((step) => (
                <div
                  key={step.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: typography.caption.fontSize,
                    color: cockpitColors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  <Check size={12} color={semanticColors.success} /> {step.label}
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
              <strong>Next:</strong> {String(episode.nextStepLabel)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkforceCompact({ employees }: { employees: Array<Record<string, unknown>> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {employees.slice(0, 4).map((emp) => (
        <div key={String(emp.id)} style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
          <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
            <EntityAvatar name={String(emp.name ?? "")} kind="employee" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                <div style={{ fontWeight: 600, fontSize: typography.body.fontSize }}>{String(emp.name ?? "")}</div>
                <StatusPill
                  tone={
                    emp.operatingLabel === "WAITING ON YOU" ? "warning" : emp.operatingLabel === "HANDLING" ? "success" : "neutral"
                  }
                  label={String(emp.operatingLabel ?? emp.status ?? "")}
                />
              </div>
              <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                {String(emp.responsibility ?? emp.role ?? "")}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkMovingRow({ row }: { row: Record<string, unknown> }) {
  const displayName = String(row.partyName ?? row.title ?? "Work item");
  const dueLabel = row.dueLabel ? String(row.dueLabel) : null;
  const dueSuffix = dueLabel ? (row.overdue ? ` · Overdue since ${dueLabel}` : ` · Due ${dueLabel}`) : "";

  return (
    <div
      style={{
        padding: `${spacing.sm} ${spacing.md}`,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: spacing.sm,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", minWidth: 0 }}>
        <EntityAvatar name={displayName} kind={row.partyName ? "person" : "subject"} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: typography.body.fontSize }}>
            {row.engagementHref && row.partyName ? (
              <Link href={String(row.engagementHref)} style={{ color: cockpitColors.textPrimary, textDecoration: "none" }}>
                {String(row.partyName)}
              </Link>
            ) : (
              displayName
            )}
            {row.subjectName ? <span style={{ color: cockpitColors.textMuted, fontWeight: 400 }}> · {String(row.subjectName)}</span> : null}
          </div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {String(row.workTypeLabel ?? "")}
            {row.assigneeName ? ` · ${String(row.assigneeName)}` : ""}
          </div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Next: {String(row.nextStep ?? "")}
            {dueSuffix}
          </div>
        </div>
      </div>
      <StatusPill tone={row.overdue ? "danger" : "neutral"} label={String(row.statusLabel ?? row.status ?? "").replace(/_/g, " ")} />
    </div>
  );
}

export type ExecutiveWorkspaceHomeView = {
  showOperatingDashboard: boolean;
  hero: {
    headline?: string;
    summary?: string;
    businessName?: string;
  };
  businessControlStatus: {
    label?: string;
    reason?: string;
    tone?: string;
  };
  operatingStates: Array<{ id: string; label: string; count?: number }>;
  metrics: ShellMetric[];
  attention: Array<Record<string, unknown>>;
  episodeFeed: Array<Record<string, unknown>>;
  workMovingNow: Array<Record<string, unknown>>;
  digitalWorkforce: { digitalEmployees: Array<Record<string, unknown>> };
  autonomousContinuation: Array<{ id: string; title: string; detail?: string; blocker?: string }>;
  autonomousContinuationTitle: string;
  topProperties: PortfolioPropertyRow[];
  recentCommunications: Array<{
    id: string;
    subject: string;
    preview: string | null;
    occurredAt: string;
    href: string | null;
  }>;
  unattributedCallout: string | null;
  sections: Record<string, string>;
  portfolioTable: Record<string, string>;
  emptyStates: Record<string, string>;
};

export default function ExecutiveHomeLayout({
  executive,
  businessId,
}: {
  executive: ExecutiveWorkspaceHomeView;
  businessId: string;
}) {
  const router = useRouter();
  const base = `/b/${businessId}`;
  const [stateFilter, setStateFilter] = useState<string | null>(null);

  const attention = safeArray<Record<string, unknown>>(executive.attention);
  const episodeFeed = safeArray<Record<string, unknown>>(executive.episodeFeed);
  const workRows = safeArray<Record<string, unknown>>(executive.workMovingNow);
  const workforce = safeArray<Record<string, unknown>>(executive.digitalWorkforce?.digitalEmployees);
  const operatingStates = safeArray<{ id: string; label: string; count?: number }>(executive.operatingStates);
  const autonomous = safeArray<{ id: string; title: string; detail?: string; blocker?: string }>(executive.autonomousContinuation);

  const filteredEpisodes =
    stateFilter === "new"
      ? episodeFeed.filter((e) => e.operatingState === "new")
      : stateFilter === "vibetech_handling"
        ? episodeFeed.filter((e) => e.operatingState === "handling")
        : stateFilter === "waiting_human"
          ? episodeFeed.filter((e) => e.operatingState === "waiting_human" || e.operatingState === "blocked")
          : stateFilter === "moving_forward"
            ? workRows
            : stateFilter === "completed"
              ? episodeFeed.filter((e) => e.operatingState === "completed")
              : episodeFeed;

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

  if (!executive.showOperatingDashboard) return null;

  const hero = executive.hero ?? {};
  const control = executive.businessControlStatus ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.lg }}>
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
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: cockpitColors.textMuted,
            }}
          >
            {executive.sections.businessToday}
          </div>
          <div style={{ marginTop: spacing.xs, fontSize: "1.25rem", fontWeight: 650, color: cockpitColors.textPrimary, lineHeight: 1.25 }}>
            {hero.headline ?? hero.businessName}
          </div>
          <div
            style={{
              marginTop: spacing.xs,
              fontSize: typography.body.fontSize,
              color: cockpitColors.textSecondary,
              lineHeight: 1.45,
              maxWidth: 640,
            }}
          >
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
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{executive.sections.businessStatus}</div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: spacing.sm }}>
              <StatusPill tone={controlTone(String(control.tone ?? "neutral"))} label={control.label ?? "Under control"} />
            </div>
            <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.4 }}>
              {control.reason}
            </div>
          </div>
          <ShellMetricStrip metrics={executive.metrics} />
        </div>
      </div>

      <OperatingLoopStrip states={operatingStates} activeId={stateFilter} onSelect={(id) => setStateFilter((prev) => (prev === id ? null : id))} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.2fr) minmax(0, 0.85fr)",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <ShellPanel
          title={executive.sections.attention}
          subtitle="Decisions only you can make"
          action={
            attention.length > 0 ? (
              <Link href={`${base}/for-you`} style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
                View all
              </Link>
            ) : null
          }
        >
          {attention.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.body.fontSize }}>
              {executive.emptyStates.attention ?? "Nothing needs your judgment. VIBETech is handling routine operations."}
            </div>
          ) : (
            attention.slice(0, 3).map((item) => (
              <AttentionCard key={String(item.id)} item={item as never} onDecision={handleApproval} />
            ))
          )}
        </ShellPanel>

        <ShellPanel
          title={executive.sections.movingNow}
          subtitle="Active business episodes"
          action={
            <Link href={`${base}/work`} style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
              Open work
            </Link>
          }
        >
          {filteredEpisodes.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted }}>No items for this operating state.</div>
          ) : stateFilter === "moving_forward" ? (
            filteredEpisodes.slice(0, 4).map((row) => <WorkMovingRow key={String(row.id)} row={row} />)
          ) : (
            filteredEpisodes.slice(0, 4).map((ep) => <EpisodeCard key={String(ep.id ?? ep.episodeId)} episode={ep} />)
          )}
        </ShellPanel>

        <ShellPanel
          title={executive.sections.digitalWorkforce}
          subtitle="VIBETech operating status"
          action={
            <Link href={`${base}/team`} style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, textDecoration: "none" }}>
              Team
            </Link>
          }
        >
          {workforce.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted }}>No digital employees configured yet.</div>
          ) : (
            <WorkforceCompact employees={workforce} />
          )}
        </ShellPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: spacing.md }}>
        <ShellPanel title={executive.autonomousContinuationTitle} subtitle="Truthful autonomous continuation">
          {autonomous.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              No autonomous actions queued. VIBETech will act when new work is ready.
            </div>
          ) : (
            autonomous.slice(0, 5).map((item) => (
              <div key={item.id} style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                <div style={{ fontWeight: 500, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{item.title}</div>
                <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, lineHeight: 1.4 }}>{item.detail}</div>
                {item.blocker ? (
                  <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.warning }}>Blocked: {item.blocker}</div>
                ) : null}
              </div>
            ))
          )}
        </ShellPanel>

        <ShellPanel title={executive.sections.workInMotion} subtitle="Who owns what — and when">
          {workRows.length === 0 ? (
            <div style={{ padding: spacing.md, color: cockpitColors.textMuted }}>No active work.</div>
          ) : (
            workRows.slice(0, 5).map((row) => <WorkMovingRow key={String(row.id)} row={row} />)
          )}
        </ShellPanel>
      </div>

      {executive.unattributedCallout ? (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panelElevated,
            fontSize: typography.caption.fontSize,
            color: cockpitColors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {executive.unattributedCallout}
        </div>
      ) : null}

      <PortfolioIntelligenceTable
        title={executive.sections.propertyIntelligence}
        rows={executive.topProperties}
        columns={executive.portfolioTable as never}
        emptyDescription={executive.emptyStates.propertyIntelligence ?? "Add a property and receive an inquiry."}
      />

      {executive.recentCommunications.length > 0 ? (
        <ShellPanel title={executive.sections.recentCommunications} subtitle="Latest outbound and inbound threads">
          {executive.recentCommunications.map((thread) => (
            <div key={thread.id} style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              {thread.href ? (
                <Link href={thread.href} style={{ fontWeight: 600, color: cockpitColors.textPrimary, textDecoration: "none" }}>
                  {thread.subject}
                </Link>
              ) : (
                <div style={{ fontWeight: 600 }}>{thread.subject}</div>
              )}
              {thread.preview ? (
                <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.4 }}>
                  {thread.preview}
                </div>
              ) : null}
            </div>
          ))}
        </ShellPanel>
      ) : null}
    </div>
  );
}
