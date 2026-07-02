"use client";

export default function TeamLoading() {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-muted/60 rounded w-1/2" />
        <div className="mt-2 h-3 bg-muted/50 rounded w-2/3" />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/30" />
          ))}
        </div>
      </section>

      {/* Departments / Members */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
          <div className="h-4 bg-muted/60 rounded w-1/3" />
          <div className="mt-3 h-24 bg-muted/30 rounded" />
        </section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
          <div className="h-4 bg-muted/60 rounded w-1/3" />
          <div className="mt-3 h-24 bg-muted/30 rounded" />
        </section>
      </div>

      {/* Attention / Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <section key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-muted/60 rounded w-1/2" />
            <div className="mt-3 h-16 bg-muted/30 rounded" />
            <div className="mt-2 h-16 bg-muted/30 rounded" />
          </section>
        ))}
      </div>
    </div>
  );
}

