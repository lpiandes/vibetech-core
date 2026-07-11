"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/product/PrimaryButton";
import { cockpitColors, spacing } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";

export default function ArchitectSessionCreateForm({ actorId }: { actorId: string }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/builder/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "internal_vibetech_build",
        businessName: businessName || null,
        businessId: businessId || null,
        actorId,
        description: businessName ? `Admin-created session for ${businessName}` : "Admin-created Architect session",
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || data.ok === false) {
      setError(formatProductErrorMessage(data.productError ?? data.error ?? data.reason ?? "Unable to create session"));
      return;
    }
    const sessionId = data.session?.sessionId ?? data.sessionId;
    if (sessionId) {
      router.push(`/architect/${sessionId}`);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, maxWidth: 480 }}>
      <input
        value={businessName}
        onChange={(event) => setBusinessName(event.target.value)}
        placeholder="Client / business name"
        style={{ padding: spacing.sm, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
      />
      <input
        value={businessId}
        onChange={(event) => setBusinessId(event.target.value)}
        placeholder="Existing business ID (optional)"
        style={{ padding: spacing.sm, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
      />
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
      <PrimaryButton onClick={create} disabled={busy || (!businessName.trim() && !businessId.trim())}>
        Create Architect session
      </PrimaryButton>
    </div>
  );
}
