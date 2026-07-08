"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function ShowingCoordinationDialog({
  businessId,
  requestId,
  contactName,
  propertyName,
  onClose,
}: {
  businessId: string;
  requestId: string;
  contactName: string;
  propertyName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [preferredTiming, setPreferredTiming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || submittingRef.current) return;

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/showing-coordination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          note: note.trim() || undefined,
          preferredTiming: preferredTiming.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not request showing coordination."));
        setBusy(false);
        submittingRef.current = false;
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <SimpleModal title="Request showing" onClose={onClose}>
      <p
        style={{
          margin: `0 0 ${spacing.md}px`,
          color: cockpitColors.textSecondary,
          fontSize: typography.caption.fontSize,
          lineHeight: 1.5,
        }}
      >
        Qualify {contactName} for a showing at {propertyName}. This creates showing coordination work for the
        Resident &amp; Prospect Coordinator without sending email or scheduling a calendar event.
      </p>
      <form id="showing-coordination-form" onSubmit={onSubmit} style={{ display: "grid", gap: spacing.md }}>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Qualification note</span>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Capture showing preferences, availability, or next steps"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              resize: "vertical",
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>
            Preferred timing (optional)
          </span>
          <input
            value={preferredTiming}
            onChange={(e) => setPreferredTiming(e.target.value)}
            placeholder="e.g. weekday evenings"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          />
        </label>
        {error ? (
          <div style={{ color: "#b91c1c", fontSize: typography.caption.fontSize }}>{error}</div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Request showing"}
          </PrimaryButton>
        </div>
      </form>
    </SimpleModal>
  );
}
