"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";

/**
 * One-click: elevated support enter → client's real Home.
 * Admin identity stays; no permanent membership.
 */
export default function OpenBusinessAsAdminButton({
  businessId,
  businessName,
  alreadyActive = false,
}: {
  businessId: string;
  businessName: string;
  alreadyActive?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const homeHref = `/b/${encodeURIComponent(businessId)}/home`;

  async function openWorkspace() {
    if (alreadyActive) {
      router.push(homeHref);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reason: `Platform admin reviewing ${businessName}`,
          mode: "elevated",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(formatProductErrorMessage(data.productError ?? data.reason ?? data.error ?? "Could not open business"));
        return;
      }
      router.push(homeHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open business");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      <button
        type="button"
        onClick={() => void openWorkspace()}
        disabled={busy}
        style={{
          border: "none",
          cursor: busy ? "wait" : "pointer",
          background: cockpitColors.accent,
          color: "#fff",
          borderRadius: radius.medium,
          height: 44,
          padding: `0 ${spacing.lg}`,
          fontWeight: 700,
          fontSize: typography.button.fontSize,
        }}
      >
        {busy ? "Opening…" : alreadyActive ? "Continue to business" : "Open business"}
      </button>
      {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      <div style={{ color: cockpitColors.textMuted, fontSize: 13, lineHeight: 1.45 }}>
        Opens their real Home with an <strong>Admin view</strong> banner. Full edit, audited — you are not made a permanent owner.
      </div>
    </div>
  );
}
