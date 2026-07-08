"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";

import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
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
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const { beginNavigation } = useWorkspaceNavigation();

  function onLinkClick(event: MouseEvent<HTMLAnchorElement>, targetHref: string) {
    if (onClick) onClick();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (targetHref.startsWith("/b/")) beginNavigation(targetHref);
  }

  if (href) {
    return (
      <Link href={href} style={baseStyle} onClick={(event) => onLinkClick(event, href)}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} style={baseStyle} onClick={onClick}>
      {children}
    </button>
  );
}
