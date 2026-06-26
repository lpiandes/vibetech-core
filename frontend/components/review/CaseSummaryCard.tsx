type CaseSummary = {
  clientName: string;
  matterType: string;
  priority: "Low" | "Medium" | "High" | string;
  status: "Needs Review" | "Approved" | "Completed" | string;
  assignedEmployee: string;
  createdTimeISO: string;
};

function formatCreatedTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CaseSummaryCard({ case: cs }: { case: CaseSummary }) {
  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Case Summary
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Client
          </div>
          <div className="text-sm font-semibold text-foreground">{cs.clientName}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Matter Type
          </div>
          <div className="text-sm font-semibold text-foreground">{cs.matterType}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Priority
          </div>
          <div className="text-sm font-semibold text-foreground">{cs.priority}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Status
          </div>
          <div className="text-sm font-semibold text-foreground">{cs.status}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Assigned Employee
          </div>
          <div className="text-sm font-semibold text-foreground">{cs.assignedEmployee}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Created Time
          </div>
          <div className="text-sm font-semibold text-foreground">
            {formatCreatedTime(cs.createdTimeISO)}
          </div>
        </div>
      </div>
    </section>
  );
}

