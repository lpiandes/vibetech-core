"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { brand, spacing, radius, typography, cockpitColors } from "@/design/tokens";
import { ASK_NEW_CHAT_EVENT } from "@/components/architect/askOpenChat";
import { ASK_VIBETECH_SUGGESTIONS, buildAskSuggestions } from "@/lib/operating/businessLanguage";

/**
 * Persistent Ask command bar — grounded operating answers when possible.
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
  const router = useRouter();
  const { displayPath, beginNavigation } = useWorkspaceNavigation();
  const [value, setValue] = useState("");
  const [showChips, setShowChips] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inlineAnswer, setInlineAnswer] = useState<string | null>(null);
  const active = /\/architect(?:\/|$|\?)/.test(displayPath) || /\/architect(?:\/|$)/.test(pathname);

  const suggestions = useMemo(() => buildAskSuggestions({}).slice(0, 4), []);
  const chips = suggestions.length ? suggestions : [...ASK_VIBETECH_SUGGESTIONS].slice(0, 4);

  function openArchitect(prompt: string) {
    const params = new URLSearchParams();
    const trimmed = prompt.trim();
    if (trimmed) params.set("prompt", trimmed);
    if (context) {
      for (const [key, entry] of Object.entries(context)) {
        if (entry) params.set(key, entry);
      }
    }
    const query = params.toString();
    const href = `/b/${encodeURIComponent(scope.businessId)}/architect${query ? `?${query}` : ""}`;
    if (active && !trimmed) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ASK_NEW_CHAT_EVENT));
      }
      return;
    }
    beginNavigation(href.split("?")[0]);
    router.push(href);
    setValue("");
    setShowChips(false);
    setInlineAnswer(null);
  }

  async function askGrounded(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) {
      openArchitect("");
      return;
    }
    setBusy(true);
    setInlineAnswer(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(scope.businessId)}/ask/operating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.handled && data.message) {
        setInlineAnswer(String(data.message));
        setValue("");
        setShowChips(false);
        return;
      }
      openArchitect(trimmed);
    } catch {
      openArchitect(trimmed);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void askGrounded(value || "What should I focus on in this business right now?");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setValue("");
      setShowChips(false);
      setInlineAnswer(null);
      (event.target as HTMLInputElement).blur();
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label="Ask VIBETech"
        aria-current={active ? "page" : undefined}
        data-global-nav="ask"
        onClick={() => openArchitect("")}
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

  return (
    <div style={{ width: "100%", maxWidth: 420, minWidth: 200, position: "relative" }}>
      <form
        onSubmit={onSubmit}
        aria-label="Ask VIBETech command bar"
        data-global-nav="ask"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 38,
          padding: `0 ${spacing.sm} 0 ${spacing.md}`,
          borderRadius: radius.medium,
          border: `1px solid ${active ? "rgba(34,211,238,0.55)" : cockpitColors.panelBorder}`,
          background: cockpitColors.panelElevated,
          boxShadow: active ? "0 0 0 1px rgba(34,211,238,0.25)" : "none",
        }}
      >
        <MessageSquare size={16} aria-hidden style={{ color: cockpitColors.accent, flexShrink: 0 }} />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setShowChips(true)}
          onBlur={() => setTimeout(() => setShowChips(false), 150)}
          onKeyDown={onKeyDown}
          disabled={busy}
          placeholder="Ask VIBETech…"
          aria-label="Ask VIBETech"
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: cockpitColors.textPrimary,
            fontSize: typography.caption.fontSize,
            fontWeight: 550,
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            height: 28,
            padding: `0 ${spacing.sm}`,
            borderRadius: radius.small,
            border: "none",
            background: brand.primaryGradient,
            color: brand.primaryOnGradient,
            fontWeight: 700,
            fontSize: 12,
            cursor: busy ? "wait" : "pointer",
            flexShrink: 0,
          }}
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
      {showChips ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            padding: spacing.sm,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: cockpitColors.panel,
            boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
            zIndex: 40,
            display: "grid",
            gap: 6,
          }}
        >
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void askGrounded(chip)}
              style={{
                textAlign: "left",
                border: "none",
                background: "transparent",
                color: cockpitColors.textSecondary,
                fontSize: 12,
                fontWeight: 550,
                padding: "6px 8px",
                borderRadius: radius.small,
                cursor: "pointer",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}
      {inlineAnswer ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            padding: spacing.md,
            borderRadius: radius.medium,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: cockpitColors.panel,
            boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
            zIndex: 41,
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 12,
              lineHeight: 1.5,
              color: cockpitColors.textPrimary,
            }}
          >
            {inlineAnswer}
          </pre>
          <button
            type="button"
            onClick={() => setInlineAnswer(null)}
            style={{
              marginTop: 8,
              border: "none",
              background: "transparent",
              color: cockpitColors.textMuted,
              fontSize: 11,
              fontWeight: 650,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
