"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, radius, typography } from "@/design/tokens";

export default function NeedsAttentionIndicator({ count = 0 }: { count?: number }) {
  const scope = useBusinessScope();
  const href = `/b/${encodeURIComponent(scope.businessId)}/intelligence`;
  const label = count > 0 ? `Needs Attention, ${count} open` : "Needs Attention";

  return (
    <Link
      href={href}
      aria-label={label}
      style={{
        position: "relative",
        width: 34,
        height: 34,
        borderRadius: radius.medium,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: count > 0 ? cockpitColors.warning : cockpitColors.textMuted,
        textDecoration: "none",
      }}
    >
      <AlertCircle size={16} aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            borderRadius: 999,
            backgroundColor: cockpitColors.warning,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {label}
      </span>
    </Link>
  );
}
