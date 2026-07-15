"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

import { cockpitColors, spacing, typography, radius, motion } from "@/design/tokens";
import { ASK_VIBETECH_SUGGESTIONS } from "@/lib/operating/businessLanguage";

/**
 * Ask VIBETech composer — primary home conversation entry.
 * Suggestions must be passed from live state (or universal defaults).
 */
export default function AskVibeTechComposer({
  businessId,
  autofocus = false,
  suggestions,
  embedded = false,
}: {
  businessId: string;
  autofocus?: boolean;
  suggestions?: readonly string[];
  /** When true, omit the duplicate zone title (parent HomeZone already labels Ask). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const chips = suggestions ?? ASK_VIBETECH_SUGGESTIONS;

  function openArchitect(prompt: string) {
    const params = new URLSearchParams();
    const trimmed = prompt.trim();
    if (trimmed) params.set("prompt", trimmed);
    const query = params.toString();
    router.push(`/b/${encodeURIComponent(businessId)}/architect${query ? `?${query}` : ""}`);
  }

  function submitPrompt(prompt: string) {
    openArchitect(prompt || "What should I focus on in this business right now?");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitPrompt(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitPrompt(value);
    }
  }

  const active = focused || value.trim().length > 0;

  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      {!embedded ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: cockpitColors.textMuted,
          }}
        >
          Ask VIBETech
        </div>
      ) : null}
      <form onSubmit={onSubmit} aria-label="Ask VIBETech">
        <div
          className="vt-ask-shell"
          style={{
            borderRadius: radius.medium,
            background: embedded ? "rgba(243, 244, 246, 0.7)" : "rgba(255,255,255,0.92)",
            boxShadow: embedded
              ? "none"
              : active
                ? "0 18px 48px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 118, 110, 0.24)"
                : "0 14px 40px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.06)",
            border: embedded ? `1px solid ${cockpitColors.panelBorder}` : "none",
            padding: "14px 16px",
            transition: `box-shadow ${motion.normal} ${motion.easing.standard}`,
          }}
        >
          <label htmlFor="vt-ask-home" className="sr-only">
            Ask VIBETech anything about this business
          </label>
          <textarea
            id="vt-ask-home"
            value={value}
            autoFocus={autofocus}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything about this business…"
            rows={2}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              background: "transparent",
              color: cockpitColors.textPrimary,
              fontSize: "1.05rem",
              lineHeight: 1.45,
              fontFamily: "inherit",
              minHeight: 48,
              padding: 0,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: spacing.sm }}>
            <button
              type="submit"
              aria-label="Ask VIBETech"
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                border: "none",
                background: value.trim() ? cockpitColors.accent : cockpitColors.inset,
                color: value.trim() ? "#fff" : cockpitColors.textMuted,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ArrowUp size={16} aria-hidden />
            </button>
          </div>
        </div>
      </form>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} aria-label="Suggested questions">
        {chips.slice(0, 3).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => submitPrompt(suggestion)}
            style={{
              border: "none",
              background: "transparent",
              color: cockpitColors.accent,
              padding: 0,
              cursor: "pointer",
              fontSize: typography.meta.fontSize,
              fontWeight: 600,
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
