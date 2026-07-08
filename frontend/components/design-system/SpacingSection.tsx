import { spacing, semanticColors, typography } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";

export default function SpacingSection() {
  const keys = Object.keys(spacing) as Array<keyof typeof spacing>;

  return (
    <div>
      <ExecutiveHeader title="Spacing" subtitle="Visualize the 8-point scale." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <div style={{ display: "grid", gap: spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {keys.map((k) => (
                <div
                  key={String(k)}
                  style={{
                    border: `1px solid ${semanticColors.border}`,
                    borderRadius: spacing.md,
                    padding: spacing.lg,
                    backgroundColor: semanticColors.surface,
                  }}
                >
                  <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                    {String(k)}
                  </div>
                  <div style={{ marginTop: spacing.sm, height: spacing[k], backgroundColor: semanticColors.textMuted, opacity: 0.12, borderRadius: spacing.sm }} />
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textPrimary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                    {spacing[k]}
                  </div>
                </div>
              ))}
            </div>
          </ExecutiveStack>
        </ExecutiveCard>
      </div>
    </div>
  );
}
