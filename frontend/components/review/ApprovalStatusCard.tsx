export default function ApprovalStatusCard({
  approval,
}: {
  approval: {
    requiresAttorneyApproval: boolean;
    statusLabel: string;
  };
}) {
  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Approval Status
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Requires Attorney Approval
          </div>
          <div className="text-sm font-semibold text-foreground">
            {approval.requiresAttorneyApproval ? "Yes" : "No"}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Status
          </div>
          <div className="text-sm font-semibold text-foreground">
            {approval.statusLabel}
          </div>
        </div>
      </div>
    </section>
  );
}

