export default function ApprovalStatusCard({
  approval,
}: {
  approval: {
    requiresApproval: boolean;
    statusLabel: string;
  };
}) {
  const decision = approval.requiresApproval
    ? "Awaiting your approval"
    : approval.statusLabel?.toLowerCase().includes("rejected")
      ? "Rejected"
      : "Approved";

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">
        Decision
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Review Required
          </div>
          <div className="text-sm font-semibold text-foreground">{approval.requiresApproval ? "Yes" : "No"}</div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Decision
          </div>
          <div className="text-sm font-semibold text-foreground">
            {decision}
          </div>
        </div>
      </div>
    </section>
  );
}

