"use client";

import { useState } from "react";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { spacing, typography, cockpitColors } from "@/design/tokens";

export default function CreateBusinessModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/platform/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerEmail }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create business.");
      return;
    }
    setSuccess(`Created ${data.business.name}. Owner invitation ${data.invitation.emailSent ? "sent" : "recorded for development"}.`);
    onCreated();
  }

  return (
    <SimpleModal
      title="Create business"
      onClose={onClose}
      footer={
        success ? (
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        ) : (
          <>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={submit}>{busy ? "Creating…" : "Create & invite owner"}</PrimaryButton>
          </>
        )
      }
    >
      {success ? (
        <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: 0 }}>{success}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Business name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Owner email</span>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }} />
          </label>
          {error ? <p style={{ color: "#dc2626", margin: 0 }}>{error}</p> : null}
        </div>
      )}
    </SimpleModal>
  );
}
