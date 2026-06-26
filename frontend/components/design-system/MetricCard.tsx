import type { ReactNode } from "react";

export default function MetricCard({
  label,
  value,
  suffix,
  footnote,
  icon,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  footnote?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </div>
            {suffix ? (
              <div className="text-sm font-medium text-muted-foreground">
                {suffix}
              </div>
            ) : null}
          </div>
        </div>

        {icon ? <div className="shrink-0">{icon}</div> : null}
      </div>

      {footnote ? (
        <div className="mt-3 text-sm leading-6 text-muted-foreground">
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

