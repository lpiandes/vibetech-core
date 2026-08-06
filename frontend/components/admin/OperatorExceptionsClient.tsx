"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/product/StatusBadge";
import {
  VtCard,
  VtEmpty,
  VtPanel,
} from "@/components/product/VtChrome";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type OperatorCase = {
  id: string;
  kind?: string;
  urgency?: string;
  title?: string;
  summary?: string;
  businessId?: string;
  businessName?: string;
  cardId?: string | null;
  href?: string;
  workspaceHref?: string;
  supportHref?: string;
  steps?: string[];
  contractVersion?: string | null;
  contentHash?: string | null;
  evidence?: Array<{ kind?: string; providerId?: string }>;
  payload?: Record<string, unknown>;
  createdAt?: string | null;
};

type ScoreMetric =
  | { status: "observable"; count?: number; minutes?: number; currentMedianMinutes?: number; baselineMedianMinutes?: number }
  | { status: "not_observable"; reason?: string };

type PilotScorecard = {
  businessId?: string | null;
  windowDays?: number;
  eligibleEvents?: ScoreMetric;
  detectedEvents?: ScoreMetric;
  completed?: ScoreMetric;
  automaticCompletions?: ScoreMetric;
  operatorInterventions?: ScoreMetric;
  operatorRescueCompletions?: ScoreMetric;
  humanMinutesTotal?: ScoreMetric;
  medianResponseMinutes?: ScoreMetric;
  exceptionsByCategory?: Array<{ category: string; count: number }>;
  honesty?: { message?: string | null };
};

/**
 * Plan 8 — VIBETech operator console (platform admin only).
 */
export default function OperatorExceptionsClient() {
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get("caseId");

  const [cases, setCases] = useState<OperatorCase[]>([]);
  const [platformActions, setPlatformActions] = useState<OperatorCase[]>([]);
  const [rootCauseOptions, setRootCauseOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [roadmapFeed, setRoadmapFeed] = useState<{ ranked?: Array<{ rootCause: string; count: number }>; totalClosed?: number } | null>(null);
  const [honesty, setHonesty] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialCaseId);
  const [trace, setTrace] = useState<any>(null);
  const [rootCause, setRootCause] = useState("");
  const [note, setNote] = useState("");
  const [minutesSpent, setMinutesSpent] = useState("");
  const [actionPerformed, setActionPerformed] = useState("");
  const [wasNecessary, setWasNecessary] = useState("");
  const [canAutomate, setCanAutomate] = useState("");
  const [laborCostClass, setLaborCostClass] = useState("");
  const [resolutionOutcome, setResolutionOutcome] = useState("");
  const [scorecard, setScorecard] = useState<PilotScorecard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/operator-queue");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setError(data.error ?? data.message ?? "Could not load operator queue");
      return;
    }
    setCases(Array.isArray(data.cases) ? data.cases : []);
    setPlatformActions(Array.isArray(data.platformActions) ? data.platformActions : []);
    setRootCauseOptions(Array.isArray(data.rootCauseOptions) ? data.rootCauseOptions : []);
    setRoadmapFeed(data.roadmapFeed ?? null);
    setHonesty(data.honesty?.message ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allOpen = useMemo(() => [...cases, ...platformActions], [cases, platformActions]);

  const selected = useMemo(
    () => allOpen.find((c) => c.id === selectedId) ?? null,
    [allOpen, selectedId],
  );
  const scorecardBusinessId = selected?.businessId ?? allOpen[0]?.businessId ?? null;

  useEffect(() => {
    if (!selectedId) {
      setTrace(null);
      return;
    }
    let cancelled = false;
    setTrace(null);
    (async () => {
      const res = await fetch("/api/admin/operator-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", caseId: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setTrace(data.ok ? (data.trace ?? null) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!scorecardBusinessId) {
      setScorecard(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/pilot-scorecard?businessId=${encodeURIComponent(scorecardBusinessId)}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setScorecard(res.ok && data.ok ? (data.scorecard ?? null) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [scorecardBusinessId]);

  async function resolveCase() {
    if (!selectedId) return;
    if (!minutesSpent.trim()) {
      setError("Minutes spent is required before resolve.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/operator-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          caseId: selectedId,
          rootCause,
          note: note.trim() || null,
          workflowRunId: selected?.cardId ?? selected?.payload?.workId ?? null,
          startedAt: selected?.createdAt ?? null,
          minutesSpent: Number(minutesSpent),
          actionPerformed: actionPerformed.trim() || null,
          wasNecessary: parseNullableBoolean(wasNecessary),
          canAutomate: parseNullableBoolean(canAutomate),
          laborCostClass: laborCostClass || null,
          resolutionOutcome: resolutionOutcome.trim() || null,
          linkedTraceRef: selected?.cardId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(data.message ?? data.error ?? "Resolve failed — root cause is required.");
      } else {
        setMessage(`Closed with ${data.intervention?.rootCauseLabel ?? rootCause}.`);
        setRootCause("");
        setNote("");
        setMinutesSpent("");
        setActionPerformed("");
        setWasNecessary("");
        setCanAutomate("");
        setLaborCostClass("");
        setResolutionOutcome("");
        setSelectedId(null);
        await refresh();
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      {honesty ? (
        <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>{honesty}</p>
      ) : null}

      {roadmapFeed?.ranked?.length ? (
        <VtPanel title="Root-cause roadmap feed">
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {roadmapFeed.ranked.map((row) => (
              <span
                key={row.rootCause}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  fontSize: 12,
                  fontWeight: 650,
                }}
              >
                {row.rootCause.replace(/_/g, " ")} · {row.count}
              </span>
            ))}
          </div>
          <p style={{ margin: `${spacing.sm} 0 0`, fontSize: 12, color: cockpitColors.textMuted }}>
            {roadmapFeed.totalClosed ?? 0} closed interventions feeding product priorities.
          </p>
        </VtPanel>
      ) : null}

      {scorecard ? (
        <VtPanel title="Pilot scorecard">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: spacing.sm }}>
              <ScorecardChip label="Eligible" metric={scorecard.eligibleEvents} />
              <ScorecardChip label="Detected" metric={scorecard.detectedEvents} />
              <ScorecardChip label="Completed" metric={scorecard.completed} />
              <ScorecardChip label="Automatic" metric={scorecard.automaticCompletions} />
              <ScorecardChip label="Rescued" metric={scorecard.operatorRescueCompletions} />
              <ScorecardChip label="Human min" metric={scorecard.humanMinutesTotal} />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>
              Median response: {formatScoreMetric(scorecard.medianResponseMinutes, "response")} · Interventions: {formatScoreMetric(scorecard.operatorInterventions)}
            </p>
            {scorecard.exceptionsByCategory?.length ? (
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                {scorecard.exceptionsByCategory.slice(0, 5).map((row) => (
                  <span
                    key={row.category}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      fontSize: 12,
                      fontWeight: 650,
                    }}
                  >
                    {row.category.replace(/_/g, " ")} · {row.count}
                  </span>
                ))}
              </div>
            ) : null}
            {scorecard.honesty?.message ? (
              <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>{scorecard.honesty.message}</p>
            ) : null}
          </div>
        </VtPanel>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, color: cockpitColors.warning }}>{error}</p>
      ) : null}
      {message ? (
        <p style={{ margin: 0, color: cockpitColors.handled }}>{message}</p>
      ) : null}

      <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)" }}>
        <VtPanel
          title="Open cases"
          right={allOpen.length ? <StatusBadge label={`${allOpen.length} open`} tone="warning" /> : null}
        >
          {!allOpen.length ? (
            <VtEmpty label="No cross-client exceptions right now." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {allOpen.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      textAlign: "left",
                      padding: spacing.md,
                      borderRadius: radius.medium,
                      border: `1px solid ${active ? cockpitColors.accent : cockpitColors.panelBorder}`,
                      background: active ? "rgba(15,118,110,.06)" : cockpitColors.panel,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <strong style={{ fontSize: 14 }}>{item.title || item.summary}</strong>
                      <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                        <StatusBadge label={String(item.urgency ?? item.kind ?? "open")} tone="warning" />
                        <SlaCountdown payload={item.payload} createdAt={item.createdAt} />
                      </div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: cockpitColors.textSecondary }}>
                      {[item.businessName, item.kind?.replace(/_/g, " "), item.summary].filter(Boolean).join(" · ")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </VtPanel>

        <VtPanel title="Case detail">
          {!selected ? (
            <VtEmpty label="Select a case to see the trace and resolve with a root cause." />
          ) : (
            <div style={{ display: "grid", gap: spacing.md }}>
              <div>
                <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize }}>{selected.title}</h2>
                <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textSecondary, fontSize: 13 }}>
                  {selected.summary}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <SlaCountdown payload={selected.payload} createdAt={selected.createdAt} large />
                {selected.supportHref ? (
                  <Button asChild size="sm">
                    <Link href={selected.supportHref}>Take over (support enter)</Link>
                  </Button>
                ) : null}
                {selected.href ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={selected.href}>Open detail</Link>
                  </Button>
                ) : null}
                {selected.workspaceHref ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={selected.workspaceHref}>Open workspace</Link>
                  </Button>
                ) : null}
                {selected.businessId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/businesses/${encodeURIComponent(selected.businessId)}`}>Admin business</Link>
                  </Button>
                ) : null}
              </div>

              {selected.steps?.length ? (
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                  {selected.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}

              {selected.contractVersion ? (
                <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>
                  Contract {selected.contractVersion}
                  {selected.contentHash ? ` · hash ${String(selected.contentHash).slice(0, 12)}…` : ""}
                </p>
              ) : null}

              {trace?.rft ? (
                <VtCard padding={12}>
                  <strong style={{ fontSize: 13 }}>RFT trace</strong>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: cockpitColors.textSecondary }}>
                    State {trace.rft.rft?.state} · {trace.rft.title}
                  </p>
                  <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
                    {(trace.rft.rft?.history ?? []).slice(-8).map((h: any, i: number) => (
                      <li key={`${h.at}_${i}`}>
                        {h.from ?? "—"} → {h.to} {h.note ? `(${h.note})` : ""}
                      </li>
                    ))}
                  </ol>
                  {(trace.rft.rft?.evidence ?? []).length ? (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
                      {trace.rft.rft.evidence.map((ev: any, i: number) => (
                        <li key={`${ev.providerId}_${i}`}>
                          <code>{ev.kind}</code>: {ev.providerId}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </VtCard>
              ) : null}

              {trace?.specialtyFire ? (
                <VtCard padding={12}>
                  <strong style={{ fontSize: 13 }}>Specialty fire</strong>
                  <pre style={{ margin: "8px 0 0", fontSize: 11, overflow: "auto" }}>
                    {JSON.stringify(trace.specialtyFire, null, 2)}
                  </pre>
                </VtCard>
              ) : null}

              <div style={{ display: "grid", gap: spacing.sm, paddingTop: spacing.sm, borderTop: `1px solid ${cockpitColors.panelBorder}` }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                  Root cause (required)
                  <select
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      background: cockpitColors.inset,
                    }}
                  >
                    <option value="">Select…</option>
                    {rootCauseOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                  Minutes spent (required)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minutesSpent}
                    onChange={(e) => setMinutesSpent(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      background: cockpitColors.inset,
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                  Action performed
                  <textarea
                    value={actionPerformed}
                    onChange={(e) => setActionPerformed(e.target.value)}
                    rows={2}
                    style={{
                      padding: 10,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      background: cockpitColors.inset,
                      resize: "vertical",
                    }}
                  />
                </label>
                <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                    Necessary?
                    <select
                      value={wasNecessary}
                      onChange={(e) => setWasNecessary(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: radius.medium,
                        border: `1px solid ${cockpitColors.panelBorder}`,
                        background: cockpitColors.inset,
                      }}
                    >
                      <option value="">Select…</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                    Automatable?
                    <select
                      value={canAutomate}
                      onChange={(e) => setCanAutomate(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: radius.medium,
                        border: `1px solid ${cockpitColors.panelBorder}`,
                        background: cockpitColors.inset,
                      }}
                    >
                      <option value="">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                    Labor cost class
                    <select
                      value={laborCostClass}
                      onChange={(e) => setLaborCostClass(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: radius.medium,
                        border: `1px solid ${cockpitColors.panelBorder}`,
                        background: cockpitColors.inset,
                      }}
                    >
                      <option value="">Select…</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                  Resolution outcome
                  <textarea
                    value={resolutionOutcome}
                    onChange={(e) => setResolutionOutcome(e.target.value)}
                    rows={2}
                    style={{
                      padding: 10,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      background: cockpitColors.inset,
                      resize: "vertical",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>
                  Notes
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    style={{
                      padding: 10,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      background: cockpitColors.inset,
                      resize: "vertical",
                    }}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !rootCause || !minutesSpent.trim()}
                  onClick={() => void resolveCase()}
                >
                  {busy ? "Closing…" : "Resolve with root cause"}
                </Button>
              </div>
            </div>
          )}
        </VtPanel>
      </div>
    </div>
  );
}

function parseNullableBoolean(value: string) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function SlaCountdown({
  payload,
  createdAt,
  large = false,
}: {
  payload?: Record<string, unknown> | null;
  createdAt?: string | null;
  large?: boolean;
}) {
  const slaMinutes = Number(payload?.slaMinutes ?? 0);
  const ageMinutes = Number(payload?.ageMinutes ?? NaN);
  const deadlineAt = payload?.slaDeadlineAt ? String(payload.slaDeadlineAt) : null;
  const createdMs = createdAt ? Date.parse(String(createdAt)) : NaN;
  const deadlineMs = deadlineAt
    ? Date.parse(deadlineAt)
    : (Number.isFinite(createdMs) && slaMinutes > 0 ? createdMs + slaMinutes * 60_000 : NaN);

  let label = "";
  let tone: "ok" | "warn" | "critical" = "ok";
  if (Number.isFinite(deadlineMs)) {
    const remainingMin = Math.round((deadlineMs - Date.now()) / 60_000);
    if (remainingMin >= 0) {
      label = `${remainingMin}m left`;
      tone = remainingMin <= Math.max(1, Math.round(slaMinutes * 0.25)) ? "warn" : "ok";
    } else {
      label = `Overdue ${Math.abs(remainingMin)}m`;
      tone = "critical";
    }
  } else if (Number.isFinite(ageMinutes) && slaMinutes > 0) {
    const remaining = Math.round(slaMinutes - ageMinutes);
    if (remaining >= 0) {
      label = `${remaining}m left`;
      tone = remaining <= Math.max(1, Math.round(slaMinutes * 0.25)) ? "warn" : "ok";
    } else {
      label = `Overdue ${Math.abs(remaining)}m`;
      tone = "critical";
    }
  } else if (Number.isFinite(ageMinutes)) {
    label = `${Math.round(ageMinutes)}m open`;
    tone = "warn";
  } else {
    return null;
  }

  const color = tone === "critical"
    ? cockpitColors.critical
    : tone === "warn"
      ? cockpitColors.warning
      : cockpitColors.handled;

  return (
    <span
      style={{
        fontSize: large ? 13 : 11,
        fontWeight: 700,
        color,
        whiteSpace: "nowrap",
      }}
      title={slaMinutes ? `Acknowledge SLA ${slaMinutes}m` : "Case age"}
    >
      SLA · {label}
    </span>
  );
}

function ScorecardChip({ label, metric }: { label: string; metric?: ScoreMetric }) {
  return (
    <div
      style={{
        padding: spacing.sm,
        borderRadius: radius.medium,
        border: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ fontSize: 11, color: cockpitColors.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
        {formatScoreMetric(metric)}
      </div>
    </div>
  );
}

function formatScoreMetric(metric?: ScoreMetric, mode: "default" | "response" = "default") {
  if (!metric || metric.status !== "observable") {
    return "Not observable";
  }
  if (mode === "response" && metric.currentMedianMinutes != null) {
    return `${Math.round(metric.currentMedianMinutes)} min`;
  }
  if (metric.minutes != null) return `${metric.minutes}`;
  if (metric.count != null) return `${metric.count}`;
  return "—";
}
