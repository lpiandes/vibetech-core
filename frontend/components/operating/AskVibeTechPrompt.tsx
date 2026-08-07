"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { ASK_VIBETECH_SUGGESTIONS, buildAskSuggestions } from "@/lib/operating/businessLanguage";

type Context = {
  intelligenceCandidateId?: string;
  workId?: string;
  personId?: string;
  partyId?: string;
  subjectId?: string;
  employeeId?: string;
};

type AskAnswer = {
  message: string;
  evidence?: Array<{ kind?: string; providerId?: string }>;
  href?: string | null;
  actionDraft?: { status?: string; title?: string } | null;
  refused?: boolean;
};

/**
 * Grounded Ask composer — answers operating questions inline when possible.
 * Unhandled intents open Architect. Nothing mutates until confirm.
 */
export default function AskVibeTechPrompt({
  businessId,
  context,
  placeholder = "What would you like VIBETech to handle?",
  helperText = "Ask about follow-through, change operating rules, or investigate an escalation. Confirm applies changes — nothing mutates until you approve.",
  large = false,
  showSuggestions = true,
  suggestions,
  waitingCount = 0,
  approvalCount = 0,
  workingCount = 0,
  winCount = 0,
  missingConnectionCount = 0,
  unprovenConnectionCount = 0,
  unconfirmedRuleCount = 0,
}: {
  businessId: string;
  context?: Context;
  placeholder?: string;
  helperText?: string;
  large?: boolean;
  showSuggestions?: boolean;
  suggestions?: string[];
  waitingCount?: number;
  approvalCount?: number;
  workingCount?: number;
  winCount?: number;
  missingConnectionCount?: number;
  unprovenConnectionCount?: number;
  unconfirmedRuleCount?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chips = suggestions?.length
    ? suggestions
    : buildAskSuggestions({
      waitingCount,
      approvalCount,
      workingCount,
      winCount,
      missingConnectionCount,
      unprovenConnectionCount,
      unconfirmedRuleCount,
    });
  const suggestionList = chips.length ? chips : [...ASK_VIBETECH_SUGGESTIONS];

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

  async function submitPrompt(prompt: string) {
    const trimmed = (prompt || "What should I focus on in this business right now?").trim();
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/ask/operating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Ask failed."));
        return;
      }
      if (data.handled && data.message) {
        setAnswer({
          message: String(data.message),
          evidence: Array.isArray(data.evidence) ? data.evidence : [],
          href: data.href ?? null,
          actionDraft: data.actionDraft ?? null,
          refused: Boolean(data.refused),
        });
        setValue("");
        return;
      }
      openArchitect(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitPrompt(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitPrompt(value);
    }
  }

  return (
    <div style={{ display: "grid", gap: spacing.md }} aria-label="Ask VIBETech">
      <form onSubmit={onSubmit} style={{ display: "grid", gap: spacing.md }}>
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
          disabled={busy}
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
          <p style={{ margin: 0, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted, lineHeight: 1.45, flex: 1 }}>
            {helperText}
          </p>
          <button
            type="submit"
            disabled={busy}
            style={{
              border: "none",
              borderRadius: radius.medium,
              background: cockpitColors.accent,
              color: "#0f172a",
              fontWeight: 700,
              fontSize: typography.button.fontSize,
              padding: `${spacing.sm} ${spacing.md}`,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>

      {showSuggestions ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
          {suggestionList.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => void submitPrompt(chip)}
              style={{
                border: `1px solid ${cockpitColors.panelBorder}`,
                borderRadius: radius.pill,
                background: cockpitColors.panelElevated,
                color: cockpitColors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p style={{ margin: 0, color: cockpitColors.critical, fontSize: typography.meta.fontSize }}>{error}</p>
      ) : null}

      {answer ? (
        <section
          aria-live="polite"
          style={{
            padding: spacing.md,
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: cockpitColors.panel,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: typography.body.fontSize,
              lineHeight: 1.55,
              color: cockpitColors.textPrimary,
            }}
          >
            {answer.message}
          </pre>
          {answer.evidence?.length ? (
            <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>
              Evidence: {answer.evidence.slice(0, 5).map((e) => e.providerId || e.kind).filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {answer.href ? (
              <Link href={answer.href} style={{ color: cockpitColors.accent, fontWeight: 650, fontSize: 13, textDecoration: "none" }}>
                Open related →
              </Link>
            ) : null}
            {answer.actionDraft ? (
              <Link
                href={`/b/${encodeURIComponent(businessId)}/knowledge`}
                style={{ color: cockpitColors.accent, fontWeight: 650, fontSize: 13, textDecoration: "none" }}
              >
                Review draft in Company Rules →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => openArchitect(value || answer.message.slice(0, 120))}
              style={{
                border: "none",
                background: "transparent",
                color: cockpitColors.textMuted,
                fontSize: 12,
                fontWeight: 650,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Continue in Ask →
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
