import SecondaryButton from "@/components/design-system/SecondaryButton";
import SearchInput from "@/components/design-system/SearchInput";

type Filter = "All" | "Needs Review" | "Approved" | "Completed";

const filters: Filter[] = ["All", "Needs Review", "Approved", "Completed"];

export default function QueueFilters() {
  return (
    <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput
            placeholder="Search"
            aria-label="Search work queue"
            disabled
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3" aria-label="Queue filters">
        {filters.map((f) => (
          <SecondaryButton
            key={f}
            type="button"
            className="h-9 rounded-full px-4 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-foreground/5"
          >
            {f}
          </SecondaryButton>
        ))}
      </div>
    </div>
  );
}

