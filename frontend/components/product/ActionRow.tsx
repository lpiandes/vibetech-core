"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import StatusBadge, { type StatusBadgeTone } from "./StatusBadge";
import PrimaryButton from "./PrimaryButton";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { cockpitColors, spacing, typography } from "@/design/tokens";

function isInternalBusinessHref(href: string) {
  return href.startsWith("/b/");
}

export default function ActionRow({
  icon,
  title,
  description,
  status,
  statusTone = "neutral",
  actionLabel,
  onAction,
  href,
  isLast,
  complete,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  status?: string;
  statusTone?: StatusBadgeTone;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  isLast?: boolean;
  complete?: boolean;
}) {
  const { beginNavigation } = useWorkspaceNavigation();

  function onLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (isInternalBusinessHref(href)) beginNavigation(href);
  }

  const content = (
    <>
      <span style={{ display: "flex", alignItems: "center", gap: spacing.md, minWidth: 0, flex: 1 }}>
        {icon ? (
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: complete ? cockpitColors.accentMuted : cockpitColors.panelElevated,
              color: complete ? cockpitColors.accent : cockpitColors.textMuted,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        ) : null}
        <span style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: typography.body.fontSize,
              color: complete ? cockpitColors.textMuted : cockpitColors.textPrimary,
              textDecoration: complete ? "line-through" : "none",
            }}
          >
            {title}
          </div>
          {description ? (
            <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.35 }}>
              {description}
            </div>
          ) : null}
          {status ? (
            <div style={{ marginTop: 6 }}>
              <StatusBadge label={status} tone={statusTone} />
            </div>
          ) : null}
        </span>
      </span>
      {!complete && actionLabel ? (
        onAction ? (
          <PrimaryButton onClick={onAction}>{actionLabel}</PrimaryButton>
        ) : href ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              color: cockpitColors.accent,
              flexShrink: 0,
            }}
          >
            {actionLabel}
            <ChevronRight size={14} />
          </span>
        ) : (
          <PrimaryButton>{actionLabel}</PrimaryButton>
        )
      ) : null}
    </>
  );

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: `${spacing.md} ${spacing.lg}`,
    borderBottom: isLast ? undefined : `1px solid ${cockpitColors.panelBorder}`,
    textDecoration: "none",
    color: "inherit",
  } as const;

  if (href && !onAction) {
    return (
      <Link href={href} onClick={(event) => onLinkClick(event, href)} style={rowStyle}>
        {content}
      </Link>
    );
  }

  return <div style={rowStyle}>{content}</div>;
}
