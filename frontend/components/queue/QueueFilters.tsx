type Filter = "All" | "Needs Review" | "Approved" | "Completed";

const filters: Filter[] = ["All", "Needs Review", "Approved", "Completed"];

export default function QueueFilters() {
  return (
    <div className="flex flex-wrap gap-3" aria-label="Queue filters">
      {filters.map((f) => (
        <button
          key={f}
          type="button"
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-foreground/5"
        >
          {f}
        </button>
      ))}
    </div>
  );
}

