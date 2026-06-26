import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>

      {action ? <div className="sm:pt-1">{action}</div> : null}
    </div>
  );
}

