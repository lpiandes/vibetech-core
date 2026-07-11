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
  const [openMenu, setOpenMenu] = useState(false);

  const canImprove = scope.permissions.includes("business.manage") || scope.role === "OWNER" || scope.role === "PLATFORM_ADMIN";
  if (!canImprove) return null;

  async function start(prompt: string) {
    setBusy(true);
    setError(null);
    setOpenMenu(false);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/builder/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.message ?? "Could not start.");
      router.push(data.openHref ?? `/architect/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  const prompts = [
    "Improve this business",
    "Request a new capability",
    "Add a workflow",
    "Add an employee",
    "Change access",
    "Add a report",
    "Add a recurring operation",
  ];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => (compact ? setOpenMenu((value) => !value) : void start("Improve this business"))}
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
      {compact && openMenu ? (
        <div style={{
          marginTop: 8,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: radius.medium,
          padding: 8,
          display: "grid",
          gap: 4,
        }}>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => void start(prompt)}
              style={{
                background: "transparent",
                color: "#E5E7EB",
                border: "none",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <div style={{ color: cockpitColors.warning, marginTop: 6, fontSize: 12 }}>{error}</div> : null}
    </div>
  );
}
