"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { architect } from "./architectTheme";

export type ActionDraft = {
  type?: string;
  status?: "needs_confirmation" | "preview_only" | string;
  employeeId?: string | null;
  patch?: Record<string, unknown>;
  applyPath?: string | null;
  confirmHref?: string | null;
  href?: string | null;
  note?: string | null;
};

/**
 * Ask operating-command draft — Confirm applies via operating-contract PATCH + learning capture.
 * preview_only never mutates.
 */
export default function ActionDraftCard({ draft, businessId, onDismiss }: {
  draft: ActionDraft;
  businessId: string;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [workCreated, setWorkCreated] = useState(false);

  const isPreview = draft.status === "preview_only";
  const needsConfirm = draft.status === "needs_confirmation";
  const previewHref = draft.confirmHref ?? draft.href ?? `/b/${encodeURIComponent(businessId)}/knowledge`;

  if (!needsConfirm && !isPreview) return null;

  function workTitleForDraft() {
    if (draft.type === "rft_sla_patch") return "Review operating-contract SLA draft";
    if (draft.type === "rft_exception_owner_patch") return "Review operating-contract coverage draft";
    if (draft.type === "rft_approval_policy_preview") return "Review operating-policy preview";
    return "Review Ask operating draft";
  }

  async function createWork() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: workTitleForDraft(),
          description: draft.note ?? "Follow up on this Ask draft.",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(String(data.error ?? "Could not create follow-up work."));
        return;
      }
      setWorkCreated(true);
      const workHref = data.workItemId
        ? `/b/${encodeURIComponent(businessId)}/work?workId=${encodeURIComponent(String(data.workItemId))}`
        : `/b/${encodeURIComponent(businessId)}/work`;
      router.push(workHref);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function previewDraft() {
    router.push(previewHref);
  }

  async function confirmDraft() {
    const employeeId = draft.employeeId;
    const applyPath = draft.applyPath
      ?? (employeeId
        ? `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employeeId)}/operating-contract`
        : null);
    if (!applyPath || !draft.patch) {
      setError("This draft cannot be applied from Ask — open Company Rules.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const patch = draft.patch as Record<string, unknown>;
      const res = await fetch(applyPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patch,
          fromAsk: true,
          learningCorrection: {
            reasonCode: "owner_preference",
            note: `Confirmed Ask draft: ${draft.type ?? "operating_change"}`,
            approved: patch,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setError(String(data.error ?? "Could not apply this change."));
        return;
      }
      setApplied(true);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${isPreview ? architect.border : "rgba(20,184,166,.35)"}`,
        background: isPreview ? "rgba(15,23,42,.35)" : "rgba(20,184,166,.08)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 650, color: architect.ink }}>
        {isPreview ? "Preview only — nothing will change" : "Action draft — confirm to apply"}
      </div>
      {draft.note ? (
        <p style={{ margin: 0, fontSize: 13, color: architect.inkMuted, lineHeight: 1.45 }}>
          {draft.note}
        </p>
      ) : null}
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#fca5a5" }} role="alert">
          {error}
        </p>
      ) : null}
      {applied || workCreated ? (
        <p style={{ margin: 0, fontSize: 13, color: architect.accent }}>
          {applied
            ? "Applied — contract updated and learning captured."
            : "Work item created from this Ask draft."}
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {needsConfirm ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => void confirmDraft()}>
              {busy ? "Applying…" : "Apply draft"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={previewDraft}>
            Preview
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void createWork()}>
            Create work
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onDismiss?.()}
          >
            Do nothing
          </Button>
        </div>
      )}
    </div>
  );
}
