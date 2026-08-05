"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { brand, spacing, radius, typography } from "@/design/tokens";
import { ASK_NEW_CHAT_EVENT } from "@/components/architect/askOpenChat";

/**
 * Persistent Ask entry — marketing .btn-primary look (no side edge fills).
 */
export default function GlobalAskVibeTechEntry({
  context,
  compact = false,
}: {
  context?: Record<string, string | undefined>;
  compact?: boolean;
}) {
  const scope = useBusinessScope();
  const pathname = usePathname() ?? "";
  const { displayPath, beginNavigation } = useWorkspaceNavigation();
  const params = new URLSearchParams();
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value) params.set(key, value);
    }
  }
  const active = /\/architect(?:\/|$|\?)/.test(displayPath) || /\/architect(?:\/|$)/.test(pathname);
  const qs = params.toString();
  const href = `/b/${encodeURIComponent(scope.businessId)}/architect${qs ? `?${qs}` : ""}`;

  return (
    <Link
      href={href}
      aria-label="Ask VIBETech"
      aria-current={active ? "page" : undefined}
      data-tour-nav="ask"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (active) {
          event.preventDefault();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(ASK_NEW_CHAT_EVENT));
          }
          return;
        }
        beginNavigation(href.split("?")[0]);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: compact ? "auto" : "100%",
        height: compact ? 34 : 40,
        padding: compact ? `0 ${spacing.md}` : `0 ${spacing.lg}`,
        borderRadius: radius.medium,
        background: brand.primaryGradient,
        backgroundSize: "160% 100%",
        color: brand.primaryOnGradient,
        textDecoration: "none",
        fontWeight: 700,
        fontSize: typography.button.fontSize,
        whiteSpace: "nowrap",
        border: "none",
        outline: "none",
        boxShadow: "0 8px 32px rgba(34, 211, 238, 0.25)",
        opacity: active ? 0.92 : 1,
      }}
    >
      <MessageSquare size={16} aria-hidden />
      {compact ? "Ask" : "Ask VIBETech"}
    </Link>
  );
}
