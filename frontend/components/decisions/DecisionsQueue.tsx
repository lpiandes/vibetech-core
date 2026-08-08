"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import StatusPill from "@/components/executive/StatusPill";
import { Button } from "@/components/ui/button";
import { cockpitColors, spacing, typography, radius, semanticColors } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

function priorityTone(p: string): "danger" | "warning" | "neutral" {
  if (p === "critical") return "danger";
  if (p === "high" || p === "warning") return "warning";
  return "neutral";
}

export type DecisionAttentionItem = {
  id?: string;
  title?: string;
  summary?: string;
  reason?: string;
  businessImpact?: string;
  recommendedAction?: string | { label?: string };
  priority?: string;
  priorityBadge?: string;
  approvalId?: string;
  sourceId?: string;
  sourceType?: string;
  partyId?: string;
  partyName?: string | null;
  subjectName?: string | null;
  availableActions?: Array<{ id?: string; label?: string; href?: string }>;
  evidence?: Array<{ kind?: string; providerId?: string; detail?: string; source?: string }>;
  knowledgeCited?: string[] | string | null;
  ifApproved?: string | null;
  ifRejected?: string | null;
  waitingDuration?: string | null;
  explanation?: string | null;
  confidenceReason?: string | null;
};

/**
 * Managerial judgment queue — Full Plan §3B.
 */
export default function DecisionsQueue({
  items,
  businessId,
  emptyMessage = "Nothing requires your judgment. VIBETech is operating routine work.",
}: {
  items: DecisionAttentionItem[];
  businessId: string;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const queue = safeArray(items).filter((item) => String(item?.sourceType ?? "") !== "intelligence_candidate");

  const handleApproval = useCallback(
    async (approvalId: string, decision: string, extra: Record<string, unknown> = {}) => {
      if (!businessId) {
        setActionError("Missing business context — refresh and try again.");
        return;
      }
      setActionError(null);
      setActionNotice(null);
      setPendingId(approvalId);
      try {
        const res = await fetch(`/api/approvals/${approvalId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, businessId, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          setActionError(String(data.error ?? "Could not save your decision."));
          return;
        }
        if (data?.fulfillment?.message) {
          setActionNotice(String(data.fulfillment.message));
        }
        router.refresh();
      } catch {
        setActionError("Network error — try again.");
      } finally {
        setPendingId(null);
      }
    },
    [router, businessId],
  );

  if (!queue.length) {
    return (
      <div
        style={{
          padding: spacing.lg,
          color: cockpitColors.textMuted,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
          display: "grid",
          gap: spacing.sm,
        }}
      >
        <div>{emptyMessage}</div>
        {businessId ? (
          <p style={{ margin: 0, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
            Need a judgment card to practice? Open{" "}
            <Link href={`/b/${encodeURIComponent(businessId)}/home`} style={{ color: cockpitColors.accent, fontWeight: 650 }}>
              Today
            </Link>{" "}
            and create a test decision — Approve and send runs the real outbound path.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      {actionError ? (
        <div
          style={{
            padding: spacing.sm,
            borderRadius: radius.medium,
            border: `1px solid ${semanticColors.criticalBorder ?? "#fecaca"}`,
            backgroundColor: "rgba(248,113,113,0.12)",
            color: cockpitColors.critical ?? "#b91c1c",
            fontSize: 13,
            fontWeight: 650,
          }}
          role="alert"
        >
          {actionError}
        </div>
      ) : null}
      {actionNotice ? (
        <div
          style={{
            padding: spacing.sm,
            borderRadius: radius.medium,
            border: `1px solid rgba(52,211,153,0.35)`,
            backgroundColor: "rgba(52,211,153,0.12)",
            color: cockpitColors.handled,
            fontSize: 13,
            fontWeight: 650,
            lineHeight: 1.45,
          }}
          role="status"
        >
          {actionNotice}
        </div>
      ) : null}

      {queue.map((item) => {
        const approveAction = item.availableActions?.find((a) => a.id === "approve");
        const rejectAction = item.availableActions?.find((a) => a.id === "reject");
        const editAction = item.availableActions?.find((a) => a.id === "edit" || /edit/i.test(String(a.label ?? "")));
        const assignAction = item.availableActions?.find((a) => a.id === "assign" || /assign/i.test(String(a.label ?? "")));
        const reviewAction = item.availableActions?.find(
          (a) => a.href && !["approve", "reject", "edit", "assign"].includes(String(a.id)),
        );
        const approvalKey = String(item.approvalId ?? item.sourceId ?? item.id ?? "");
        const busy = pendingId === approvalKey;
        const evidence = safeArray(item.evidence);
        const workHref = item.availableActions?.find((a) => a.id === "edit" || a.id === "review_approval")?.href
          ?? (item.sourceType === "work" && item.sourceId && businessId
            ? `/b/${encodeURIComponent(businessId)}/work?workId=${encodeURIComponent(String(item.sourceId))}`
            : null)
          ?? null;
        const editHref = workHref;
        const knows = [
          item.partyName ? `Contact: ${item.partyName}` : null,
          item.subjectName ? `Subject: ${item.subjectName}` : null,
          item.explanation ?? item.confidenceReason ?? null,
          Array.isArray(item.knowledgeCited) ? item.knowledgeCited.join("; ") : item.knowledgeCited,
        ].filter(Boolean);
        const proposed = typeof item.recommendedAction === "object"
          ? item.recommendedAction?.label
          : item.recommendedAction;
        const ifApproved = item.ifApproved
          ?? (approveAction ? "VIBETech will send the approved action and continue the Operating Contract." : null);
        const ifRejected = item.ifRejected
          ?? (rejectAction ? "Outbound is blocked; the case stays open for your alternative instruction." : null);

        return (
          <article
            key={String(item.id)}
            style={{
              padding: spacing.lg,
              borderRadius: radius.large,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.panel,
              display: "grid",
              gap: spacing.sm,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
                {item.title}
              </h3>
              {item.priority ? (
                <StatusPill tone={priorityTone(item.priorityBadge ?? item.priority)} label={item.priority} />
              ) : null}
            </div>

            <Field label="What happened" value={item.summary} />
            {knows.length ? (
              <div>
                <Label>What VIBETech knows</Label>
                <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: spacing.lg, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize, lineHeight: 1.5 }}>
                  {knows.map((line) => (
                    <li key={String(line)}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {evidence.length ? (
              <div>
                <Label>Evidence</Label>
                <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: spacing.lg, color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize, lineHeight: 1.5 }}>
                  {evidence.slice(0, 8).map((e, i) => (
                    <li key={`${e.kind}_${e.providerId}_${i}`}>
                      {e.kind ?? "evidence"}
                      {e.providerId ? `: ${e.providerId}` : ""}
                      {e.detail ? ` — ${e.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Field label="Why it cannot proceed automatically" value={item.reason} />
            <Field label="Proposed action" value={proposed} />
            <Field label="If approved" value={ifApproved} />
            <Field label="If rejected" value={ifRejected} />
            <Field
              label="Deadline / SLA risk"
              value={[item.businessImpact, item.waitingDuration ? `Waiting ${item.waitingDuration}` : null].filter(Boolean).join(" · ") || null}
              tone="warning"
            />

            <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
              {approveAction ? (
                <Button type="button" size="sm" disabled={busy} onClick={() => void handleApproval(approvalKey, "GRANT", { reasonCode: "approved_as_proposed" })}>
                  {busy ? "Sending…" : "Approve and send"}
                </Button>
              ) : null}
              {editAction?.href || editHref ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={editAction?.href || editHref || "#"}>{editAction?.label ?? "Edit"}</Link>
                </Button>
              ) : reviewAction?.href && /edit|draft|work/i.test(String(reviewAction.label ?? reviewAction.href)) ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={reviewAction.href}>Edit</Link>
                </Button>
              ) : null}
              {assignAction?.href ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={assignAction.href}>{assignAction.label ?? "Assign only"}</Link>
                </Button>
              ) : item.sourceType === "work" && businessId ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/b/${encodeURIComponent(businessId)}/work`}>Assign only</Link>
                </Button>
              ) : null}
              {rejectAction ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleApproval(approvalKey, "REJECT", { reasonCode: "rejected_outright" })}
                >
                  Reject
                </Button>
              ) : null}
              {reviewAction?.href && !/edit|draft/i.test(String(reviewAction.label ?? "")) ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={reviewAction.href}>{reviewAction.label ?? "Review"} →</Link>
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string | null;
  tone?: "warning";
}) {
  if (!value) return null;
  return (
    <div>
      <Label>{label}</Label>
      <p
        style={{
          margin: `${spacing.xs} 0 0`,
          color: tone === "warning" ? cockpitColors.warning : cockpitColors.textSecondary,
          fontSize: typography.meta.fontSize,
          lineHeight: 1.5,
        }}
      >
        {value}
      </p>
    </div>
  );
}
