"use client";

import Link from "next/link";
import { useContext, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import type { CommunicationViewModel } from "./CommunicationContext";
import { CommunicationViewModelContext } from "./CommunicationContext";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import PageHeader from "@/components/product/PageHeader";
import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  deriveInboxCounts,
  deliveryStatusForThread,
  extractThreadContact,
  filterThreads,
  formatInboxTimestamp,
  threadPreview,
  type InboxFilter,
} from "./inboxSemantics";

const FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_reply", label: "Needs reply" },
  { id: "waiting", label: "Waiting" },
];

function PanelEmpty({ description }: { description: string }) {
  return (
    <div
      style={{
        padding: spacing.md,
        color: cockpitColors.textMuted,
        fontSize: typography.caption.fontSize,
        lineHeight: 1.5,
      }}
    >
      {description}
    </div>
  );
}

function FilterChips({
  active,
  counts,
  onSelect,
}: {
  active: InboxFilter;
  counts: ReturnType<typeof deriveInboxCounts>["filters"];
  onSelect: (filter: InboxFilter) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }} aria-label="Inbox filters">
      {FILTERS.map((filter) => {
        const selected = active === filter.id;
        const count = counts[filter.id];

        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onSelect(filter.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: radius.pill,
              border: `1px solid ${selected ? cockpitColors.accent : cockpitColors.panelBorder}`,
              backgroundColor: selected ? cockpitColors.accentMuted : cockpitColors.panel,
              color: selected ? cockpitColors.accent : cockpitColors.textSecondary,
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {filter.label}
            <span style={{ color: cockpitColors.textMuted, fontWeight: 700 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ConversationRow({
  thread,
  messages,
  businessId,
  onNavigate,
}: {
  thread: Record<string, unknown>;
  messages: unknown;
  businessId: string;
  onNavigate: (href: string) => void;
}) {
  const href = `/b/${businessId}/inbox/${encodeURIComponent(String(thread.id))}`;
  const contact = extractThreadContact(thread, messages);
  const delivery = deliveryStatusForThread(thread, messages);
  const preview = threadPreview(thread, messages);
  const avatarName = contact.name ?? String(thread.subject ?? "Conversation");
  const subject = String(thread.subject ?? "Conversation");
  const channel = String(thread.channel ?? "message").replace(/_/g, " ");

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        onNavigate(href);
      }}
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: spacing.md,
        alignItems: "center",
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = cockpitColors.panelElevated;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
        <EntityAvatar name={avatarName} kind={contact.name ? "person" : "subject"} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{subject}</div>
          <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {contact.name ?? "Unknown contact"}
            {contact.email ? ` · ${contact.email}` : ""}
            {channel ? ` · ${channel}` : ""}
          </div>
          {preview ? (
            <div
              style={{
                marginTop: 4,
                fontSize: typography.caption.fontSize,
                color: cockpitColors.textMuted,
                lineHeight: 1.45,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {preview}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Last activity {formatInboxTimestamp(thread.latestMessageAt as string | null)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
        <StatusBadge label={delivery.label} tone={delivery.tone} />
        <ChevronRight size={16} color={cockpitColors.textMuted} aria-hidden />
      </div>
    </Link>
  );
}

export default function CommunicationExecutiveLayout() {
  const viewModel = useContext<CommunicationViewModel | null>(CommunicationViewModelContext);
  const { businessId } = useBusinessScope();
  const { beginNavigation } = useWorkspaceNavigation();
  const [filter, setFilter] = useState<InboxFilter>("all");

  const threads = viewModel?.threads;
  const messages = viewModel?.messages;
  const attentionItems = viewModel?.attention?.items;
  const metrics = viewModel?.metrics ?? {};

  const counts = useMemo(
    () => deriveInboxCounts(threads, messages, attentionItems, metrics),
    [threads, messages, attentionItems, metrics],
  );

  const metricStrip = useMemo(
    () => [
      { id: "conversations", label: "Conversations", value: String(counts.conversations) },
      { id: "needs_reply", label: "Needs reply", value: String(counts.needsReply) },
      { id: "waiting", label: "Waiting", value: String(counts.waiting) },
      {
        id: counts.deliveryMetric.id,
        label: counts.deliveryMetric.label,
        value: String(counts.deliveryMetric.value),
      },
    ],
    [counts],
  );

  const visibleThreads = useMemo(
    () => filterThreads(threads, filter, messages, attentionItems),
    [threads, filter, messages, attentionItems],
  );

  if (!viewModel) return null;

  const emptyCopy =
    filter === "needs_reply"
      ? "No conversations need a reply right now."
      : filter === "waiting"
        ? "No conversations are waiting on delivery right now."
        : "Messages from connected email, text, and other channels will appear here.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title="Inbox"
        description="Messages and follow-ups VIBETech is tracking for this business."
      />

      <ShellMetricStrip metrics={metricStrip} />

      <ShellPanel
        title="Conversations"
        subtitle={`${counts.filters.all} conversation${counts.filters.all === 1 ? "" : "s"}`}
        action={<FilterChips active={filter} counts={counts.filters} onSelect={setFilter} />}
      >
        {visibleThreads.length === 0 ? (
          <PanelEmpty description={emptyCopy} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visibleThreads.map((thread) => (
              <ConversationRow
                key={String(thread.id)}
                thread={thread}
                messages={messages}
                businessId={businessId}
                onNavigate={beginNavigation}
              />
            ))}
          </div>
        )}
      </ShellPanel>
    </div>
  );
}
