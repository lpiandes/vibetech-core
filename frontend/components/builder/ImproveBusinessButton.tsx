"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius } from "@/design/tokens";

/**
 * Owner entry point: Improve this business / Ask VIBETech.
 */
export default function ImproveBusinessButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const scope = useBusinessScope();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canImprove = scope.permissions.includes("business.manage") || scope.role === "OWNER" || scope.role === "PLATFORM_ADMIN";
  if (!canImprove) return null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Improve this business" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.message ?? "Could not start.");
      router.push(data.openHref ?? `/builder/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        style={{
          background: compact ? "transparent" : "#0F766E",
          color: compact ? cockpitColors.sidebarText : "#fff",
          border: compact ? "1px solid rgba(255,255,255,0.2)" : "none",
          borderRadius: radius.medium,
          padding: compact ? `${spacing.xs} ${spacing.sm}` : `${spacing.sm} ${spacing.md}`,
          fontWeight: 650,
          cursor: "pointer",
          width: compact ? "100%" : undefined,
        }}
      >
        {busy ? "Opening…" : compact ? "Ask VIBETech" : "Improve this business"}
      </button>
      {error ? <div style={{ color: cockpitColors.warning, marginTop: 6, fontSize: 12 }}>{error}</div> : null}
    </div>
  );
}
