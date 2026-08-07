"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Proposal = {
  proposalId: string;
  status: string;
  reasonCode: string;
  reasonLabel?: string;
  correctionCount?: number;
  note?: string | null;
  suggestedPatch?: { title?: string; body?: string; kind?: string } | null;
  replay?: { passed?: boolean; passDetail?: string | null } | null;
};

type RuleVersion = {
  ruleId: string;
  version: number;
  status: string;
  reasonCode: string;
  title?: string;
  body?: string | null;
  approvedAt?: string;
};

type LearningState = {
  corrections?: unknown[];
  proposals?: Proposal[];
  ruleVersions?: RuleVersion[];
};

/**
 * Owner surface for Plan 10 — propose → replay → approve → version → rollback.
 * Never auto-applies.
 */
export default function GovernedLearningPanel({ businessId }: { businessId: string }) {
  const [learning, setLearning] = useState<LearningState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = `/api/businesses/${encodeURIComponent(businessId)}/governed-learning`;

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(api, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      setError(json.error ?? json.message ?? "Could not load learning state.");
      return;
    }
    setLearning(json.learning ?? null);
  }, [api]);

  const post = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message ?? json.error ?? json.code ?? "Action failed.");
        return;
      }
      setLearning(json.learning ?? null);
    } finally {
      setBusy(null);
    }
  }, [api]);

  useEffect(() => {
    void load().then(() => post("refresh"));
  }, [load, post]);

  const proposals = (learning?.proposals ?? []).filter((p) =>
    ["proposed", "awaiting_replay", "awaiting_approval"].includes(p.status),
  );
  const activeRules = (learning?.ruleVersions ?? []).filter((r) => r.status === "active");
  const correctionCount = learning?.corrections?.length ?? 0;

  return (
    <section style={panelStyle} aria-label="Governed learning">
      <h2 style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 700 }}>
        Suggested improvements
      </h2>
      <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
        Corrections are classified and counted. When a class repeats, VIBETech proposes a Company Rule
        here — never applied until you approve after replay.
      </p>
      <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
        {correctionCount} correction{correctionCount === 1 ? "" : "s"} recorded
      </p>

      {error ? (
        <p style={{ margin: `${spacing.sm} 0 0`, color: cockpitColors.critical, fontSize: typography.meta.fontSize }}>
          {error}
        </p>
      ) : null}

      {!proposals.length ? (
        <div style={{ marginTop: spacing.md, display: "grid", gap: spacing.sm }}>
          <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
            No repeating corrections yet — reject or edit decisions a few times and matching patterns become rule proposals here. Or confirm a rule via Ask above.
          </p>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button asChild variant="outline" size="sm">
              <a href={`/b/${encodeURIComponent(businessId)}/intelligence`}>Review Decisions</a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={`/b/${encodeURIComponent(businessId)}/architect?prompt=${encodeURIComponent("What Company Rules should we confirm from how we operate today?")}`}>
                Ask to confirm rules
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: spacing.md, marginTop: spacing.md }}>
          {proposals.map((p) => (
            <article
              key={p.proposalId}
              style={{
                padding: spacing.md,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                display: "grid",
                gap: spacing.sm,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                <strong>{p.suggestedPatch?.title ?? p.reasonLabel ?? p.reasonCode}</strong>
                <span style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textMuted }}>
                  {p.correctionCount ?? 0}× · {p.status.replace(/_/g, " ")}
                </span>
              </div>
              {p.suggestedPatch?.body || p.note ? (
                <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
                  {p.suggestedPatch?.body ?? p.note}
                </p>
              ) : null}
              {p.replay?.passDetail ? (
                <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
                  Replay: {p.replay.passDetail}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => post("replay", { proposalId: p.proposalId })}
                >
                  Preview historical impact
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null || !p.replay?.passed}
                  onClick={() => post("approve", { proposalId: p.proposalId })}
                >
                  Approve rule
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => post("reject", { proposalId: p.proposalId })}
                >
                  Dismiss
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeRules.length > 0 ? (
        <div style={{ marginTop: spacing.lg, display: "grid", gap: spacing.sm }}>
          <h3 style={{ margin: 0, fontSize: typography.meta.fontSize, fontWeight: 700 }}>
            Active Company Rules (versioned)
          </h3>
          {activeRules.map((r) => (
            <div
              key={r.ruleId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.md,
                flexWrap: "wrap",
                alignItems: "center",
                padding: spacing.sm,
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
              }}
            >
              <div>
                <strong style={{ fontSize: typography.meta.fontSize }}>
                  v{r.version} · {r.title ?? r.reasonCode}
                </strong>
                {r.body ? (
                  <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>
                    {r.body}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => post("rollback", { ruleId: r.ruleId })}
              >
                Rollback
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const panelStyle = {
  padding: spacing.lg,
  borderRadius: radius.large,
  background: cockpitColors.panel,
  border: `1px solid ${cockpitColors.panelBorder}`,
} as const;
