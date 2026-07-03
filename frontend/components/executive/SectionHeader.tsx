import { semanticColors, spacing, typography } from "@/design/tokens";

export default function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{ fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight, color: semanticColors.textPrimary }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight, color: semanticColors.textSecondary }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

