"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";

/**
 * Ask VIBETech entry — continuous improvement via the same Architect lifecycle.
 * Permanent surface: /b/[businessId]/architect
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

  const architectHref = `/b/${encodeURIComponent(scope.businessId)}/architect`;

  async function start(prompt: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.productError?.message ?? data.error ?? data.message ?? "Could not start.");
      }
      const sessionId = data.session?.sessionId as string | undefined;
      router.push(
        data.openHref
          ?? (sessionId
            ? `${architectHref}?sessionId=${encodeURIComponent(sessionId)}`
            : architectHref),
      );
    } catch (err) {
      setError(formatProductErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => (compact ? router.push(architectHref) : void start("Improve this business"))}
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
        {busy ? "Opening…" : "Ask VIBETech"}
      </button>
      {error ? <div style={{ color: cockpitColors.warning, marginTop: 6, fontSize: 12 }}>{error}</div> : null}
    </div>
  );
}
