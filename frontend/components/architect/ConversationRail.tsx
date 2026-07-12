"use client";

import type { CSSProperties, DragEvent, FormEvent } from "react";
import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton, ThinkingDots } from "./ArchitectPrimitives";
import { HUMAN_COPY, detectUploadHint, researchFindingCards } from "./architectSemantics";

type Props = {
  conversation: Array<{ messageId?: string; role?: string; text?: string }>;
  nextQuestion?: { text?: string; why?: string } | null;
  quickReplies?: string[];
  message: string;
  setMessage: (value: string) => void;
  thinking?: boolean;
  busy?: boolean;
  mode: "discovery" | "chat";
  /** When false, hide the optional “next question” suggestion card. */
  suggestQuestion?: boolean;
  onSubmit: () => void;
  onQuickReply: (value: string) => void;
  onSkip?: () => void;
  onUnknown?: () => void;
  websiteUrl: string;
  setWebsiteUrl: (value: string) => void;
  onResearch: () => void;
  researchBusy?: boolean;
  researchFindings?: Record<string, unknown> | null;
  onConfirmResearch?: (accepted: boolean) => void;
  uploads?: Array<{ filename?: string; classification?: string }>;
  onUploadFiles?: (files: FileList | null) => void;
  dragOver?: boolean;
  setDragOver?: (value: boolean) => void;
  showEvidence?: boolean;
  setShowEvidence?: (value: boolean) => void;
};

export default function ConversationRail({
  conversation,
  nextQuestion,
  quickReplies = [],
  message,
  setMessage,
  thinking,
  busy,
  mode,
  suggestQuestion = true,
  onSubmit,
  onQuickReply,
  onSkip,
  onUnknown,
  websiteUrl,
  setWebsiteUrl,
  onResearch,
  researchBusy,
  researchFindings,
  onConfirmResearch,
  uploads = [],
  onUploadFiles,
  dragOver,
  setDragOver,
  showEvidence,
  setShowEvidence,
}: Props) {
  const findings = researchFindingCards(researchFindings ?? null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const liveStatus = thinking ? HUMAN_COPY.rethink : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Status-only live region — avoid re-announcing the full chat history */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatus}
      </div>
      <div role="log" aria-label="Conversation" style={{ display: "grid", gap: 12, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
        {(conversation ?? []).map((entry, index) => {
          const mine = entry.role === "user";
          return (
            <div
              key={entry.messageId ?? `${entry.role}-${index}`}
              style={{
                justifySelf: mine ? "end" : "start",
                maxWidth: "92%",
                borderRadius: 18,
                padding: "12px 14px",
                background: mine ? architect.accentSoft : "rgba(15,23,42,.55)",
                border: `1px solid ${mine ? "rgba(20,184,166,.28)" : architect.border}`,
                color: architect.ink,
                lineHeight: 1.5,
                animation: "architectFadeUp .35s ease",
              }}
            >
              <div style={{ fontSize: 11, color: architect.inkMuted, marginBottom: 4, fontWeight: 650 }}>
                {mine ? "You" : "Architect"}
              </div>
              {entry.text}
            </div>
          );
        })}
        {thinking ? <ThinkingDots label={HUMAN_COPY.rethink} /> : null}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={mode === "chat" ? "Ask Architect to refine the plan…" : "Tell Architect about your business…"}
          rows={3}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ArchitectButton disabled={busy || !message.trim()} onClick={onSubmit}>
            {mode === "chat" ? "Send" : "Continue"}
          </ArchitectButton>
          {mode === "discovery" && onSkip ? (
            <ArchitectButton variant="ghost" disabled={busy} onClick={onSkip}>Skip for now</ArchitectButton>
          ) : null}
          {mode === "discovery" && onUnknown ? (
            <ArchitectButton variant="secondary" disabled={busy} onClick={onUnknown}>I&apos;m not sure</ArchitectButton>
          ) : null}
        </div>
        {mode === "discovery" && (onSkip || onUnknown) ? (
          <p style={{ margin: 0, color: architect.inkMuted, fontSize: 12, lineHeight: 1.45 }}>
            Skip for now asks later. I&apos;m not sure lets Architect continue without guessing.
          </p>
        ) : null}
      </form>

      {mode === "discovery" && suggestQuestion && nextQuestion ? (
        <div style={{
          borderRadius: architect.radiusSm,
          border: `1px dashed ${architect.border}`,
          background: "transparent",
          padding: 14,
          display: "grid",
          gap: 6,
          opacity: 0.9,
        }}>
          <ArchitectBadge>Suggested</ArchitectBadge>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: architect.inkMuted }}>
            {nextQuestion.text ?? (nextQuestion as { prompt?: string }).prompt}
          </div>
          {nextQuestion.why ? (
            <div style={{ color: architect.inkMuted, fontSize: 12, lineHeight: 1.5 }}>{nextQuestion.why}</div>
          ) : null}
          <ArchitectButton
            variant="ghost"
            disabled={busy}
            onClick={() => onQuickReply(String(nextQuestion.text ?? (nextQuestion as { prompt?: string }).prompt ?? ""))}
          >
            Answer this
          </ArchitectButton>
        </div>
      ) : null}

      {quickReplies.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={busy}
              onClick={() => onQuickReply(reply)}
              style={{
                borderRadius: 999,
                border: `1px solid ${architect.border}`,
                background: "transparent",
                color: architect.ink,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ArchitectButton variant="ghost" onClick={() => setShowEvidence?.(!showEvidence)}>
          {showEvidence ? "Hide extras" : HUMAN_COPY.shareWebsite}
        </ArchitectButton>
        {!showEvidence ? (
          <ArchitectButton variant="secondary" onClick={() => setShowEvidence?.(true)}>
            {HUMAN_COPY.addDocuments}
          </ArchitectButton>
        ) : null}
      </div>

      {showEvidence ? (
        <div style={{ display: "grid", gap: 12, animation: "architectFadeUp .35s ease" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://yourcompany.com"
              style={{ ...inputStyle, minHeight: 44, resize: "none" as const }}
            />
            <ArchitectButton variant="secondary" disabled={researchBusy || !websiteUrl.trim()} onClick={onResearch}>
              {researchBusy ? "Reviewing website…" : "Review website"}
            </ArchitectButton>
          </div>

          {findings.some((card) => card.status === "found") ? (
            <div style={{ display: "grid", gap: 8 }}>
              {findings.filter((card) => card.status === "found").map((card) => (
                <div key={card.id} style={softCard}>
                  <div style={{ fontWeight: 650 }}>{card.label}</div>
                  <div style={{ color: architect.inkMuted, fontSize: 13 }}>{card.values.join(" · ")}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <ArchitectButton onClick={() => onConfirmResearch?.(true)}>Looks right</ArchitectButton>
                <ArchitectButton variant="secondary" onClick={() => onConfirmResearch?.(false)}>Not quite</ArchitectButton>
              </div>
            </div>
          ) : null}

          <div
            onDragOver={(event: DragEvent) => {
              event.preventDefault();
              setDragOver?.(true);
            }}
            onDragLeave={() => setDragOver?.(false)}
            onDrop={(event: DragEvent) => {
              event.preventDefault();
              setDragOver?.(false);
              onUploadFiles?.(event.dataTransfer.files);
            }}
            style={{
              ...softCard,
              borderStyle: "dashed",
              borderColor: dragOver ? architect.accent : architect.border,
              textAlign: "center",
              color: architect.inkMuted,
            }}
          >
            <div style={{ marginBottom: 8 }}>Drop documents here, or choose files</div>
            <input
              type="file"
              multiple
              onChange={(event) => onUploadFiles?.(event.target.files)}
              style={{ color: architect.inkMuted }}
            />
          </div>

          {uploads.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {uploads.map((upload, index) => {
                const hint = detectUploadHint(String(upload.filename ?? ""), upload.classification);
                return (
                  <div key={`${upload.filename}-${index}`} style={softCard}>
                    <div style={{ fontWeight: 650 }}>{upload.filename}</div>
                    <div style={{ color: architect.inkMuted, fontSize: 12 }}>{hint.label} · {hint.plannedUse}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.45)",
  color: architect.ink,
  padding: 14,
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: architect.font,
  resize: "vertical",
};

const softCard: CSSProperties = {
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(15,23,42,.45)",
  padding: 12,
};
