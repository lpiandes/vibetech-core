"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type LaunchStep = {
  status?: string;
  detail?: string | null;
  reason?: string | null;
  at?: string | null;
};

type LaunchView = {
  steps?: Record<string, LaunchStep>;
  summary?: {
    completeCount?: number;
    totalSteps?: number;
    canGoLive?: boolean;
    goLiveAt?: string | null;
    shadowEnabled?: boolean;
  };
  confirmedContentHash?: string | null;
  proveCardId?: string | null;
  goLiveAt?: string | null;
};

type ResponsibilityField = {
  field: string;
  label: string;
};

type ShadowProposal = {
  at?: string | null;
  eventType?: string | null;
  label?: string | null;
  reason?: string | null;
  workId?: string | null;
  stepId?: string | null;
  shadowProposal?: {
    channels?: string[];
    recipients?: Array<{ name?: string | null; email?: string | null; phone?: string | null }>;
    subject?: string | null;
    bodyPreview?: string | null;
  } | null;
};

const STEP_META: Array<{ id: string; label: string }> = [
  { id: "connect", label: "Connect email & calendar" },
  { id: "observe", label: "See how work happens" },
  { id: "confirm", label: "Confirm how you operate" },
  { id: "replay", label: "Review the replay" },
  { id: "shadow", label: "Try shadow mode" },
  { id: "prove", label: "Prove one real case" },
  { id: "goLive", label: "Go live" },
];

/**
 * Seven-step RFT outcome launch on Today.
 */
export default function RftLaunchPath({
  businessId,
  connectionStatuses = {},
  proofRecords = {},
}: {
  businessId: string;
  connectionStatuses?: Record<string, unknown>;
  proofRecords?: Record<string, unknown>;
}) {
  const base = `/b/${encodeURIComponent(businessId)}`;
  const [launch, setLaunch] = useState<LaunchView | null>(null);
  const [observation, setObservation] = useState<any>(null);
  const [replay, setReplay] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [responsibility, setResponsibility] = useState<Record<string, string>>({});
  const [responsibilityFields, setResponsibilityFields] = useState<ResponsibilityField[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/rft/launch`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not load launch path");
      return;
    }
    setLaunch(data.launch ?? null);
    setObservation(data.observation ?? null);
    setReplay(data.replay ?? null);
    setContract(data.contract ?? null);
    setResponsibility(data.responsibility ?? {});
    setResponsibilityFields(Array.isArray(data.responsibilityFields) ? data.responsibilityFields : []);
    setError(null);
  }, [businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh, connectionStatuses, proofRecords]);

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/rft/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(data.message ?? data.error ?? "Action failed");
      } else {
        const messages: Record<string, string> = {
          observe: "Baseline built from connected evidence.",
          confirm: "Responsibility confirmed.",
          replay: data.replay?.passDetail ?? "Replay finished.",
          enableShadow: "Shadow mode enabled — no external sends.",
          passShadow: "Shadow review passed.",
          prove: data.message ?? "Prove opportunity ready.",
          goLive: "Revenue Follow-Through is live (approval-gated).",
        };
        setMessage(messages[action] ?? "Updated.");
        if (data.launch) setLaunch(data.launch);
        if (data.observation) setObservation(data.observation);
        if (data.replay) setReplay(data.replay);
        await refresh();
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(null);
    }
  }

  const steps = launch?.steps ?? {};
  const completeCount = launch?.summary?.completeCount ?? 0;
  const totalSteps = launch?.summary?.totalSteps ?? 7;
  const baseline = observation?.baseline ?? null;

  return (
    <section
      style={{
        borderRadius: radius.large,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panel,
        padding: spacing.lg,
        display: "grid",
        gap: spacing.md,
      }}
      aria-label="Revenue Follow-Through launch"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
            Get Revenue Follow-Through live
          </h2>
          <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
            {completeCount}/{totalSteps} steps · Real evidence only
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={busy != null}>
          Refresh
        </Button>
      </div>

      {contract ? (
        <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
          {contract.slaSummary}. {contract.approvalSummary}.
        </p>
      ) : null}

      {baseline ? (
        <BaselineStrip baseline={baseline} outcomesHref={`${base}/outcomes`} />
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, color: cockpitColors.warning, fontSize: typography.meta.fontSize }}>{error}</p>
      ) : null}
      {message ? (
        <p style={{ margin: 0, color: cockpitColors.handled, fontSize: typography.meta.fontSize }}>{message}</p>
      ) : null}

      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: spacing.sm }}>
        {STEP_META.map((meta, index) => {
          const step = steps[meta.id] ?? { status: "pending" };
          const status = String(step.status ?? "pending");
          return (
            <li
              key={meta.id}
              style={{
                display: "grid",
                gap: 6,
                padding: spacing.md,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                background: status === "complete" ? "rgba(8,145,178,.08)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <strong style={{ fontSize: typography.body.fontSize }}>
                  {index + 1}. {meta.label}
                </strong>
                <StatusBadge status={status} />
              </div>
              <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
                {step.detail || step.reason || ""}
              </p>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                {meta.id === "connect" ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${base}/integrations`}>Open Connections</Link>
                  </Button>
                ) : null}
                {meta.id === "observe" && status !== "complete" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy != null || status === "pending"}
                    onClick={() => void runAction("observe")}
                  >
                    {busy === "observe" ? "Building baseline…" : "Build baseline"}
                  </Button>
                ) : null}
                {meta.id === "observe" && baseline ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${base}/outcomes`}>View on Outcomes</Link>
                  </Button>
                ) : null}
                {meta.id === "confirm" && status !== "complete" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy != null || status === "pending"}
                    onClick={() => void runAction("confirm", { responsibility })}
                  >
                    {busy === "confirm" ? "Confirming…" : "Confirm"}
                  </Button>
                ) : null}
                {meta.id === "replay" && status !== "complete" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy != null || status === "pending"}
                    onClick={() => void runAction("replay")}
                  >
                    {busy === "replay" ? "Replaying…" : "Run historical replay"}
                  </Button>
                ) : null}
                {meta.id === "shadow" && status !== "complete" ? (
                  <>
                    {!replay?.shadow?.enabled ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy != null || status === "pending"}
                        onClick={() => void runAction("enableShadow")}
                      >
                        {busy === "enableShadow" ? "Enabling…" : "Enable shadow"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy != null}
                        onClick={() => void runAction("passShadow", {
                          forceEmpty: !(replay?.shadow?.proposals?.length),
                        })}
                      >
                        {busy === "passShadow" ? "Saving…" : "Mark shadow passed"}
                      </Button>
                    )}
                  </>
                ) : null}
                {meta.id === "prove" && status !== "complete" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy != null}
                      onClick={() => void runAction("prove")}
                    >
                      {busy === "prove" ? "Seeding…" : "Seed prove opportunity"}
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${base}/integrations`}>Run channel prove</Link>
                    </Button>
                  </>
                ) : null}
                {meta.id === "prove" && launch?.proveCardId ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${base}/outcomes?cardId=${encodeURIComponent(launch.proveCardId)}`}>
                        Open in Outcomes
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${base}/work?cardId=${encodeURIComponent(launch.proveCardId)}`}>Open Work</Link>
                    </Button>
                  </>
                ) : null}
                {meta.id === "goLive" && status === "ready" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy != null}
                    onClick={() => void runAction("goLive")}
                  >
                    {busy === "goLive" ? "Going live…" : "Go live"}
                  </Button>
                ) : null}
              </div>
              {meta.id === "confirm" ? (
                <ResponsibilityForm
                  fields={responsibilityFields}
                  values={responsibility}
                  onChange={(field, value) =>
                    setResponsibility((current) => ({ ...current, [field]: value }))
                  }
                />
              ) : null}
              {meta.id === "replay" && replay?.lastReplay?.summary ? (
                <ReplaySummary summary={replay.lastReplay.summary} problems={replay.lastReplay.potentialProblems} />
              ) : null}
              {meta.id === "shadow" && replay?.shadow?.proposals?.length ? (
                <ShadowProposalList proposals={replay.shadow.proposals} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ResponsibilityForm({
  fields,
  values,
  onChange,
}: {
  fields: ResponsibilityField[];
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  if (!fields.length) return null;
  return (
    <div style={{ display: "grid", gap: spacing.sm, marginTop: spacing.sm }}>
      <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
        Fill any blanks, then confirm.
      </p>
      <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {fields.map((field) => (
          <label key={field.field} style={{ display: "grid", gap: 6, fontSize: typography.meta.fontSize, fontWeight: 650 }}>
            {field.label}
            <textarea
              value={values[field.field] ?? ""}
              onChange={(event) => onChange(field.field, event.target.value)}
              rows={3}
              style={{
                padding: 10,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                background: cockpitColors.inset,
                resize: "vertical",
                fontSize: typography.meta.fontSize,
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function BaselineStrip({ baseline, outcomesHref }: { baseline: any; outcomesHref: string }) {
  const metrics = baseline.metrics ?? {};
  const chips = [
    { label: "Opportunities", metric: metrics.opportunitiesDetected },
    { label: "Median first response", metric: metrics.firstResponse, format: "minutes" },
    { label: "Waiting >1 day", metric: metrics.waitingOverOneBusinessDay },
    { label: "Meetings w/o next step", metric: metrics.meetingsWithoutNextStep },
  ];
  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <strong style={{ fontSize: typography.meta.fontSize }}>Baseline ({baseline.windowDays}d)</strong>
        <Link href={outcomesHref} style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.accent, textDecoration: "none" }}>
          Full report →
        </Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: spacing.sm }}>
        {chips.map((chip) => (
          <div
            key={chip.label}
            style={{
              padding: spacing.sm,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          >
            <div style={{ fontSize: 11, color: cockpitColors.textMuted, fontWeight: 700 }}>{chip.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
              {formatMetric(chip.metric, chip.format)}
            </div>
          </div>
        ))}
      </div>
      {baseline.honesty?.message ? (
        <p style={{ margin: 0, fontSize: 11, color: cockpitColors.textMuted }}>{baseline.honesty.message}</p>
      ) : null}
    </div>
  );
}

function formatMetric(metric: any, format?: string) {
  if (!metric || metric.status === "not_observable") {
    return "Not observable";
  }
  if (format === "minutes") {
    const med = metric.medianMinutes;
    if (med == null) return "Not observable";
    return `${Math.round(med)} min`;
  }
  if (metric.count != null) return String(metric.count);
  return "—";
}

function ReplaySummary({ summary, problems }: { summary: any; problems?: any[] }) {
  return (
    <div style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary, display: "grid", gap: 4 }}>
      <span>
        Eligible {summary.eligible ?? 0} · Would auto {summary.wouldAutoComplete ?? 0} · Need approval {summary.wouldNeedApproval ?? 0} · Escalate {summary.wouldEscalate ?? 0}
      </span>
      <span>
        Reviewed {summary.eventCount ?? 0} event{summary.eventCount === 1 ? "" : "s"} · {summary.problemCount ?? 0} problem{summary.problemCount === 1 ? "" : "s"}
      </span>
      {Array.isArray(problems) && problems.length ? (
        <span>{problems.length} potential problem{problems.length === 1 ? "" : "s"} flagged (consent/owners/pricing).</span>
      ) : null}
    </div>
  );
}

function ShadowProposalList({ proposals }: { proposals: ShadowProposal[] }) {
  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
        {proposals.length} shadow proposal{proposals.length === 1 ? "" : "s"} recorded (read-only; no outbound sent).
      </p>
      <div style={{ display: "grid", gap: spacing.sm }}>
        {proposals.slice(0, 5).map((proposal, index) => {
          const recipients = Array.isArray(proposal.shadowProposal?.recipients)
            ? proposal.shadowProposal.recipients
            : [];
          const recipientLabels = recipients
            .map((recipient) => recipient.name || recipient.email || recipient.phone)
            .filter(Boolean);
          return (
            <div
              key={`${proposal.workId ?? "shadow"}_${proposal.stepId ?? index}_${proposal.at ?? index}`}
              style={{
                padding: spacing.sm,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                background: "rgba(15,23,42,.02)",
                display: "grid",
                gap: 4,
                fontSize: typography.meta.fontSize,
              }}
            >
              <strong style={{ color: cockpitColors.textPrimary }}>
                {proposal.label || proposal.shadowProposal?.subject || "Shadow proposal"}
              </strong>
              <span style={{ color: cockpitColors.textSecondary }}>
                {[humanizeEventType(proposal.eventType), proposal.at ? formatWhen(proposal.at) : null].filter(Boolean).join(" · ")}
              </span>
              {proposal.shadowProposal?.channels?.length ? (
                <span style={{ color: cockpitColors.textSecondary }}>
                  Channel{proposal.shadowProposal.channels.length === 1 ? "" : "s"}: {proposal.shadowProposal.channels.join(", ")}
                </span>
              ) : null}
              {recipientLabels.length ? (
                <span style={{ color: cockpitColors.textSecondary }}>
                  Recipient{recipientLabels.length === 1 ? "" : "s"}: {recipientLabels.join(", ")}
                </span>
              ) : null}
              {proposal.shadowProposal?.bodyPreview ? (
                <span style={{ color: cockpitColors.textMuted }}>
                  {proposal.shadowProposal.bodyPreview}
                </span>
              ) : null}
              {proposal.reason ? (
                <span style={{ color: cockpitColors.textMuted }}>
                  {proposal.reason.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "complete" ? "Done"
      : status === "ready" ? "Ready"
        : status === "blocked" ? "Later"
          : "Pending";
  const color =
    status === "complete" ? cockpitColors.handled
      : status === "ready" ? cockpitColors.accent
        : status === "blocked" ? cockpitColors.textMuted
          : cockpitColors.warning;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        color,
        background: "rgba(15,23,42,.04)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function humanizeEventType(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.replace(/_/g, " ");
}

function formatWhen(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
