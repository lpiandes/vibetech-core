"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { ASK_VIBETECH_SUGGESTIONS } from "@/lib/operating/businessLanguage";

type Context = {
  intelligenceCandidateId?: string;
  workId?: string;
  personId?: string;
  partyId?: string;
  subjectId?: string;
  employeeId?: string;
};

/**
 * Conversational Ask VIBETech composer — routes into existing in-business Architect.
 * Does not execute actions; governance starts on the Architect page.
 */
export default function AskVibeTechPrompt({
  businessId,
  context,
  placeholder = "What would you like VIBETech to handle?",
  helperText = "Ask about your business, change how something works, or investigate an issue.",
  large = false,
  showSuggestions = true,
}: {
  businessId: string;
  context?: Context;
  placeholder?: string;
  helperText?: string;
  large?: boolean;
  showSuggestions?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

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

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: spacing.md }}
      aria-label="Ask VIBETech"
    >
      <label htmlFor="ask-vibetech-composer" className="sr-only">
        Ask VIBETech
      </label>
      <textarea
        id="ask-vibetech-composer"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={large ? 4 : 2}
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: large ? 120 : 64,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          background: cockpitColors.panel,
          boxShadow: large ? "0 8px 30px rgba(28, 25, 23, 0.06)" : "none",
          color: cockpitColors.textPrimary,
          padding: large ? spacing.lg : spacing.md,
          fontSize: large ? "1.05rem" : typography.body.fontSize,
          lineHeight: 1.55,
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize, maxWidth: 520 }}>
          {helperText}
        </p>
        <button
          type="submit"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 44,
            padding: `0 ${spacing.xl}`,
            borderRadius: radius.medium,
            border: "none",
            background: cockpitColors.accent,
            color: "#fff",
            fontWeight: 650,
            cursor: "pointer",
            fontSize: typography.button.fontSize,
          }}
        >
          Ask VIBETech
        </button>
      </div>
      {showSuggestions ? (
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }} aria-label="Suggested questions">
          {ASK_VIBETECH_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => submitPrompt(suggestion)}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${cockpitColors.panelBorder}`,
                background: "transparent",
                color: cockpitColors.textSecondary,
                padding: `${spacing.xs} ${spacing.md}`,
                cursor: "pointer",
                fontSize: typography.meta.fontSize,
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
