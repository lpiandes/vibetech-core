import { semanticColors, spacing, typography } from "@/design/tokens";
import ExecutiveHeader from "@/components/executive/ExecutiveHeader";
import ExecutiveCard from "@/components/executive/ExecutiveCard";
import ExecutiveStack from "@/components/executive/ExecutiveStack";

export default function ColorSection() {
  const keys = Object.keys(semanticColors) as Array<keyof typeof semanticColors>;

  return (
    <div>
      <ExecutiveHeader title="Colors" subtitle="Every semantic color token." />
      <div style={{ marginTop: spacing.md }}>
        <ExecutiveCard style={{ padding: spacing.lg }}>
          <ExecutiveStack gap="md">
            <div style={{ display: "grid", gap: spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {keys.map((k) => (
                <div
                  key={String(k)}
                  style={{
                    border: `1px solid ${semanticColors.border}`,
                    borderRadius: spacing.md,
                    padding: spacing.md,
                    backgroundColor: semanticColors.surface,
                  }}
                >
                  <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                    {String(k)}
                  </div>
                  <div style={{ marginTop: spacing.sm, height: spacing.xl, borderRadius: spacing.md, backgroundColor: (semanticColors as any)[k] }} />
                  <div style={{ marginTop: spacing.xs, color: semanticColors.textPrimary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
                    {(semanticColors as any)[k]}
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
