export default function EmployeeMetrics({
  todayCompleted,
  todayCompletedLine,
  approvalRatePercent,
  approvalRateFootnote,
  inProgress,
  waitingOnYou,
}: {
  todayCompleted: number;
  todayCompletedLine: string;
  approvalRatePercent: number;
  approvalRateFootnote: string;
  inProgress: number;
  waitingOnYou: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Today's accomplishments
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {todayCompleted}
          </div>
          <div className="mt-2 text-sm leading-6 text-foreground">
            {todayCompletedLine}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Approval rate
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {approvalRatePercent}%
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {approvalRateFootnote}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Current workload
          </div>
          <div className="mt-2 text-foreground">
            In progress: <span className="font-semibold">{inProgress}</span>
          </div>
          <div className="mt-1 text-muted-foreground">
            Waiting on you: <span className="font-semibold">{waitingOnYou}</span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Do they need me?
            </div>
            <div className="mt-2 text-sm leading-6 text-foreground">
              {waitingOnYou > 0
                ? "Yes—review items are waiting."
                : "No—nothing needs your review right now."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

