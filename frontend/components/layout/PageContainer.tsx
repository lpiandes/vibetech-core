import type { ReactNode } from "react";

import { spacing, cockpitColors } from "@/design/tokens";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <section
      className="mx-auto w-full"
      style={{
        maxWidth: 1440,
        paddingLeft: spacing.lg,
        paddingRight: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        backgroundColor: cockpitColors.background,
      }}
    >
      {children}
    </section>
  );
}
