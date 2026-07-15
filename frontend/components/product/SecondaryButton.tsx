"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";

import { useOptionalWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { cockpitColors, typography, radius } from "@/design/tokens";

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  backgroundColor: cockpitColors.panel,
  color: cockpitColors.textPrimary,
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
  padding: "8px 14px",
  cursor: "pointer",
  textDecoration: "none",
  lineHeight: 1.2,
} as const;

export default function SecondaryButton({
  children,
  href,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const nav = useOptionalWorkspaceNavigation();
  const style = {
    ...baseStyle,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? ("none" as const) : undefined,
    cursor: disabled ? ("not-allowed" as const) : baseStyle.cursor,
  };

  function onLinkClick(event: MouseEvent<HTMLAnchorElement>, targetHref: string) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (onClick) onClick();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (targetHref.startsWith("/b/")) nav?.beginNavigation(targetHref);
  }

  if (href) {
    return (
      <Link href={href} style={style} onClick={(event) => onLinkClick(event, href)}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} style={style} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
