"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors, spacing } from "@/design/tokens";

export default function SupportEnterForm({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"read_only" | "elevated">("read_only");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/support/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, reason, mode }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.ok) {
      setError(data.reason ?? data.error ?? "Unable to enter support access");
      return;
    }
    router.push(`/b/${businessId}/home`);
    router.refresh();
  }

  async function exit() {
    setBusy(true);
    await fetch("/api/admin/support/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <div style={{ color: cockpitColors.textMuted, fontSize: 13 }}>
        Enter {businessName} with an audited support session. Your admin identity is retained.
      </div>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for support access (required)"
        rows={3}
        style={{
          width: "100%",
          borderRadius: 8,
          border: `1px solid ${cockpitColors.panelBorder}`,
          padding: spacing.sm,
          fontFamily: "inherit",
        }}
      />
      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as "read_only" | "elevated")}
        style={{ padding: spacing.sm, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
      >
        <option value="read_only">Read-only</option>
        <option value="elevated">Elevated (still audited, no permanent membership)</option>
      </select>
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      <div style={{ display: "flex", gap: spacing.sm }}>
        <PrimaryButton onClick={enter} disabled={busy || !reason.trim()}>
          Enter support
        </PrimaryButton>
        <button type="button" onClick={exit} disabled={busy} style={{ padding: "8px 12px" }}>
          Exit support
        </button>
      </div>
    </div>
  );
}
