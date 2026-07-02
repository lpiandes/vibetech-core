"use client";

export default function MissionControlLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm animate-pulse">
        <div className="flex items-start gap-4">
          <div className="rounded-lg p-3 ring-1 ring-border bg-muted/30 w-24 h-16" />
          <div className="min-w-0 flex-1">
            <div className="h-5 bg-muted/60 rounded w-2/3" />
            <div className="mt-2 h-4 bg-muted/50 rounded w-1/2" />
            <div className="mt-4 h-9 bg-muted/40 rounded w-64" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {["Recommendations", "Risks", "Work Queue"].map((t) => (
          <section key={t} className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-muted/60 rounded w-1/3" />
            <div className="mt-2 h-3 bg-muted/50 rounded w-2/3" />
            <div className="mt-4 h-24 bg-muted/30 rounded" />
          </section>
        ))}
      </div>
    </div>
  );
}

