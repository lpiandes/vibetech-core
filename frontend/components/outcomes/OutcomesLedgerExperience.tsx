"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/operating/PageHeader";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { scrubInternalWording } from "@/lib/operating/businessLanguage";

export type OutcomesLedgerView = {
  businessId?: string | null;
  honesty?: { message?: string };
  summary?: { total?: number; completed?: number; exceptions?: number; withProof?: number; proofBackedCompleted?: number; unproven?: number };
  metrics?: {
    baselineDelta?: { status?: string; reason?: string; baselineMedianMinutes?: number; note?: string };
    slaAttainment?: { status?: string; reason?: string; withinSla?: boolean; slaMinutes?: number; medianMinutes?: number };
    conversionMovement?: { status?: string; won?: number; lost?: number; reason?: string | null };
    autoVsHuman?: { auto?: number; human?: number; not_observable?: string | null };
    proofBackedCompleted?: number;
    unproven?: number;
  };
  baseline?: any;
  observation?: { importedAt?: string | null; windowDays?: number; eventCount?: number };
  replay?: {
    lastReplay?: { ranAt?: string; passed?: boolean; summary?: any; passDetail?: string } | null;
    shadow?: { enabled?: boolean; passed?: boolean; proposalCount?: number };
  };
  items?: Array<{
    id: string;
    kind?: string;
    title: string;
    status?: string;
    at?: string | null;
    humanInvolvement?: string | null;
    contractVersion?: string | null;
    contentHash?: string | null;
    outcomeType?: string | null;
    evidence?: Array<{ kind?: string; providerId?: string; source?: string | null }>;
    actions?: Array<{ at?: string | null; label?: string; detail?: string | null }>;
    href?: string | null;
    skipReason?: string | null;
    employeeName?: string | null;
    cardId?: string | null;
    state?: string | null;
  }>;
};

export default function OutcomesLedgerExperience({ view }: { view: OutcomesLedgerView }) {
  const items = Array.isArray(view.items) ? view.items : [];
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const summary = view.summary ?? {};

  const openItem = useMemo(
    () => items.find((item) => item.id === openId) ?? null,
    [items, openId],
  );

  return (
    <div style={{ display: "grid", gap: spacing.xl, padding: `${spacing.lg} ${spacing.md}`, maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        title="Outcomes"
        description="This is the scoreboard for Revenue Follow-Through: what we detected, what finished with real proof, and what still needs a human. Empty is normal until you run observe → prove on real work."
      />

      {(!items.length && !(summary.total > 0)) ? (
        <div
          style={{
            padding: spacing.lg,
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: cockpitColors.panel,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <strong style={{ fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
            Nothing to score yet
          </strong>
          <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize, lineHeight: 1.5 }}>
            After you confirm how you operate, replay history, and prove one real opportunity, finished work with evidence shows up here.
            “Not observable” means we don’t have enough source history to measure that number honestly — we won’t invent it.
          </p>
        </div>
      ) : null}

      {view.honesty?.message ? (
        <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
          {view.honesty.message}
        </p>
      ) : null}

      {view.baseline ? (
        <section aria-label="Historical baseline" style={{ ...panelStyle, display: "grid", gap: spacing.sm }}>
          <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
            Historical baseline
            {view.observation?.windowDays ? ` (${view.observation.windowDays}d)` : ""}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: spacing.sm }}>
            <BaselineChip
              label="Opportunities"
              value={formatBaselineMetric(view.baseline.metrics?.opportunitiesDetected)}
            />
            <BaselineChip
              label="Median first response"
              value={formatBaselineMetric(view.baseline.metrics?.firstResponse, "minutes")}
            />
            <BaselineChip
              label="Waiting >1 day"
              value={formatBaselineMetric(view.baseline.metrics?.waitingOverOneBusinessDay)}
            />
            <BaselineChip
              label="Meetings w/o next step"
              value={formatBaselineMetric(view.baseline.metrics?.meetingsWithoutNextStep)}
            />
            <BaselineChip
              label="Proposals w/o follow-up"
              value={formatBaselineMetric(view.baseline.metrics?.proposalsWithoutFollowUp)}
            />
            <BaselineChip
              label="Won incomplete handoffs"
              value={formatBaselineMetric(view.baseline.metrics?.wonIncompleteHandoffs)}
            />
          </div>
          {view.replay?.lastReplay ? (
            <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
              Last replay: {view.replay.lastReplay.passed ? "passed" : "reviewed"}
              {view.replay.lastReplay.summary
                ? ` · auto ${view.replay.lastReplay.summary.wouldAutoComplete ?? 0} / approval ${view.replay.lastReplay.summary.wouldNeedApproval ?? 0} / escalate ${view.replay.lastReplay.summary.wouldEscalate ?? 0}`
                : ""}
              {view.replay.shadow?.enabled
                ? ` · Shadow ${view.replay.shadow.passed ? "passed" : "on"} (${view.replay.shadow.proposalCount ?? 0} proposals)`
                : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      <section
        aria-label="Outcome summary"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: spacing.sm }}
      >
        <SummaryChip label="Listed" value={summary.total ?? items.length} />
        <SummaryChip label="Proof-backed completed" value={summary.proofBackedCompleted ?? summary.completed ?? 0} />
        <SummaryChip label="Exceptions" value={summary.exceptions ?? 0} />
        <SummaryChip label="Unproven" value={summary.unproven ?? 0} />
      </section>

      {view.metrics ? (
        <section aria-label="Proof metrics" style={{ ...panelStyle, display: "grid", gap: spacing.sm }}>
          <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>Proof metrics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.sm }}>
            {isObservableMetric(view.metrics.baselineDelta) ? (
              <MetricChip
                label="Baseline delta"
                value={formatMetricStatus(view.metrics.baselineDelta)}
              />
            ) : null}
            {isObservableMetric(view.metrics.slaAttainment) ? (
              <MetricChip
                label="SLA attainment"
                value={formatSlaMetric(view.metrics.slaAttainment)}
              />
            ) : null}
            {(view.metrics.autoVsHuman?.auto || view.metrics.autoVsHuman?.human) ? (
              <MetricChip
                label="Auto vs human"
                value={`${view.metrics.autoVsHuman?.auto ?? 0} auto / ${view.metrics.autoVsHuman?.human ?? 0} human`}
              />
            ) : null}
            <MetricChip
              label="Proof-backed"
              value={String(view.metrics.proofBackedCompleted ?? summary.proofBackedCompleted ?? 0)}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.sm }}>
            {view.metrics.conversionMovement?.status === "observable" ? (
              <MetricChip
                label="Conversion movement"
                value={formatConversionMovement(view.metrics.conversionMovement)}
              />
            ) : null}
            {typeof (view.metrics as any).humanTimeAvoidedMinutes === "number" ? (
              <MetricChip
                label="Human time avoided"
                value={`${Math.round((view.metrics as any).humanTimeAvoidedMinutes)} min`}
              />
            ) : null}
            {typeof (view.metrics as any).operatingCostUsd === "number" ? (
              <MetricChip
                label="Operating cost"
                value={`$${(view.metrics as any).operatingCostUsd.toFixed(2)}`}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {!items.length ? (
        <div style={panelStyle}>
          <p style={{ margin: 0, color: cockpitColors.textSecondary }}>
            No proven outcomes yet. When VIBETech completes follow-through with evidence, it appears here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)" }}>
          <div style={{ display: "grid", gap: spacing.sm, alignContent: "start" }}>
            {items.map((item) => {
              const active = item.id === openId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenId(item.id)}
                  style={{
                    ...panelStyle,
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: active ? cockpitColors.accent : cockpitColors.panelBorder,
                    boxShadow: active ? `inset 3px 0 0 ${cockpitColors.accent}` : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                    <strong style={{ fontSize: typography.body.fontSize }}>
                      {scrubInternalWording(item.title)}
                    </strong>
                    <StatusPill status={item.status} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                    {[item.outcomeType, item.state, formatWhen(item.at)].filter(Boolean).join(" · ")}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ ...panelStyle, alignSelf: "start" }}>
            {!openItem ? (
              <p style={{ margin: 0, color: cockpitColors.textSecondary }}>Select an outcome to see its trace.</p>
            ) : (
              <div style={{ display: "grid", gap: spacing.md }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize }}>
                    {scrubInternalWording(openItem.title)}
                  </h2>
                  <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                    {[
                      openItem.kind,
                      openItem.humanInvolvement === "none" ? "No human involvement" : "Human involvement",
                      openItem.contractVersion ? `Contract ${openItem.contractVersion}` : null,
                      openItem.employeeName,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>

                {openItem.skipReason ? (
                  <p style={{ margin: 0, color: cockpitColors.warning, fontSize: typography.meta.fontSize }}>
                    {scrubInternalWording(openItem.skipReason)}
                  </p>
                ) : null}

                <div>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: cockpitColors.textMuted }}>
                    Trace
                  </h3>
                  {!openItem.actions?.length ? (
                    <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary }}>No step trace recorded.</p>
                  ) : (
                    <ol style={{ margin: `${spacing.sm} 0 0`, paddingLeft: 18, display: "grid", gap: 8 }}>
                      {openItem.actions.map((step, index) => (
                        <li key={`${openItem.id}_step_${index}`} style={{ color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
                          <strong style={{ color: cockpitColors.textPrimary }}>{step.label}</strong>
                          {step.detail ? ` — ${scrubInternalWording(step.detail)}` : ""}
                          {step.at ? ` · ${formatWhen(step.at)}` : ""}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: cockpitColors.textMuted }}>
                    Proof
                  </h3>
                  {!openItem.evidence?.length ? (
                    <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary }}>
                      No provider ids attached yet — this outcome is listed but not fully proven.
                    </p>
                  ) : (
                    <ul style={{ margin: `${spacing.sm} 0 0`, paddingLeft: 18, display: "grid", gap: 6 }}>
                      {openItem.evidence.map((ev, index) => (
                        <li key={`${openItem.id}_ev_${index}`} style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
                          <code style={{ fontSize: 12 }}>{ev.kind}</code>: {ev.providerId}
                          {ev.source ? ` (${ev.source})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {openItem.contentHash ? (
                  <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>
                    Contract hash: <code>{String(openItem.contentHash).slice(0, 12)}…</code>
                  </p>
                ) : null}

                {openItem.href ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={openItem.href}>Open related record</Link>
                  </Button>
                ) : null}

                {view.businessId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/b/${encodeURIComponent(view.businessId)}/architect?${new URLSearchParams({
                        prompt: openItem.kind === "exception" || openItem.state === "Exception"
                          ? `Why was ${openItem.title} escalated?`
                          : `Explain outcome: ${openItem.title}`,
                        ...(openItem.cardId ? { cardId: String(openItem.cardId) } : {}),
                        outcomeId: openItem.id,
                      }).toString()}`}
                    >
                      Ask about this
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle = {
  padding: spacing.lg,
  borderRadius: radius.large,
  background: cockpitColors.panel,
  border: `1px solid ${cockpitColors.panelBorder}`,
} as const;

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 750, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function BaselineChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: spacing.md, borderRadius: radius.medium, border: `1px solid ${cockpitColors.panelBorder}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function formatBaselineMetric(metric: any, format?: string) {
  if (!metric || metric.status === "not_observable") {
    return "Not observable";
  }
  if (format === "minutes") {
    if (metric.medianMinutes == null) return "Not observable";
    return `${Math.round(metric.medianMinutes)} min`;
  }
  if (metric.count != null) return String(metric.count);
  return "—";
}

/** Plan 20 — never show stub metric chips that look like real KPIs. */
function isObservableMetric(metric?: { status?: string; baselineMedianMinutes?: number; withinSla?: boolean; medianMinutes?: number } | null) {
  if (!metric || typeof metric !== "object") return false;
  if (String(metric.status ?? "") === "not_observable") return false;
  if (String(metric.status ?? "") === "observable") return true;
  if (metric.baselineMedianMinutes != null) return true;
  if (metric.withinSla != null || metric.medianMinutes != null) return true;
  return false;
}

function StatusPill({ status }: { status?: string }) {
  const exception = status === "exception";
  const unproven = status === "unproven";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        background: exception
          ? "rgba(180,83,9,.12)"
          : unproven
            ? "rgba(100,116,139,.12)"
            : "rgba(15,118,110,.12)",
        color: exception ? cockpitColors.warning : unproven ? cockpitColors.textMuted : cockpitColors.handled,
        whiteSpace: "nowrap",
      }}
    >
      {exception ? "Exception" : unproven ? "Unproven" : "Completed"}
    </span>
  );
}

function MetricChip({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div style={{ padding: spacing.md, borderRadius: radius.medium, border: `1px solid ${cockpitColors.panelBorder}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {detail ? <div style={{ fontSize: 12, color: cockpitColors.textMuted, marginTop: 4 }}>{detail}</div> : null}
    </div>
  );
}

function formatMetricStatus(metric?: { status?: string; reason?: string; note?: string; baselineMedianMinutes?: number }) {
  if (!metric || metric.status === "not_observable") {
    return metric?.reason ?? metric?.note ?? "Not observable";
  }
  if (metric.baselineMedianMinutes != null) {
    return `Baseline ${Math.round(metric.baselineMedianMinutes)} min`;
  }
  return metric.note ?? "Observable";
}

function formatSlaMetric(metric?: { status?: string; reason?: string; withinSla?: boolean; slaMinutes?: number; medianMinutes?: number }) {
  if (!metric || metric.status === "not_observable") {
    return metric?.reason ?? "Not observable";
  }
  if (metric.medianMinutes != null && metric.slaMinutes != null) {
    return `${Math.round(metric.medianMinutes)} min vs ${metric.slaMinutes} min SLA (${metric.withinSla ? "within" : "over"})`;
  }
  return "Observable";
}

function formatConversionMovement(metric?: { status?: string; won?: number; lost?: number }) {
  if (!metric || metric.status === "not_observable") {
    return "Not observable yet";
  }
  return `${metric.won ?? 0} won / ${metric.lost ?? 0} lost`;
}

function formatWhen(value?: string | null) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  const delta = Date.now() - ms;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
