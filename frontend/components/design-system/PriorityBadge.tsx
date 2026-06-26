import type { LucideIcon } from "lucide-react";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";

type Priority = "High" | "Medium" | "Low";

function getPriorityStyles(priority: Priority) {
  switch (priority) {
    case "High":
      return {
        className: "bg-rose-500/10 text-rose-700 border-rose-500/30",
        dotClassName: "bg-rose-500/70",
        icon: ArrowUpRight,
      };
    case "Medium":
      return {
        className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
        dotClassName: "bg-amber-500/70",
        icon: ArrowDownToLine,
      };
    case "Low":
      return {
        className: "bg-foreground/5 text-foreground border-border",
        dotClassName: "bg-foreground/30",
        icon: ArrowDownToLine,
      };
  }
}

export default function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  const s = getPriorityStyles(priority);
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
        s.className,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", s.dotClassName].join(" ")} />
      {priority}
    </span>
  );
}

