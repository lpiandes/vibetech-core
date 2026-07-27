"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";

import { useOptionalWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import { cockpitColors, radius } from "@/design/tokens";

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: radius.medium,
  border: `2px solid rgba(28,25,23,0.22)`,
  backgroundColor: "#fff",
  color: cockpitColors.textPrimary,
  fontSize: 14,
  fontWeight: 800,
  padding: "10px 16px",
  cursor: "pointer",
  textDecoration: "none",
  lineHeight: 1.2,
  boxShadow: "0 3px 10px rgba(28,25,23,0.1)",
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
