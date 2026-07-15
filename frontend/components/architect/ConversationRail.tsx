"use client";

import type { CSSProperties, DragEvent, FormEvent } from "react";
import { architect } from "./architectTheme";
import { ArchitectButton, ThinkingDots } from "./ArchitectPrimitives";
import { HUMAN_COPY, detectUploadHint, researchFindingCards } from "./architectSemantics";

type Props = {
  conversation: Array<{ messageId?: string; role?: string; text?: string }>;
  nextQuestion?: { questionId?: string; text?: string; why?: string; prompt?: string } | null;
  quickReplies?: string[];
  message: string;
  setMessage: (value: string) => void;
  thinking?: boolean;
  busy?: boolean;
  mode: "discovery" | "chat";
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
};

/**
 * Single-focus conversation — one question, one reply, Continue / Skip / I'm not sure.
 */
export default function ConversationRail({
  conversation,
  nextQuestion,
  quickReplies = [],
  message,
  setMessage,
  thinking,
  busy,
  mode,
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
}: Props) {
  const findings = researchFindingCards(researchFindings ?? null);
  const liveStatus = thinking ? HUMAN_COPY.rethink : "";
  const questionId = String(nextQuestion?.questionId ?? "");
  const askingWebsite = mode === "discovery" && questionId === "q_website";
  const askingDocuments = mode === "discovery" && questionId === "q_documents";
  const canContinue = askingWebsite
    ? Boolean(websiteUrl.trim() || message.trim())
    : askingDocuments
      ? Boolean(message.trim() || uploads.length)
      : Boolean(message.trim());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (askingWebsite) {
      const url = (websiteUrl.trim() || message.trim());
      if (!url) return;
      if (/^https?:\/\//i.test(url) || /\./.test(url)) {
        onResearch();
      }
      onQuickReply(url);
      return;
    }
    if (askingDocuments && !message.trim() && uploads.length) {
      onQuickReply(`Uploaded ${uploads.length} document${uploads.length === 1 ? "" : "s"}`);
      return;
    }
    if (!canContinue) return;
    onSubmit();
  }

  const hasThread = (conversation ?? []).length > 0 || Boolean(thinking);

  return (
    <div style={{ display: "grid", gap: hasThread ? 14 : 10 }}>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatus}
      </div>

      {hasThread || mode === "discovery" ? (
      <div
        role="log"
        aria-label="Conversation"
        style={{
          display: "grid",
          gap: 12,
          maxHeight: mode === "chat" ? 280 : 420,
          overflowY: "auto",
          paddingRight: 4,
          minHeight: mode === "chat" ? undefined : 120,
        }}
      >
        {!(conversation ?? []).length && !thinking && mode === "discovery" ? (
          <div
            style={{
              borderRadius: 16,
              padding: "16px 16px",
              background: "rgba(15,23,42,.35)",
              border: `1px solid ${architect.border}`,
              color: architect.inkMuted,
              lineHeight: 1.55,
              fontSize: 15,
            }}
          >
            Answer one question at a time. VIBETech will guide the rest.
          </div>
        ) : null}
        {(conversation ?? []).map((entry, index) => {
          const mine = entry.role === "user";
          return (
            <div
              key={entry.messageId ?? `${entry.role}-${index}`}
              style={{
                justifySelf: mine ? "end" : "start",
                maxWidth: "92%",
                borderRadius: 16,
                padding: "12px 14px",
                background: mine ? architect.accentSoft : "rgba(15,23,42,.55)",
                border: `1px solid ${mine ? "rgba(20,184,166,.28)" : architect.border}`,
                color: architect.ink,
                lineHeight: 1.55,
                fontSize: 15,
              }}
            >
              <div style={{ fontSize: 11, color: architect.inkMuted, marginBottom: 4, fontWeight: 650 }}>
                {mine ? "You" : "VIBETech"}
              </div>
              {entry.text}
            </div>
          );
        })}
        {thinking ? <ThinkingDots label={HUMAN_COPY.rethink} /> : null}
      </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        {askingWebsite ? (
          <input
            value={websiteUrl}
            onChange={(event) => {
              setWebsiteUrl(event.target.value);
              setMessage(event.target.value);
            }}
            placeholder="https://yourcompany.com"
            style={{ ...inputStyle, minHeight: 48, resize: "none" as const }}
            autoFocus
          />
        ) : askingDocuments ? (
          <div style={{ display: "grid", gap: 10 }}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe the documents you use, or upload them below…"
              rows={3}
              style={inputStyle}
              autoFocus
            />
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
                      <div style={{ color: architect.inkMuted, fontSize: 12 }}>{hint.label}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={mode === "chat" ? "Ask anything…" : "Type your answer…"}
            rows={mode === "chat" ? 2 : 3}
            style={inputStyle}
            autoFocus
          />
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ArchitectButton type="submit" disabled={busy || !canContinue}>
            {mode === "chat" ? "Send" : "Continue"}
          </ArchitectButton>
          {mode === "discovery" && onSkip ? (
            <ArchitectButton type="button" variant="ghost" disabled={busy} onClick={onSkip}>Skip</ArchitectButton>
          ) : null}
          {mode === "discovery" && onUnknown ? (
            <ArchitectButton type="button" variant="ghost" disabled={busy} onClick={onUnknown}>I&apos;m not sure</ArchitectButton>
          ) : null}
        </div>
      </form>

      {askingWebsite && findings.some((card) => card.status === "found") ? (
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
                color: architect.inkMuted,
                padding: "7px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {reply}
            </button>
          ))}
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
