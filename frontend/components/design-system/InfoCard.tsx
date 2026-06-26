import type { ReactNode } from "react";

export default function InfoCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {body ? (
        <div className="mt-4 text-sm leading-7 text-foreground">{body}</div>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

