"use client";

import { useState } from "react";

import ShellPanel from "@/components/shell/ShellPanel";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export type GmailInboxMessage = {
  gmailMessageId: string;
  threadId: string;
  subject: string;
  from: { name: string | null; email: string } | null;
  to: Array<{ name: string | null; email: string }>;
  receivedAt: string | null;
  snippet: string;
  body: string;
  personId: string | null;
  draftReply?: { body: string; status: string; updatedAt: string } | null;
};

export type GmailInboxSyncMeta = {
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncError: string | null;
  messageCount: number;
};

function formatTimestamp(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function MessageRow({
  businessId,
  message,
  onDraftSaved,
}: {
  businessId: string;
  message: GmailInboxMessage;
  onDraftSaved: (messageId: string, draftReply: GmailInboxMessage["draftReply"]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(message.draftReply?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  async function saveDraft() {
    setSaving(true);
    setSavedNote(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/integrations/gmail/inbox/${encodeURIComponent(message.gmailMessageId)}/draft-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setSavedNote(data?.error ?? "Could not save draft.");
        return;
      }
      onDraftSaved(message.gmailMessageId, data.draftReply ?? null);
      setSavedNote(data?.note ?? "Draft saved.");
    } catch {
      setSavedNote("Could not save draft (network error).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>
            {message.subject || "(no subject)"}
          </div>
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, marginTop: 2 }}>
            {message.from?.name || message.from?.email || "Unknown sender"}
            {message.from?.email ? ` <${message.from.email}>` : ""}
          </div>
          {!expanded ? (
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 4 }}>
              {message.snippet}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            {formatTimestamp(message.receivedAt)}
          </span>
          {message.personId ? <StatusBadge label="Matched to People" tone="success" /> : <StatusBadge label="No People match" tone="neutral" />}
        </div>
      </div>

      {expanded ? (
        <div style={{ marginTop: spacing.md, display: "grid", gap: spacing.md }}>
          <p style={{ whiteSpace: "pre-wrap", color: cockpitColors.textSecondary, lineHeight: 1.6, margin: 0 }}>
            {message.body || message.snippet}
          </p>

          <div
            style={{
              borderRadius: radius.medium,
              border: `1px dashed ${cockpitColors.panelBorder}`,
              padding: spacing.md,
              background: "#fafcfe",
            }}
          >
            <div style={{ fontSize: typography.caption.fontSize, fontWeight: 700, color: cockpitColors.textPrimary }}>
              Draft reply (approval required)
            </div>
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2, marginBottom: spacing.sm }}>
              Saving here only stores a draft. Nothing is sent automatically — approve-first sending is not built yet.
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder={`Reply to ${message.from?.email ?? "sender"}...`}
              style={{
                width: "100%",
                borderRadius: radius.small,
                border: `1px solid ${cockpitColors.panelBorder}`,
                padding: spacing.sm,
                fontSize: typography.body.fontSize,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ marginTop: spacing.sm, display: "flex", alignItems: "center", gap: spacing.sm }}>
              <PrimaryButton onClick={saveDraft} disabled={saving || !draft.trim()}>
                {saving ? "Saving…" : "Save draft"}
              </PrimaryButton>
              {savedNote ? (
                <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{savedNote}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GmailInboxPanel({
  businessId,
  initialMessages,
  initialSync,
}: {
  businessId: string;
  initialMessages: GmailInboxMessage[];
  initialSync: GmailInboxSyncMeta;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [sync, setSync] = useState(initialSync);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/gmail/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Sync failed.");
        return;
      }
      const inboxRes = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/gmail/inbox`);
      const inboxData = await inboxRes.json().catch(() => ({}));
      if (inboxData?.ok) {
        setMessages(inboxData.messages ?? []);
        setSync(inboxData.sync ?? sync);
      }
    } catch {
      setError("Sync failed (network error).");
    } finally {
      setSyncing(false);
    }
  }

  function handleDraftSaved(messageId: string, draftReply: GmailInboxMessage["draftReply"]) {
    setMessages((prev) => prev.map((m) => (m.gmailMessageId === messageId ? { ...m, draftReply } : m)));
  }

  return (
    <ShellPanel
      title="Gmail inbox (synced)"
      subtitle="Manual sync only — no automatic polling yet. Replies are draft-only and never auto-sent."
      action={
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Last sync: {formatTimestamp(sync.lastSyncAt)}
            {sync.lastSyncOk === false ? " (failed)" : ""}
          </span>
          <PrimaryButton onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </PrimaryButton>
        </div>
      }
    >
      {error ? (
        <div style={{ padding: spacing.md, color: "#b91c1c", fontSize: typography.caption.fontSize }}>{error}</div>
      ) : null}
      {sync.lastSyncError && !error ? (
        <div style={{ padding: `${spacing.sm} ${spacing.md}`, color: "#b45309", fontSize: typography.caption.fontSize }}>
          Last sync issue: {sync.lastSyncError}
        </div>
      ) : null}
      {messages.length === 0 ? (
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          No synced messages yet. Connect Gmail with the readonly scope, then click Sync now.
        </div>
      ) : (
        <div>
          {messages.map((message) => (
            <MessageRow
              key={message.gmailMessageId}
              businessId={businessId}
              message={message}
              onDraftSaved={handleDraftSaved}
            />
          ))}
        </div>
      )}
    </ShellPanel>
  );
}
