"use client";

import { Trash2 } from "lucide-react";
import { architect } from "./architectTheme";
import { formatAskHistoryWhen, type AskHistoryItem } from "./askSessionResume";
import { ArchitectButton } from "./ArchitectPrimitives";

/**
 * Left rail of past Ask conversations — switch, auto-named, removable.
 */
export default function AskHistorySidebar({
  items,
  activeSessionId,
  busy,
  onNewChat,
  onOpen,
  onRemove,
}: {
  items: AskHistoryItem[];
  activeSessionId?: string | null;
  busy?: boolean;
  onNewChat: () => void;
  onOpen: (sessionId: string) => void;
  onRemove?: (sessionId: string) => void;
}) {
  return (
    <aside
      aria-label="Past conversations"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 12px",
        borderRadius: architect.radius,
        border: `1px solid ${architect.border}`,
        background: architect.panelSolid,
      }}
    >
      <div style={{ display: "grid", gap: 8, padding: "0 4px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: architect.inkMuted }}>
          Conversations
        </div>
        <ArchitectButton disabled={busy} onClick={onNewChat} variant="ghost">
          Commands home
        </ArchitectButton>
      </div>

      <div style={{ display: "grid", gap: 4, overflowY: "auto", paddingRight: 2, flex: 1, alignContent: "start" }}>
        {!items.length ? (
          <p style={{ margin: "8px 4px", color: architect.inkMuted, fontSize: 13, lineHeight: 1.45 }}>
            Past chats show up here after you send a message.
          </p>
        ) : (
          items.map((item) => {
            const active = activeSessionId != null && item.sessionId === activeSessionId;
            const when = formatAskHistoryWhen(item.updatedAt);
            return (
              <div
                key={item.sessionId}
                style={{
                  display: "grid",
                  gridTemplateColumns: onRemove ? "1fr auto" : "1fr",
                  gap: 4,
                  alignItems: "start",
                  border: `1px solid ${active ? "rgba(20,184,166,.35)" : "transparent"}`,
                  background: active ? architect.accentSoft : "transparent",
                  borderRadius: 14,
                  padding: "4px 4px 4px 6px",
                }}
              >
                <button
                  type="button"
                  disabled={busy || active}
                  onClick={() => onOpen(item.sessionId)}
                  style={{
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    color: architect.ink,
                    borderRadius: 12,
                    padding: "6px 6px",
                    cursor: active ? "default" : "pointer",
                    display: "grid",
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 650, fontSize: 13, lineHeight: 1.35 }}>
                    {truncate(item.title, 42)}
                  </div>
                  {item.kind === "setup" ? (
                    <div style={{ fontSize: 11, color: architect.accent, fontWeight: 650 }}>
                      Setup plan
                    </div>
                  ) : null}
                  {item.preview ? (
                    <div style={{ fontSize: 12, color: architect.inkMuted, lineHeight: 1.35 }}>
                      {truncate(item.preview, 64)}
                    </div>
                  ) : null}
                  {when ? (
                    <div style={{ fontSize: 11, color: architect.inkMuted }}>{when}</div>
                  ) : null}
                </button>
                {onRemove ? (
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    disabled={busy}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemove(item.sessionId);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: architect.inkMuted,
                      cursor: busy ? "default" : "pointer",
                      padding: "8px 6px",
                      borderRadius: 10,
                      lineHeight: 0,
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function truncate(value: string, max: number): string {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
