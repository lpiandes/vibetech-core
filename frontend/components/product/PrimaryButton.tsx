import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { cockpitColors, typography, radius } from "@/design/tokens";

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: radius.medium,
  border: "none",
  backgroundColor: cockpitColors.accent,
  color: "#fff",
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
  padding: "8px 14px",
  cursor: "pointer",
  textDecoration: "none",
  lineHeight: 1.2,
} as const;

export default function PrimaryButton({
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
  const style = { ...baseStyle, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? ("none" as const) : undefined };
  if (href) {
    return (
      <Link href={href} style={style} onClick={onClick}>
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
