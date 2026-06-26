import Avatar from "@/components/design-system/Avatar";
import InfoCard from "@/components/design-system/InfoCard";
import PrimaryButton from "@/components/design-system/PrimaryButton";
import StatusBadge from "@/components/design-system/StatusBadge";

export default function DigitalWorkforceCard() {
  const employeeName = "Client Success Coordinator";
  const status: "Working" = "Working";
  const activitySummary =
    "Today: Prepared 3 client updates and queued 1 draft for attorney review.";

  return (
    <section>
      <InfoCard title={employeeName}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <Avatar name={employeeName} size={44} />

            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Status
              </div>
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>

              <div className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Today’s activity summary
              </div>
              <div className="mt-2 text-sm leading-6 text-foreground">
                {activitySummary}
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            <PrimaryButton type="button" className="h-11 rounded-2xl px-5">
              Review Work
            </PrimaryButton>
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

