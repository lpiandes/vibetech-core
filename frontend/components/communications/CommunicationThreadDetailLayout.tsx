"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import StatusBadge from "@/components/product/StatusBadge";
import PrimaryButton from "@/components/product/PrimaryButton";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellPanel from "@/components/shell/ShellPanel";
import ShowingCoordinationDialog from "@/components/communications/ShowingCoordinationDialog";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import type { StatusBadgeTone } from "@/components/product/StatusBadge";
import { deliveryStatusPresentation, formatInboxTimestamp } from "./inboxSemantics";

export type CommunicationThreadDetail = {
  thread: {
    id: string;
    subject: string;
    channel: string;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
    latestMessageAt: string | null;
  };
  messages: Array<{
    id: string;
    direction: string;
    channel: string;
    status: string;
    subject: string;
    body: string;
    createdAt: string | null;
    sentAt: string | null;
    deliveredAt: string | null;
    failedAt: string | null;
    timestamp: string | null;
  }>;
  contact: {
    partyId: string | null;
    displayName: string | null;
    email: string | null;
  };
  inquiry: {
    requestId: string | null;
    requestType: string | null;
    text: string | null;
    receivedAt: string | null;
  };
  subject: {
    id: string;
    subjectType: string;
    displayName: string;
    status: string;
    address: string | null;
  } | null;
  interaction: {
    id: string;
    summary: string | null;
    occurredAt: string | null;
    noteText: string | null;
  } | null;
};

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

function ContextField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.65rem", color: cockpitColors.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, color: cockpitColors.textPrimary, fontSize: typography.body.fontSize }}>{value}</div>
    </div>
  );
}

function MessageCard({
  title,
  body,
  status,
  timestamp,
  direction,
}: {
  title: string;
  body: string;
  status: string;
  timestamp: string | null;
  direction: "inbound" | "outbound";
}) {
  const delivery = deliveryStatusPresentation(status);
  const align = direction === "outbound" ? "flex-end" : "flex-start";
  const background =
    direction === "outbound" ? cockpitColors.panelElevated : cockpitColors.panel;

  return (
    <div style={{ display: "flex", justifyContent: align }}>
      <div
        style={{
          width: "min(100%, 640px)",
          padding: spacing.md,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: background,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{title}</div>
          <StatusBadge label={delivery.label} tone={delivery.tone} />
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
          {formatInboxTimestamp(timestamp)}
        </div>
        <p style={{ margin: `${spacing.sm} 0 0`, lineHeight: 1.6, whiteSpace: "pre-wrap", color: cockpitColors.textSecondary }}>
          {body}
        </p>
      </div>
    </div>
  );
}

export default function CommunicationThreadDetailLayout({
  businessId,
  detail,
}: {
  businessId: string;
  detail: CommunicationThreadDetail;
}) {
  const [showingDialogOpen, setShowingDialogOpen] = useState(false);
  const outbound = detail.messages.find((message) => message.direction === "outbound") ?? null;
  const delivery = deliveryStatusPresentation(outbound?.status ?? detail.thread.status);
  const contactName = detail.contact.displayName ?? "Unknown contact";
  const channelLabel = detail.thread.channel.replace(/_/g, " ");
  const sortedMessages = detail.messages
    .slice()
    .sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  const canRequestShowing =
    String(detail.inquiry.requestType ?? "") === "PROSPECT_INQUIRY" &&
    Boolean(detail.inquiry.requestId) &&
    Boolean(detail.subject);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <Link
        href={`/b/${businessId}/inbox`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: cockpitColors.textMuted,
          textDecoration: "none",
          fontSize: typography.caption.fontSize,
          width: "fit-content",
        }}
      >
        <ArrowLeft size={14} />
        Inbox
      </Link>

      <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
        <EntityAvatar name={contactName} kind="person" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: typography.sectionTitle.fontSize, color: cockpitColors.textPrimary }}>
            {detail.thread.subject}
          </div>
          <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {channelLabel} conversation
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              flexWrap: "wrap",
              marginTop: spacing.sm,
            }}
          >
            <StatusBadge label={delivery.label} tone={delivery.tone as StatusBadgeTone} />
            <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
              Last activity {formatInboxTimestamp(detail.thread.latestMessageAt)}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <ShellPanel title="Conversation" subtitle="Timeline of recorded messages for this thread">
          {detail.inquiry.text ? (
            <div style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <MessageCard
                title="Original inquiry"
                body={detail.inquiry.text}
                status="received"
                timestamp={detail.inquiry.receivedAt}
                direction="inbound"
              />
            </div>
          ) : null}

          {sortedMessages.length === 0 && !detail.inquiry.text ? (
            <PanelEmpty description="No messages recorded for this conversation yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, padding: spacing.md }}>
              {sortedMessages.map((message) => (
                <MessageCard
                  key={message.id}
                  title={message.direction === "outbound" ? "Outbound response" : "Inbound message"}
                  body={message.body}
                  status={message.status}
                  timestamp={message.sentAt ?? message.timestamp ?? message.createdAt}
                  direction={message.direction === "outbound" ? "outbound" : "inbound"}
                />
              ))}
            </div>
          )}
        </ShellPanel>

        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <ShellPanel title="Contact">
            <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
              <ContextField label="Name" value={detail.contact.displayName ?? "Unknown contact"} />
              <ContextField label="Email" value={detail.contact.email ?? "—"} />
            </div>
          </ShellPanel>

          {detail.subject ? (
            <ShellPanel title="Property interest">
              <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
                <ContextField
                  label="Property"
                  value={
                    <Link
                      href={`/b/${businessId}/properties/${detail.subject.id}`}
                      style={{ color: cockpitColors.accent, textDecoration: "none", fontWeight: 600 }}
                    >
                      {detail.subject.displayName}
                    </Link>
                  }
                />
                {detail.subject.address ? <ContextField label="Address" value={detail.subject.address} /> : null}
                <ContextField
                  label="Status"
                  value={`${detail.subject.subjectType.replace(/_/g, " ")} · ${detail.subject.status}`}
                />
              </div>
            </ShellPanel>
          ) : null}

          {detail.inquiry.text ? (
            <ShellPanel title="Inquiry context">
              <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
                <ContextField label="Received" value={formatInboxTimestamp(detail.inquiry.receivedAt)} />
                {detail.inquiry.requestType ? (
                  <ContextField label="Type" value={detail.inquiry.requestType.replace(/_/g, " ")} />
                ) : null}
                <ContextField label="Message" value={detail.inquiry.text} />
                {canRequestShowing ? (
                  <div>
                    <PrimaryButton type="button" onClick={() => setShowingDialogOpen(true)}>
                      Request showing
                    </PrimaryButton>
                  </div>
                ) : null}
              </div>
            </ShellPanel>
          ) : (
            <ShellPanel title="Inquiry context">
              <PanelEmpty description="No linked inquiry context for this conversation." />
            </ShellPanel>
          )}
        </div>
      </div>

      {showingDialogOpen && canRequestShowing && detail.inquiry.requestId && detail.subject ? (
        <ShowingCoordinationDialog
          businessId={businessId}
          requestId={detail.inquiry.requestId}
          contactName={contactName}
          propertyName={detail.subject.displayName}
          onClose={() => setShowingDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
