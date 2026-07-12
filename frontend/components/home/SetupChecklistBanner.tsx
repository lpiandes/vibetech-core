import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type ChecklistItem = {
  id: string;
  title: string;
  actionLabel: string;
  href: string;
  complete: boolean;
};

export default function SetupChecklistBanner({
  businessName,
  checklist,
  compact = false,
}: {
  businessName: string;
  checklist: ChecklistItem[];
  compact?: boolean;
}) {
  const incomplete = checklist.filter((item) => !item.complete);
  if (incomplete.length === 0) return null;

  const completeCount = checklist.filter((item) => item.complete).length;
  const total = checklist.length;
  const progress = total > 0 ? Math.round((completeCount / total) * 100) : 0;
  const nextItem = incomplete[0];

  return (
    <div
      style={{
        marginBottom: spacing.md,
        padding: compact ? `${spacing.sm} ${spacing.md}` : spacing.md,
        borderRadius: radius.large,
        border: `1px solid ${cockpitColors.panelBorder}`,
        backgroundColor: cockpitColors.panel,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
            {compact ? "Finish required setup" : `Finish setup for ${businessName}`}
          </div>
          <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {incomplete.map((item) => item.title).join(" · ")}
          </div>
          {!compact ? (
            <div
              style={{
                marginTop: spacing.sm,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: cockpitColors.panelElevated,
                overflow: "hidden",
                maxWidth: 320,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  borderRadius: radius.pill,
                  backgroundColor: cockpitColors.accent,
                }}
              />
            </div>
          ) : null}
        </div>
        {nextItem ? (
          <Link
            href={nextItem.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              color: cockpitColors.accent,
              textDecoration: "none",
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {nextItem.actionLabel}
            <ChevronRight size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
