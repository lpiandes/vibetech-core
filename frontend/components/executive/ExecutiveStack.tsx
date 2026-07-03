import { spacing } from "@/design/tokens";
import type { ReactNode } from "react";

export default function ExecutiveStack({
  children,
  gap = "md",
}: {
  children: ReactNode;
  gap?: keyof typeof spacing;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[gap] }}>
      {children}
    </div>
  );
}

