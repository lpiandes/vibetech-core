import type { ReactNode } from "react";

type Status = "Needs Review" | "Approved" | "Completed";

const statusStyles: Record<
  Status,
  { labelClass: string; dotClass: string }
> = {
  "Needs Review": { labelClass: "text-rose-700 bg-rose-500/10", dotClass: "bg-rose-500/70" },
  Approved: { labelClass: "text-emerald-700 bg-emerald-500/10", dotClass: "bg-emerald-500/70" },
  Completed: { labelClass: "text-zinc-700 bg-zinc-500/10", dotClass: "bg-zinc-500/70" },
};

export default function StatusBadge({
  status,
}: {
  status: Status;
}): ReactNode {
  const styles = statusStyles[status];

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium shadow-sm",
        styles.labelClass,
      ].join(" ")}
    >
      <span className={`h-2 w-2 rounded-full ${styles.dotClass}`} />
      {status}
    </span>
  );
}

