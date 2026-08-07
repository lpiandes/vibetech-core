"use client";

import { MessageSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { brand, spacing, radius, typography } from "@/design/tokens";
import { ASK_NEW_CHAT_EVENT } from "@/components/architect/askOpenChat";

/**
 * Persistent Ask entry — button only; typing happens inside Ask.
 */
export default function GlobalAskVibeTechEntry({
  context,
  compact: _compact = false,
}: {
  context?: Record<string, string | undefined>;
  /** Kept for callers; Ask is always a button now. */
  compact?: boolean;
}) {
  const scope = useBusinessScope();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { displayPath, beginNavigation } = useWorkspaceNavigation();
  const active = /\/architect(?:\/|$|\?)/.test(displayPath) || /\/architect(?:\/|$)/.test(pathname);

  function openArchitect() {
    const params = new URLSearchParams();
    if (context) {
      for (const [key, entry] of Object.entries(context)) {
        if (entry) params.set(key, entry);
      }
    }
    const query = params.toString();
    const href = `/b/${encodeURIComponent(scope.businessId)}/architect${query ? `?${query}` : ""}`;
    if (active) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ASK_NEW_CHAT_EVENT));
      }
      return;
    }
    beginNavigation(href.split("?")[0]);
    router.push(href);
  }

  return (
    <button
      type="button"
      aria-label="Ask VIBETech"
      aria-current={active ? "page" : undefined}
      data-global-nav="ask"
      onClick={() => openArchitect()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 34,
        padding: `0 ${spacing.md}`,
        borderRadius: radius.medium,
        background: brand.primaryGradient,
        backgroundSize: "160% 100%",
        color: brand.primaryOnGradient,
        fontWeight: 700,
        fontSize: typography.button.fontSize,
        whiteSpace: "nowrap",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 8px 32px rgba(34, 211, 238, 0.25)",
        opacity: active ? 0.92 : 1,
      }}
    >
      <MessageSquare size={16} aria-hidden />
      Ask
    </button>
  );
}
