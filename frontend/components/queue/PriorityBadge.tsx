import type { ReactNode } from "react";

type Priority = "Low" | "Medium" | "High";

const priorityStyles: Record<Priority, { labelClass: string; dotClass: string }> = {
  Low: { labelClass: "bg-foreground/5 text-foreground", dotClass: "bg-foreground/30" },
  Medium: { labelClass: "bg-amber-500/10 text-amber-700", dotClass: "bg-amber-500/60" },
  High: { labelClass: "bg-rose-500/10 text-rose-700", dotClass: "bg-rose-500/60" },
};

export default function PriorityBadge({
  priority,
}: {
  priority: Priority;
}): ReactNode {
  const styles = priorityStyles[priority];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium shadow-sm">
      <span className={`h-2 w-2 rounded-full ${styles.dotClass}`} />
      <span className={styles.labelClass}>{priority}</span>
    </span>
  );
}

