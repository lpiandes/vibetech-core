import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Clock, Network, Timer } from "lucide-react";

import type { ReactElement } from "react";

type Status =
  | "Needs Review"
  | "Approved"
  | "Completed"
  | "Working"
  | "Offline"
  | "Pending";

function getStatusStyles(status: Status) {
  switch (status) {
    case "Needs Review":
      return {
        className:
          "bg-rose-500/10 text-rose-700 border-rose-500/30",
        dotClassName: "bg-rose-500/70",
        icon: AlertCircle,
      };
    case "Approved":
    case "Completed":
      return {
        className:
          "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
        dotClassName: "bg-emerald-500/70",
        icon: CheckCircle2,
      };
    case "Working":
      return {
        className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
        dotClassName: "bg-amber-500/70",
        icon: Timer,
      };
    case "Offline":
      return {
        className: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20",
        dotClassName: "bg-zinc-500/70",
        icon: Network,
      };
    case "Pending":
      return {
        className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
        dotClassName: "bg-amber-500/70",
        icon: Clock,
      };
  }
}

function renderIcon(Icon: LucideIcon): ReactElement {
  return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
}

export default function StatusBadge({ status }: { status: Status }) {
  const s = getStatusStyles(status);
  const Icon = s.icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
        s.className,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", s.dotClassName].join(" ")} />
      {status}
    </span>
  );
}

