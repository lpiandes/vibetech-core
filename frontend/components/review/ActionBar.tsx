import ApprovalStatusCard from "./ApprovalStatusCard";

export default function ActionBar({
  approval,
}: {
  approval: {
    requiresAttorneyApproval: boolean;
    statusLabel: string;
  };
}) {
  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">Actions</div>

      <div className="mt-5">
        <ApprovalStatusCard approval={approval} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Approve
        </button>

        <button
          type="button"
          className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reject
        </button>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Buttons are visual-only in this sprint.
      </div>
    </section>
  );
}

