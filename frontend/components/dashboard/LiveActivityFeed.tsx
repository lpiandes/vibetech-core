import InfoCard from "@/components/design-system/InfoCard";

export type LiveActivityEntry = {
  time: string; // HH:MM
  employee: string;
  activity: string;
  object: string;
};

export default function LiveActivityFeed({
  entries,
}: {
  entries: LiveActivityEntry[];
}) {
  return (
    <section>
      <InfoCard title="While you were away">
        <div className="space-y-3">
          {entries.map((e, idx) => (
            <div
              key={`${e.time}-${idx}`}
              className="grid grid-cols-4 items-start gap-x-6 gap-y-1"
            >
              <div className="w-16 shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {e.time}
              </div>
              <div className="col-span-1 text-sm font-semibold text-foreground">
                {e.employee}
              </div>
              <div className="col-span-2 text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">
                  {e.activity}
                </span>
                <span className="text-muted-foreground"> · {e.object}</span>
              </div>
            </div>
          ))}
        </div>
      </InfoCard>
    </section>
  );
}

