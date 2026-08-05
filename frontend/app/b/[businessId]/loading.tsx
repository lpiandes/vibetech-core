import { cockpitColors, radius, spacing } from "@/design/tokens";

/**
 * Soft-nav skeleton so tab switches never look frozen while RSC resolves.
 */
export default function BusinessScopedLoading() {
  return (
    <div
      style={{
        display: "grid",
        gap: spacing.lg,
        padding: `${spacing.lg}px ${spacing.xl}px`,
        maxWidth: 1100,
      }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        style={{
          height: 28,
          width: "42%",
          borderRadius: radius.md,
          background: cockpitColors.panelElevated,
        }}
      />
      <div
        style={{
          height: 14,
          width: "68%",
          borderRadius: radius.sm,
          background: cockpitColors.panel,
        }}
      />
      <div
        style={{
          display: "grid",
          gap: spacing.md,
          marginTop: spacing.md,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 88,
              borderRadius: radius.lg,
              border: `1px solid ${cockpitColors.panelBorder}`,
              background: cockpitColors.panel,
            }}
          />
        ))}
      </div>
    </div>
  );
}
