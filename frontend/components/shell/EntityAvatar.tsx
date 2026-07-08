"use client";

import { Building2, Bot } from "lucide-react";

import { cockpitColors, semanticColors, typography, radius } from "@/design/tokens";

function initials(name: string) {
  return String(name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function EntityAvatar({
  name,
  kind,
}: {
  name: string;
  kind?: "person" | "subject" | "employee";
}) {
  const bg =
    kind === "subject" ? cockpitColors.accentMuted : kind === "employee" ? "rgba(34,197,94,0.12)" : cockpitColors.panelElevated;
  const color = kind === "employee" ? semanticColors.success : cockpitColors.accent;

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.medium,
        backgroundColor: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: typography.caption.fontSize,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {kind === "subject" ? <Building2 size={16} /> : kind === "employee" ? <Bot size={16} /> : initials(name)}
    </div>
  );
}
