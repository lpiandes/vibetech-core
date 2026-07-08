import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function ProductLoading() {
  return (
    <div style={{ padding: spacing.lg }} aria-busy="true" aria-live="polite">
      <div
        style={{
          height: 12,
          width: "40%",
          borderRadius: 6,
          backgroundColor: cockpitColors.panelBorder,
          marginBottom: spacing.md,
        }}
      />
      <div
        style={{
          height: 12,
          width: "70%",
          borderRadius: 6,
          backgroundColor: cockpitColors.panelBorder,
          marginBottom: spacing.sm,
        }}
      />
      <div
        style={{
          height: 12,
          width: "55%",
          borderRadius: 6,
          backgroundColor: cockpitColors.panelBorder,
          marginBottom: spacing.lg,
        }}
      />
      <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Loading…</div>
    </div>
  );
}
