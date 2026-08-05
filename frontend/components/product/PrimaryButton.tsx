import type { ReactNode } from "react";
import Link from "next/link";

import { brand, radius } from "@/design/tokens";

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: radius.medium,
  border: "1px solid rgba(255,255,255,0.12)",
  background: brand.primaryGradient,
  color: brand.primaryOnGradient,
  fontSize: 14,
  fontWeight: 800,
  padding: "10px 16px",
  cursor: "pointer",
  textDecoration: "none",
  lineHeight: 1.2,
  boxShadow: "0 8px 24px rgba(34, 211, 238, 0.28)",
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
