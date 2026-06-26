import StatusBadge from "@/components/design-system/StatusBadge";

export default function EmployeeStatus({
  status,
  qualifier,
  waitingOnYou,
  needsReview,
}: {
  status: "Working" | "Needs Review" | "Approved" | "Completed" | "Offline";
  qualifier: string;
  waitingOnYou: number;
  needsReview: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <div className="text-xs text-muted-foreground">
          {needsReview ? (
            <>
              Waiting on you: <span className="font-medium">{waitingOnYou}</span>
            </>
          ) : (
            <>No review required right now.</>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm leading-6 text-foreground">{qualifier}</div>
    </div>
  );
}

