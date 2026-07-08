"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function AddPropertyDialog({
  businessId,
  title,
  onClose,
}: {
  businessId: string;
  title: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !displayName.trim() || submittingRef.current) return;

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "listing",
          displayName: displayName.trim(),
          address: address.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not create property."));
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
    <SimpleModal title={title} onClose={onClose}>
      <form id="add-property-form" onSubmit={onSubmit} style={{ display: "grid", gap: spacing.md }}>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Display name</span>
          <input
            required
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="123 Main Street"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Address (optional)</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Springfield"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          />
        </label>
        {error ? (
          <p style={{ color: "#b91c1c", margin: 0, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>{error}</p>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy || !displayName.trim()}>
            {busy ? "Saving…" : "Add property"}
          </PrimaryButton>
        </div>
      </form>
    </SimpleModal>
  );
}
