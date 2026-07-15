"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";
import { ASK_NEW_CHAT_EVENT } from "@/components/architect/askOpenChat";

/**
 * Persistent Ask VIBETech entry — top bar / mobile.
 * When already on Ask: start a new chat (history keeps past threads).
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
        backgroundColor: active ? "#0d9488" : cockpitColors.accent,
        color: "#fff",
        textDecoration: "none",
        fontWeight: 700,
        fontSize: typography.button.fontSize,
        whiteSpace: "nowrap",
        boxShadow: active
          ? "0 0 0 2px rgba(20, 184, 166, 0.45), inset 0 0 0 1px rgba(255,255,255,0.25)"
          : "none",
      }}
    >
      <MessageSquare size={16} aria-hidden />
      {compact ? "Ask" : "Ask VIBETech"}
    </Link>
  );
}
