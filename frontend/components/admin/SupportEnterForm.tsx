"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { vtInputStyle } from "@/components/product/VtChrome";
import { cockpitColors, spacing } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";

export default function SupportEnterForm({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"read_only" | "elevated">("elevated");
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
      setError(formatProductErrorMessage(data.productError ?? data.reason ?? data.error ?? "Unable to enter support access"));
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
    router.push("/admin/businesses");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <div style={{ color: cockpitColors.textMuted, fontSize: 13 }}>
        Custom reason / read-only mode if you need it. Default open uses full edit.
      </div>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for support access (required)"
        rows={3}
        style={{ ...vtInputStyle, fontFamily: "inherit", fontWeight: 500, resize: "vertical" }}
      />
      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as "read_only" | "elevated")}
        style={{ ...vtInputStyle, fontWeight: 600 }}
      >
        <option value="elevated">Full edit (audited)</option>
        <option value="read_only">Read-only</option>
      </select>
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <PrimaryButton onClick={enter} disabled={busy || !reason.trim()}>
          Enter with custom reason
        </PrimaryButton>
        <SecondaryButton onClick={exit} disabled={busy}>
          Exit support
        </SecondaryButton>
      </div>
    </div>
  );
}
