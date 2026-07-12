"use client";

import { statusSemantics, type StatusSemanticKey, radius, typography } from "@/design/tokens";

const LEGACY_MAP: Record<string, StatusSemanticKey> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  handled: "handled",
  resolved: "resolved",
  waiting: "waiting",
  informational: "informational",
  info: "informational",
  success: "handled",
  warning: "medium",
  danger: "critical",
  open: "waiting",
  neutral: "low",
};

/**
 * Status with text + icon — never color alone (WCAG).
 */
export default function OperatingStatusBadge({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  const key = LEGACY_MAP[String(status ?? "informational").toLowerCase()] ?? "informational";
  const sem = statusSemantics[key];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: radius.pill,
        padding: "4px 10px",
        fontSize: typography.caption.fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        backgroundColor: sem.bg,
        color: sem.color,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>{sem.icon}</span>
      <span>{label ?? sem.label}</span>
    </span>
  );
}
