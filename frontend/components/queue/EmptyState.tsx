export default function EmptyState() {
  return (
    <div className="rounded-3xl border border-border bg-background p-10 shadow-sm">
      <div className="max-w-xl">
        <div className="text-2xl font-semibold tracking-tight text-foreground">
          Your Digital Workforce is caught up.
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          There is nothing requiring your attention.
        </p>
      </div>
    </div>
  );
}

