import SecondaryButton from "@/components/design-system/SecondaryButton";
import SearchInput from "@/components/design-system/SearchInput";

type Filter = "All" | "Needs Review" | "Approved" | "Completed";

const filters: Filter[] = ["All", "Needs Review", "Approved", "Completed"];

export default function QueueFilters() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput
            placeholder="Search"
            aria-label="Search work queue"
            disabled
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3" aria-label="Queue filters">
        {filters.map((f) => (
          <SecondaryButton
            key={f}
            type="button"
            className="rounded-full border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-foreground/5"
          >
            {f}
          </SecondaryButton>
        ))}
      </div>
    </div>
  );
}

