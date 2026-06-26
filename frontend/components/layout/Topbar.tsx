import { Search, UserRound } from "lucide-react";

export default function Topbar() {
  return (
    <div className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Workspace</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-80 rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none shadow-sm"
            placeholder="Search"
            disabled
          />
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm">
          <UserRound className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

