import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { cockpitColors, radius } from "@/design/tokens";

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: radius.medium,
  border: "2px solid #0d9488",
  backgroundColor: cockpitColors.accent,
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  padding: "10px 16px",
  cursor: "pointer",
  textDecoration: "none",
  lineHeight: 1.2,
  boxShadow: "0 6px 16px rgba(15,118,110,0.35)",
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
