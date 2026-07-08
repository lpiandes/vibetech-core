import type { ReactNode } from "react";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export default function Section({
  title,
  action,
  children,
  noBorder,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  noBorder?: boolean;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.sm }}>
        <h2 style={{ ...typography.sectionTitle, color: cockpitColors.textPrimary, margin: 0, fontSize: "1.05rem" }}>{title}</h2>
        {action}
      </div>
      <div
        style={
          noBorder
            ? undefined
            : {
                borderRadius: radius.large,
                border: `1px solid ${cockpitColors.panelBorder}`,
                backgroundColor: cockpitColors.panel,
                overflow: "hidden",
              }
        }
      >
        {children}
      </div>
    </section>
  );
}
