"use client";

import { useState } from "react";

import { cockpitColors, radius, spacing, typography } from "@/design/tokens";
import type { WorkQueueItem } from "./workQueueSemantics";
import { channelPermissionLabel } from "./relationshipFollowUpDraftSemantics";

type DraftResult = {
  draft?: { subject?: string; body?: string; metadata?: Record<string, any> };
  context?: Record<string, any>;
  idempotent?: boolean;
};

export default function RelationshipFollowUpDraftDialog({
  businessId,
  work,
  onClose,
}: {
  businessId: string;
  work: WorkQueueItem;
  onClose: () => void;
}) {
  const [result, setResult] = useState<DraftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function prepareDraft() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/relationship-followups/work/${encodeURIComponent(String(work.id))}/draft`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Could not prepare draft."));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare draft.");
    } finally {
      setLoading(false);
    }
  }

  const guidance = result?.draft?.metadata?.workAssistanceDraft?.channelGuidance ?? result?.context?.channelGuidance ?? null;
  const knowledge = result?.context?.knowledgeSources ?? [];
  const property = result?.context?.property ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        backgroundColor: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <div style={{ width: "min(760px, 100%)", backgroundColor: cockpitColors.panel, borderRadius: radius.large, border: `1px solid ${cockpitColors.panelBorder}`, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.24)" }}>
        <div style={{ padding: spacing.lg, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
          <div style={{ fontSize: typography.sectionTitle.fontSize, fontWeight: 700, color: cockpitColors.textPrimary }}>Follow-up draft assistance</div>
          <div style={{ marginTop: 4, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
            Drafts are review-only. Nothing is sent from this action.
          </div>
        </div>

        <div style={{ padding: spacing.lg, display: "grid", gap: spacing.md }}>
          {!result ? (
            <button
              type="button"
              onClick={prepareDraft}
              disabled={loading}
              style={{ justifySelf: "start", borderRadius: radius.medium, border: `1px solid ${cockpitColors.accent}`, backgroundColor: cockpitColors.accent, color: "#fff", padding: "9px 12px", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}
            >
              {loading ? "Preparing..." : "Prepare draft"}
            </button>
          ) : (
            <>
              <div>
                <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, fontWeight: 700 }}>Subject</div>
                <div style={{ marginTop: 4, color: cockpitColors.textPrimary }}>{result.draft?.subject}</div>
              </div>
              <div>
                <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, fontWeight: 700 }}>Draft</div>
                <pre style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit", color: cockpitColors.textPrimary, lineHeight: 1.5 }}>{result.draft?.body}</pre>
              </div>
              <div style={{ display: "grid", gap: 6, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>
                <div>Recommended channel: {String(guidance?.recommendedChannel ?? "email")}</div>
                <div>Email: {channelPermissionLabel(guidance?.email)}</div>
                <div>SMS: {channelPermissionLabel(guidance?.sms)}</div>
                {property ? <div>Property context: {String(property.displayName ?? property.value ?? "Linked property")}</div> : null}
                {knowledge.length ? <div>Knowledge: {knowledge.map((doc: any) => String(doc.title)).join(", ")}</div> : null}
              </div>
            </>
          )}

          {error ? <div style={{ color: cockpitColors.warning, fontSize: typography.caption.fontSize }}>{error}</div> : null}
        </div>

        <div style={{ padding: spacing.md, borderTop: `1px solid ${cockpitColors.panelBorder}`, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ borderRadius: radius.medium, border: `1px solid ${cockpitColors.panelBorder}`, backgroundColor: cockpitColors.panel, padding: "8px 12px", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
