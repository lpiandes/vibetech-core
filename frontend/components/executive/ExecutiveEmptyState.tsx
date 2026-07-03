import { semanticColors, spacing, typography, radius } from "@/design/tokens";

export default function ExecutiveEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section
      style={{
        border: `1px dashed ${semanticColors.border}`,
        borderRadius: radius.large,
        padding: spacing.lg,
        backgroundColor: semanticColors.surface,
      }}
    >
      <div style={{ color: semanticColors.textPrimary, fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight }}>
        {title}
      </div>
      <div style={{ marginTop: spacing.xs, color: semanticColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, fontWeight: typography.body.fontWeight }}>
        {message}
      </div>
    </section>
  );
}

