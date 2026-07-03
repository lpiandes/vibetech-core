import { semanticColors, spacing, typography } from "@/design/tokens";

export default function ExecutiveHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header>
      <div style={{ fontSize: typography.pageTitle.fontSize, lineHeight: typography.pageTitle.lineHeight, fontWeight: typography.pageTitle.fontWeight, color: semanticColors.textPrimary }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ marginTop: spacing.sm, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight, color: semanticColors.textSecondary }}>
          {subtitle}
        </div>
      ) : null}
    </header>
  );
}

