import type { ReactNode } from "react";

import { spacing, semanticColors } from "@/design/tokens";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <section
      className="mx-auto w-full max-w-6xl"
      style={{
        paddingLeft: spacing["2xl"],
        paddingRight: spacing["2xl"],
        paddingTop: spacing["3xl"],
        paddingBottom: spacing["3xl"],
        backgroundColor: semanticColors.background,
      }}
    >
      {children}
    </section>
  );
}

