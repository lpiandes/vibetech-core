"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

/**
 * Persistent Ask VIBETech entry — always accessible from the business shell.
 * Optional context query params preserve candidate / work / person context.
 */
export default function GlobalAskVibeTechEntry({
  context,
  compact = false,
}: {
  context?: Record<string, string | undefined>;
  compact?: boolean;
}) {
  const scope = useBusinessScope();
  const params = new URLSearchParams();
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  const href = `/b/${encodeURIComponent(scope.businessId)}/architect${qs ? `?${qs}` : ""}`;

  return (
    <Link
      href={href}
      aria-label="Ask VIBETech"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: compact ? 34 : 40,
        padding: compact ? `0 ${spacing.md}` : `0 ${spacing.lg}`,
        borderRadius: radius.medium,
        backgroundColor: cockpitColors.accent,
        color: "#fff",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: typography.button.fontSize,
        whiteSpace: "nowrap",
      }}
    >
      <MessageSquare size={16} aria-hidden />
      {compact ? "Ask" : "Ask VIBETech"}
    </Link>
  );
}
