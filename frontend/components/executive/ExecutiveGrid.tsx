import { spacing } from "@/design/tokens";
import type { ReactNode } from "react";

export default function ExecutiveGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const cols = columns;
  const style: React.CSSProperties = { display: "grid", gap: spacing.md };

  // For responsive behavior we rely on CSS grid only; spacing uses an 8-point compatible baseline.
  // Consumers can wrap with ExecutiveStack to fully control spacing.
  return (
    <div
      style={style}
      className={
        cols === 1 ? "" : cols === 2 ? "lg:grid-cols-2" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
      }
    >
      {children}
    </div>
  );
}

