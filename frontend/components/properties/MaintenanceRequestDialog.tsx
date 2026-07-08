"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

const URGENCY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function MaintenanceRequestDialog({
  businessId,
  subjectId,
  propertyName,
  onClose,
}: {
  businessId: string;
  subjectId: string;
  propertyName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("high");
  const [permissionToContact, setPermissionToContact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !description.trim() || submittingRef.current) return;

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/maintenance-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          description: description.trim(),
          subjectId,
          urgency,
          permissionToContact,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not submit maintenance request."));
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
    <SimpleModal title="Report maintenance issue" onClose={onClose}>
      <p
        style={{
          margin: `0 0 ${spacing.md}px`,
          color: cockpitColors.textSecondary,
          fontSize: typography.caption.fontSize,
          lineHeight: 1.5,
        }}
      >
        Submit a maintenance request for {propertyName}. Our Maintenance Coordinator will create coordination
        work and follow up when contact is permitted.
      </p>
      <form id="maintenance-request-form" onSubmit={onSubmit} style={{ display: "grid", gap: spacing.md }}>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Resident name</span>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Phone (optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>What is the issue?</span>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the maintenance issue"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              resize: "vertical",
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <span style={{ fontWeight: 600, fontSize: typography.caption.fontSize }}>Urgency</span>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
            }}
          >
            {URGENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: spacing.sm,
            fontSize: typography.caption.fontSize,
            color: cockpitColors.textSecondary,
          }}
        >
          <input
            type="checkbox"
            checked={permissionToContact}
            onChange={(e) => setPermissionToContact(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>I permit the property manager to contact me about this maintenance request by email.</span>
        </label>
        {error ? (
          <div style={{ color: "#b91c1c", fontSize: typography.caption.fontSize }}>{error}</div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit request"}
          </PrimaryButton>
        </div>
      </form>
    </SimpleModal>
  );
}
